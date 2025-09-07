'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { 
  ExclamationCircleIcon, 
  CheckCircleIcon, 
  LockClosedIcon,
  // Using a similar icon for percentage
  CalculatorIcon
} from '@heroicons/react/24/outline'

interface ProgressInputProps {
  value: number
  onChange: (value: number) => void
  onBlur?: () => void
  onFocus?: () => void
  disabled?: boolean
  readOnly?: boolean
  isLeafTask?: boolean
  hasChildren?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showValidation?: boolean
  placeholder?: string
  'data-testid'?: string
  // Validation settings
  min?: number
  max?: number
  step?: number
  allowDecimal?: boolean
  // Enhanced feedback
  validationMessage?: string
  successMessage?: string
  warningMessage?: string
  // Parent task specific
  computedValue?: number
  isComputed?: boolean
}

interface ValidationResult {
  isValid: boolean
  message: string
  type: 'error' | 'warning' | 'success' | 'info'
}

/**
 * Progress Input Component with Leaf Task Validation
 * 
 * Implements AC1: Progress input field with percentage validation (0-100%) for leaf tasks only
 * 
 * Features:
 * - Validates 0-100% range for leaf tasks
 * - Read-only display for parent tasks with computed values
 * - Clear visual feedback for validation states
 * - Accessibility support
 * - Decimal precision control
 * - Real-time validation
 */
export const ProgressInput: React.FC<ProgressInputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  readOnly = false,
  isLeafTask = true,
  hasChildren = false,
  className,
  size = 'md',
  showIcon = true,
  showValidation = true,
  placeholder = 'Enter progress %',
  'data-testid': dataTestId,
  min = 0,
  max = 100,
  step = 1,
  allowDecimal = false,
  validationMessage,
  successMessage,
  warningMessage,
  computedValue,
  isComputed = false
}) => {
  const [inputValue, setInputValue] = useState<string>(String(value))
  const [isFocused, setIsFocused] = useState(false)
  const [hasBeenTouched, setHasBeenTouched] = useState(false)
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    message: '',
    type: 'success'
  })
  
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Determine if input should be read-only (parent tasks or computed values)
  const isReadOnlyMode = readOnly || !isLeafTask || isComputed || hasChildren
  
  // Display value (use computed value for parent tasks)
  const displayValue = isComputed && computedValue !== undefined ? computedValue : value

  /**
   * Validate progress value with comprehensive checks
   */
  const validateProgress = useCallback((val: number): ValidationResult => {
    // Skip validation for read-only parent tasks
    if (isReadOnlyMode) {
      return {
        isValid: true,
        message: hasChildren ? 'Computed from children' : 'Read-only',
        type: 'info'
      }
    }

    // Custom validation message takes precedence
    if (validationMessage) {
      return {
        isValid: false,
        message: validationMessage,
        type: 'error'
      }
    }

    // Range validation
    if (isNaN(val)) {
      return {
        isValid: false,
        message: 'Please enter a valid number',
        type: 'error'
      }
    }

    if (val < min) {
      return {
        isValid: false,
        message: `Progress must be at least ${min}%`,
        type: 'error'
      }
    }

    if (val > max) {
      return {
        isValid: false,
        message: `Progress cannot exceed ${max}%`,
        type: 'error'
      }
    }

    // Decimal validation
    if (!allowDecimal && val % 1 !== 0) {
      return {
        isValid: false,
        message: 'Progress must be a whole number',
        type: 'error'
      }
    }

    // Success validation
    if (successMessage) {
      return {
        isValid: true,
        message: successMessage,
        type: 'success'
      }
    }

    // Warning validation
    if (warningMessage) {
      return {
        isValid: true,
        message: warningMessage,
        type: 'warning'
      }
    }

    // Default success state
    return {
      isValid: true,
      message: 'Valid progress value',
      type: 'success'
    }
  }, [
    isReadOnlyMode, hasChildren, validationMessage, min, max, allowDecimal,
    successMessage, warningMessage
  ])

  /**
   * Handle input value changes with real-time validation
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value
    setInputValue(newInputValue)
    setHasBeenTouched(true)

    // Parse and validate the new value
    const numericValue = parseFloat(newInputValue)
    const validationResult = validateProgress(numericValue)
    setValidation(validationResult)

    // Only call onChange if the value is valid and different
    if (validationResult.isValid && !isNaN(numericValue) && numericValue !== value) {
      onChange(numericValue)
    }
  }, [value, onChange, validateProgress])

  /**
   * Handle input focus
   */
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.()
    
    // Select all text for easy editing
    if (inputRef.current) {
      inputRef.current.select()
    }
  }, [onFocus])

  /**
   * Handle input blur with final validation
   */
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    setHasBeenTouched(true)
    
    const numericValue = parseFloat(inputValue)
    const validationResult = validateProgress(numericValue)
    setValidation(validationResult)

    // Reset to last valid value if current input is invalid
    if (!validationResult.isValid || isNaN(numericValue)) {
      setInputValue(String(value))
    } else {
      // Ensure the displayed value matches the parsed value
      setInputValue(String(numericValue))
    }
    
    onBlur?.()
  }, [inputValue, value, validateProgress, onBlur])

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter key commits the change
    if (e.key === 'Enter') {
      inputRef.current?.blur()
      return
    }

    // Escape key cancels changes
    if (e.key === 'Escape') {
      setInputValue(String(value))
      inputRef.current?.blur()
      return
    }

    // Arrow keys for increment/decrement
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const currentValue = parseFloat(inputValue) || 0
      const increment = e.shiftKey ? 10 : step
      const newValue = e.key === 'ArrowUp' 
        ? Math.min(max, currentValue + increment)
        : Math.max(min, currentValue - increment)
      
      setInputValue(String(newValue))
      
      const validationResult = validateProgress(newValue)
      setValidation(validationResult)
      
      if (validationResult.isValid) {
        onChange(newValue)
      }
    }
  }, [inputValue, value, step, min, max, validateProgress, onChange])

  // Sync input value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(displayValue))
      setValidation(validateProgress(displayValue))
    }
  }, [displayValue, isFocused, validateProgress])

  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-10 px-3 text-sm', 
    lg: 'h-12 px-4 text-base'
  }

  // Icon size classes
  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const getValidationIcon = () => {
    if (!showValidation || !hasBeenTouched) return null
    
    switch (validation.type) {
      case 'error':
        return <ExclamationCircleIcon className={cn(iconSizeClasses[size], 'text-red-500')} />
      case 'success':
        return <CheckCircleIcon className={cn(iconSizeClasses[size], 'text-green-500')} />
      case 'warning':
        return <ExclamationCircleIcon className={cn(iconSizeClasses[size], 'text-yellow-500')} />
      case 'info':
        return <LockClosedIcon className={cn(iconSizeClasses[size], 'text-blue-500')} />
      default:
        return null
    }
  }

  const getValidationColor = () => {
    if (!showValidation || !hasBeenTouched) return ''
    
    switch (validation.type) {
      case 'error':
        return 'border-red-500 focus:ring-red-500'
      case 'success':
        return 'border-green-500 focus:ring-green-500'
      case 'warning':
        return 'border-yellow-500 focus:ring-yellow-500'
      case 'info':
        return 'border-blue-500 focus:ring-blue-500'
      default:
        return 'border-gray-300 focus:ring-blue-500'
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        {/* Icon prefix */}
        {showIcon && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
            <CalculatorIcon className={iconSizeClasses[size]} />
            <span className="absolute -top-1 -right-1 text-[8px] font-bold text-gray-500">%</span>
          </div>
        )}
        
        {/* Main input */}
        <input
          ref={inputRef}
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={isReadOnlyMode}
          placeholder={placeholder}
          min={min}
          max={max}
          step={allowDecimal ? 0.1 : step}
          data-testid={dataTestId}
          className={cn(
            // Base styles
            'w-full border rounded-md bg-white transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            
            // Size classes
            sizeClasses[size],
            
            // Icon padding
            showIcon && 'pl-8',
            
            // Validation icon padding
            (showValidation && hasBeenTouched) && 'pr-8',
            
            // Read-only styling
            isReadOnlyMode && 'bg-gray-50 text-gray-600 cursor-default',
            
            // Validation colors
            getValidationColor(),
            
            // Custom classes
            className
          )}
          aria-invalid={showValidation && !validation.isValid}
          aria-describedby={showValidation ? `${dataTestId}-validation` : undefined}
          title={isReadOnlyMode 
            ? hasChildren 
              ? 'This is a parent task - progress is computed from children'
              : 'This field is read-only'
            : `Enter progress percentage (${min}-${max}%)`
          }
        />
        
        {/* Validation icon suffix */}
        {(showValidation && hasBeenTouched) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {getValidationIcon()}
          </div>
        )}
      </div>
      
      {/* Validation message */}
      {showValidation && hasBeenTouched && validation.message && (
        <div
          id={`${dataTestId}-validation`}
          className={cn(
            'mt-1 text-xs',
            validation.type === 'error' && 'text-red-600',
            validation.type === 'success' && 'text-green-600',
            validation.type === 'warning' && 'text-yellow-600',
            validation.type === 'info' && 'text-blue-600'
          )}
          role="alert"
          aria-live="polite"
        >
          {validation.message}
        </div>
      )}
      
      {/* Help text for parent tasks */}
      {hasChildren && (
        <div className="mt-1 text-xs text-gray-500">
          Progress automatically calculated from subtasks
        </div>
      )}
    </div>
  )
}

ProgressInput.displayName = 'ProgressInput'