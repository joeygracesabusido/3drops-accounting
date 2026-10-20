import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/

async function calculateAccountBalance(accountId: string, normalBalance: string, branchId?: string | null) {
  const where: { accountId: string; entry?: { branchId: string } } = {
    accountId,
  }
  if (branchId) {
    where.entry = { branchId }
  }

  const lines = await prisma.journalLine.findMany({
    where,
    select: { debit: true, credit: true },
  })

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0)

  const balance = normalBalance === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit
  return Math.round(balance * 100) / 100
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')

    const account = await prisma.account.findUnique({
      where: { id },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const balance = await calculateAccountBalance(account.id, account.normalBalance, branchId)
    return NextResponse.json({ ...account, balance })
  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const body = await request.json()
    const { code, name, type, parentCode, description, isActive, normalBalance, hasSubsidiaryLedger, subsidiaryType } = body

    const account = await prisma.account.update({
      where: { id },
      data: {
        code,
        name,
        type,
        parentCode,
        description,
        isActive,
        normalBalance,
        hasSubsidiaryLedger,
        subsidiaryType: hasSubsidiaryLedger && subsidiaryType ? subsidiaryType : undefined,
      },
    })

    const balance = await calculateAccountBalance(account.id, account.normalBalance, null)
    return NextResponse.json({ ...account, balance })
  } catch (error) {
    if (error instanceof Error && (error as unknown as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 })
    }
    if (error instanceof Error && (error as unknown as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await prisma.account.delete({ where: { id } })
    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error as unknown as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
