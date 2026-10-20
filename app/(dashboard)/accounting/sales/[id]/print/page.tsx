'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'

interface SalesItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface SalesInvoice {
  id: string
  invoiceNumber: string
  date: string
  dueDate: string
  customerId: string
  customerName: string
  status: string
  totalAmount: number
  amountPaid?: number
  isAcknowledgementReceipt?: boolean
  branchId?: string
  items: SalesItem[]
  createdAt: string
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getCookies() {
  if (typeof document === 'undefined') return { email: '' }
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  return { email: cookies.userEmail || '', name: cookies.userName || '' }
}

export default function PrintSalesInvoicePage() {
  const params = useParams()
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [preparedBy, setPreparedBy] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const [invRes, usersRes] = await Promise.all([
          fetch(`/api/accounting/sales/${params.id}`),
          fetch('/api/users').catch(() => null),
        ])
        const invData = await invRes.json()
        if (invRes.ok) setInvoice(invData)
        else console.error('Failed to fetch invoice:', invData)

        const { email } = getCookies()
        if (usersRes && usersRes.ok) {
          const users = await usersRes.json()
          const user = users.find((u: { email: string; name: string }) => u.email === email)
          setPreparedBy(user?.name || email || '')
        } else {
          setPreparedBy(email || '')
        }
      } catch (err) {
        console.error('Failed to fetch invoice:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [params.id])

  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, invoice])

  if (loading) return <div className="p-8 text-center dark:text-gray-300">Loading document...</div>
  if (!invoice) return <div className="p-8 text-center dark:text-gray-300">Invoice not found</div>

  const isAR = Boolean(invoice.isAcknowledgementReceipt)
  const docTitle = isAR ? 'ACKNOWLEDGEMENT RECEIPT' : 'SALES INVOICE'
  const docSubtitle = isAR ? 'This is not a BIR official receipt — acknowledgement of payment only' : 'Official Sales Invoice'
  const docNoLabel = isAR ? 'AR No:' : 'Invoice No:'

  return (
    <div className="max-w-3xl mx-auto p-6 print:p-0 print:text-black dark:text-gray-200 dark:bg-gray-900 min-h-screen bg-white dark:bg-gray-900">
      {/* Company Header */}
      <div className="text-center mb-4 border-b-2 border-gray-800 dark:border-gray-600 pb-3">
        <h1 className="text-xl font-bold tracking-wide dark:text-white">CARIGARA LEISURE AND STAY CORP.</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Brgy. Carigara, Leyte • TIN: 000-000-000-000</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">Accounting • Sales & Accounts Receivable</p>
      </div>

      {/* Document Title */}
      <div className="text-center mb-4">
        <h2 className={`text-sm font-extrabold tracking-widest inline-block px-6 py-1.5 border-2 ${isAR ? 'border-amber-600 text-amber-700 dark:border-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-800 text-gray-800 dark:border-gray-300 dark:text-white bg-gray-50 dark:bg-gray-800'} `}>{docTitle}</h2>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 italic">{docSubtitle}</p>
        {isAR && (
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 font-medium">Revenue not yet recognized — for acknowledgement purposes only</p>
        )}
      </div>

      {/* Doc No and Status */}
      <div className="flex justify-between items-start mb-4 border dark:border-gray-700 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/50">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{docNoLabel}</p>
          <p className="font-mono font-bold text-lg dark:text-white">{invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Customer ID: <span className="font-mono dark:text-gray-300">{invoice.customerId}</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <p className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold mt-1 ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : invoice.status === 'VOID' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{invoice.status}</p>
          {isAR && <p className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 mt-1 inline-block font-bold">AR-ONLY</p>}
        </div>
      </div>

      {/* Customer + Dates */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-widest mb-1">BILL TO</h3>
          <p className="font-bold text-base dark:text-white">{invoice.customerName}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Customer ID: {invoice.customerId}</p>
        </div>
        <div className="text-right space-y-1 text-sm">
          <p><span className="text-gray-500 dark:text-gray-400">Invoice Date:</span> <span className="font-medium dark:text-white">{format(new Date(invoice.date), 'MMM dd, yyyy')}</span></p>
          <p><span className="text-gray-500 dark:text-gray-400">Due Date:</span> <span className="font-medium dark:text-white">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span></p>
          <p><span className="text-gray-500 dark:text-gray-400">Created:</span> <span className="dark:text-gray-300">{format(new Date(invoice.createdAt), 'MMM dd, yyyy HH:mm')}</span></p>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-widest mb-2">{isAR ? 'DETAILS' : 'LINE ITEMS'}</h3>
        <table className="w-full border dark:border-gray-700 text-sm">
          <thead>
            <tr className={`${isAR ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <th className="border dark:border-gray-700 px-3 py-2 text-left dark:text-gray-300 w-8">#</th>
              <th className="border dark:border-gray-700 px-3 py-2 text-left dark:text-gray-300">Description</th>
              <th className="border dark:border-gray-700 px-3 py-2 text-right dark:text-gray-300 w-20">Qty</th>
              <th className="border dark:border-gray-700 px-3 py-2 text-right dark:text-gray-300 w-28">Unit Price</th>
              <th className="border dark:border-gray-700 px-3 py-2 text-right dark:text-gray-300 w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}>
                <td className="border dark:border-gray-700 px-3 py-2 text-center dark:text-gray-400">{idx + 1}</td>
                <td className="border dark:border-gray-700 px-3 py-2 dark:text-gray-200">{item.description}</td>
                <td className="border dark:border-gray-700 px-3 py-2 text-right font-mono dark:text-white">{item.quantity}</td>
                <td className="border dark:border-gray-700 px-3 py-2 text-right font-mono dark:text-white">{formatCurrency(item.unitPrice)}</td>
                <td className="border dark:border-gray-700 px-3 py-2 text-right font-mono font-medium dark:text-white">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-full sm:w-80">
          <table className="w-full border dark:border-gray-700 text-sm">
            <tbody>
              <tr>
                <td className="border dark:border-gray-700 px-3 py-2 dark:text-gray-300">Subtotal</td>
                <td className="border dark:border-gray-700 px-3 py-2 text-right font-mono dark:text-white">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
              <tr className={`${isAR ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-100 dark:bg-gray-800'} font-bold`}>
                <td className="border dark:border-gray-600 px-3 py-2.5 dark:text-white">{isAR ? 'Amount Acknowledged' : 'Total Due'}</td>
                <td className="border dark:border-gray-600 px-3 py-2.5 text-right font-mono text-base dark:text-white">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
          {isAR && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 text-right italic">* For acknowledgement only — not yet recognized as revenue</p>
          )}
        </div>
      </div>

      {/* Terms / Notes */}
      <div className="mb-6 text-xs text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 pt-3">
        {isAR ? (
          <>
            <p className="font-semibold dark:text-gray-300">Acknowledgement Receipt Terms:</p>
            <p className="mt-1">This document acknowledges receipt of payment/goods as described above. It is <span className="font-bold underline">not</span> an official BIR Sales Invoice or Official Receipt. Revenue will be recognized upon issuance of the corresponding Sales Invoice.</p>
          </>
        ) : (
          <>
            <p className="font-semibold dark:text-gray-300">Terms:</p>
            <p className="mt-1">Please pay on or before due date. Late payments may be subject to penalties. Make checks payable to <span className="font-medium">CARIGARA LEISURE AND STAY CORP.</span></p>
          </>
        )}
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t dark:border-gray-700">
        <div className="text-center">
          <div className="border-b border-gray-800 dark:border-gray-600 mx-8 mb-1 h-8 flex items-end justify-center">
            <span className="text-sm dark:text-white">{preparedBy}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Prepared By</p>
          <p className="text-[10px] text-gray-400">{format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-800 dark:border-gray-600 mx-8 mb-1 h-8"></div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{isAR ? 'Received By (Signature over printed name)' : 'Customer Signature'}</p>
          <p className="text-[10px] text-gray-400">Date: ___________</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-8 border-t dark:border-gray-700 pt-3">
        <p>Generated from HRIS Philippines — {docTitle} {invoice.invoiceNumber} | {format(new Date(), 'MMMM dd, yyyy')}</p>
        {isAR && <p className="mt-0.5 italic">AR-ONLY document • Keep for records • Not valid for BIR input VAT claim</p>}
      </div>

      <style jsx global>{`
        body { background: white; }
        .dark body { background: #111827; }
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:text-black { color: black !important; }
          @page { margin: 0.5cm; size: A4; }
        }
      `}</style>
    </div>
  )
}
