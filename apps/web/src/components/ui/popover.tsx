/**
 * Popover UI component for sync status display
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

'use client'

import * as React from 'react'

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface PopoverTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface PopoverContentProps {
  className?: string
  children: React.ReactNode
}

const PopoverContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({ open: false, onOpenChange: () => {} })

export const Popover: React.FC<PopoverProps> = ({ open, onOpenChange, children }) => {
  return (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ asChild = false, children }) => {
  const { open, onOpenChange } = React.useContext(PopoverContext)

  const handleClick = () => {
    onOpenChange(!open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      ...children.props
    } as any)
  }

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  )
}

export const PopoverContent: React.FC<PopoverContentProps> = ({ className = '', children }) => {
  const { open, onOpenChange } = React.useContext(PopoverContext)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onOpenChange])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      className={`absolute top-full right-0 z-50 mt-2 w-72 rounded-md border border-gray-200 bg-white p-4 shadow-md outline-none ${className}`}
    >
      {children}
    </div>
  )
}