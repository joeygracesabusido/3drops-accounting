/**
 * Utility Functions
 * =================
 * Common utility functions used across the application
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 * Handles conditional classes and merges conflicting classes properly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a unique employee ID
 * Format: EMP-YYYY-XXXX (e.g., EMP-2024-0001)
 */
export function generateEmployeeId(year: number = new Date().getFullYear()): string {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `EMP-${year}-${random}`
}

/**
 * Sleep function for async operations (useful for testing loading states)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase())
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date()
}

/**
 * Get start of day for a date
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get end of day for a date
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Get the first day of a month
 */
export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

/**
 * Get the last day of a month
 */
export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0)
}

/**
 * Convert time string (HH:mm) to Date object
 */
export function timeStringToDate(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Format time from Date object
 */
export function formatTime(date: Date | null): string {
  if (!date) return '--:--'
  return date.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'Just now'
}

/**
 * Pluralize a word
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}