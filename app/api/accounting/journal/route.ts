import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, description, reference, lines, branchId } = body;

    if (!date || !description || !lines || !Array.isArray(lines)) {
      return NextResponse.json({ error: 'Date, description, and lines are required' }, { status: 400 });
    }

    if (lines.length < 2) {
      return NextResponse.json({ error: 'A journal entry must have at least two lines' }, { status: 400 });
    }

    // Calculate totals for balance check
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0) || 0;
      totalCredit += parseFloat(line.credit || 0) || 0;
    }

    // Use a small epsilon for floating point comparison
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({
        error: 'Transaction is unbalanced',
        details: `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit})`
      }, { status: 400 });
    }

    // Atomic transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      // Create the journal entry first to get an ID for the auto-gen ref if needed
      const tempEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description,
          reference: reference || 'TEMP_REF', // Placeholder
          branchId: branchId || undefined,
          lines: {
            create: lines.map(line => ({
              accountId: line.accountId,
              subsidiaryLedgerId: line.subsidiaryLedgerId || null,
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              memo: line.memo,
            }))
          }
        },
        include: { lines: true }
      });

      // If reference was empty, update it with a generated one
      const finalReference = reference || `JE-${tempEntry.id.substring(tempEntry.id.length - 6).toUpperCase()}`;
      
      const entry = await tx.journalEntry.update({
        where: { id: tempEntry.id },
        data: { reference: finalReference },
        include: { lines: true }
      });

      // Create subsidiary transactions for lines with subsidiaryLedgerId
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.subsidiaryLedgerId) {
          await tx.subsidiaryTransaction.create({
            data: {
              ledgerId: line.subsidiaryLedgerId,
              date: new Date(date),
              referenceNo: finalReference,
              description: description,
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              journalEntryId: entry.id,
              journalLineId: entry.lines[i].id,
            }
          });

          // Update subsidiary ledger balances
          await tx.subsidiaryLedger.update({
            where: { id: line.subsidiaryLedgerId },
            data: {
              debitTotal: { increment: parseFloat(line.debit) || 0 },
              creditTotal: { increment: parseFloat(line.credit) || 0 },
              balance: { increment: (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0) }
            }
          });
        }
      }

      return entry;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json({ error: 'Failed to post journal entry' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');
    const branchId = searchParams.get('branchId');

    const where: Prisma.JournalEntryWhereInput = {};
    if (reference) {
      where.reference = { contains: reference, mode: 'insensitive' };
    }
    if (branchId) {
      where.branchId = branchId;
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: { 
        lines: { 
          include: { 
            account: true,
            subsidiaryLedger: true
          } 
        } 
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, description, reference, lines, branchId } = body;

    if (!id || !date || !description || !lines || !Array.isArray(lines)) {
      return NextResponse.json({ error: 'ID, date, description, and lines are required' }, { status: 400 });
    }

    // Calculate totals for balance check
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0) || 0;
      totalCredit += parseFloat(line.credit || 0) || 0;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: 'Transaction is unbalanced' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get existing entry with lines and subsidiary transactions to revert balances
      const oldEntry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true }
      });

      if (!oldEntry) throw new Error('Journal entry not found');

      // 2. Revert subsidiary ledger balances from old lines
      for (const oldLine of oldEntry.lines) {
        if (oldLine.subsidiaryLedgerId) {
          await tx.subsidiaryLedger.update({
            where: { id: oldLine.subsidiaryLedgerId },
            data: {
              debitTotal: { decrement: oldLine.debit },
              creditTotal: { decrement: oldLine.credit },
              balance: { decrement: oldLine.debit - oldLine.credit }
            }
          });
        }
      }

      // 3. Delete old subsidiary transactions and lines
      await tx.subsidiaryTransaction.deleteMany({ where: { journalEntryId: id } });
      await tx.journalLine.deleteMany({ where: { entryId: id } });

      const finalReference = reference || `JE-${id.substring(id.length - 6).toUpperCase()}`;

      // 4. Update the main entry
      const entry = await tx.journalEntry.update({
        where: { id },
        data: {
          date: new Date(date),
          description,
          reference: finalReference,
          branchId: branchId || undefined,
          lines: {
            create: lines.map(line => ({
              accountId: line.accountId,
              subsidiaryLedgerId: line.subsidiaryLedgerId || null,
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              memo: line.memo,
            }))
          }
        },
        include: { lines: true }
      });

      // 5. Create new subsidiary transactions and update balances
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.subsidiaryLedgerId) {
          await tx.subsidiaryTransaction.create({
            data: {
              ledgerId: line.subsidiaryLedgerId,
              date: new Date(date),
              referenceNo: finalReference,
              description: description,
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              journalEntryId: entry.id,
              journalLineId: entry.lines[i].id,
            }
          });

          await tx.subsidiaryLedger.update({
            where: { id: line.subsidiaryLedgerId },
            data: {
              debitTotal: { increment: parseFloat(line.debit) || 0 },
              creditTotal: { increment: parseFloat(line.credit) || 0 },
              balance: { increment: (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0) }
            }
          });
        }
      }

      return entry;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true }
      });

      if (!entry) throw new Error('Entry not found');

      // Revert subsidiary ledger balances
      for (const line of entry.lines) {
        if (line.subsidiaryLedgerId) {
          await tx.subsidiaryLedger.update({
            where: { id: line.subsidiaryLedgerId },
            data: {
              debitTotal: { decrement: line.debit },
              creditTotal: { decrement: line.credit },
              balance: { decrement: line.debit - line.credit }
            }
          });
        }
      }

      // Delete subsidiary transactions and journal lines explicitly for serverless reliability
      await tx.subsidiaryTransaction.deleteMany({ where: { journalEntryId: id } });
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      await tx.journalEntry.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
  }
}
