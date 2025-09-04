import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculateProgress(spent: number, estimate: number): number {
  if (estimate === 0) return 0
  return Math.min(Math.round((spent / estimate) * 100), 100)
}

export function getStatusColor(status: string): string {
  const statusColors = {
    todo: 'status-todo',
    doing: 'status-doing',
    blocked: 'status-blocked', 
    review: 'status-review',
    done: 'status-done',
  }
  return statusColors[status as keyof typeof statusColors] || 'status-todo'
}

export function getTypeColor(type: string): string {
  const typeColors = {
    feature: 'type-feature',
    bug: 'type-bug',
    spike: 'type-spike',
    chore: 'type-chore',
  }
  return typeColors[type as keyof typeof typeColors] || 'type-feature'
}

export function getPriorityColor(priority: number): string {
  if (priority >= 80) return 'priority-high'
  if (priority >= 50) return 'priority-medium'
  return 'priority-low'
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}