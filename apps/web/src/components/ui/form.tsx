import { FormHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  title?: string
  description?: string
  footer?: ReactNode
}

export function Form({ 
  title, 
  description, 
  footer, 
  className, 
  children, 
  ...props 
}: FormProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      {(title || description) && (
        <div className="mb-6 text-center">
          {title && (
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-gray-600">
              {description}
            </p>
          )}
        </div>
      )}
      
      <form
        className={cn(
          'space-y-6 bg-white shadow-md rounded-lg px-8 pt-6 pb-8',
          className
        )}
        {...props}
      >
        {children}
        
        {footer && (
          <div className="pt-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </form>
    </div>
  )
}

export function FormField({ 
  children, 
  className 
}: { 
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {children}
    </div>
  )
}

export function FormActions({ 
  children, 
  className 
}: { 
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={cn('flex space-x-4', className)}>
      {children}
    </div>
  )
}

export function FormError({ 
  message, 
  className 
}: { 
  message?: string
  className?: string 
}) {
  if (!message) return null
  
  return (
    <div className={cn('rounded-md bg-red-50 p-4', className)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            エラーが発生しました
          </h3>
          <div className="mt-2 text-sm text-red-700">
            {message}
          </div>
        </div>
      </div>
    </div>
  )
}