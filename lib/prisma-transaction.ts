import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

interface TransactionOptions {
  maxWait?: number
  timeout?: number
}

const DEFAULT_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: 10000,
  timeout: 30000,
}

export async function transactional<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return prisma.$transaction(callback, {
    ...DEFAULT_TRANSACTION_OPTIONS,
    ...options,
  })
}

export async function retryableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxRetries?: number
    transactionOptions?: TransactionOptions
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(callback, {
        ...DEFAULT_TRANSACTION_OPTIONS,
        ...options?.transactionOptions,
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isTransient =
        lastError.message.includes('Transaction not found') ||
        lastError.message.includes('Transaction ID is invalid') ||
        lastError.message.includes('closed transaction') ||
        lastError.message.includes('disconnecting') ||
        lastError.message.includes('Connection closed') ||
        lastError.message.includes('P2028')

      if (!isTransient || attempt >= maxRetries) {
        throw lastError
      }

      const delay = 100 * Math.pow(2, attempt)
      console.warn(
        `[Transaction] Attempt ${attempt + 1}/${maxRetries + 1} failed (transient), retrying in ${delay}ms:`,
        lastError.message
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
