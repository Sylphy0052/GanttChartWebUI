/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressInput } from '../ProgressInput'

// Mock @heroicons/react/24/outline
jest.mock('@heroicons/react/24/outline', () => ({
  ExclamationCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-icon" />
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="check-icon" />
  ),
  LockClosedIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="lock-icon" />
  ),
  CalculatorIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="calculator-icon" />
  ),
}))

describe('ProgressInput', () => {
  const defaultProps = {
    value: 50,
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC1: Progress input field with percentage validation (0-100%) for leaf tasks only', () => {
    it('renders progress input for leaf tasks', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          isLeafTask={true} 
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue(50)
      expect(input).not.toHaveAttribute('readonly')
    })

    it('validates progress range (0-100%)', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(
        <ProgressInput 
          value={50} 
          onChange={onChange} 
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      // Test invalid values
      await user.clear(input)
      await user.type(input, '150')
      await user.tab() // Trigger blur
      
      await waitFor(() => {
        expect(screen.getByText(/cannot exceed 100%/)).toBeInTheDocument()
      })
      
      // Test negative value
      await user.clear(input)
      await user.type(input, '-10')
      await user.tab()
      
      await waitFor(() => {
        expect(screen.getByText(/must be at least 0%/)).toBeInTheDocument()
      })
      
      // Test valid value
      await user.clear(input)
      await user.type(input, '75')
      await user.tab()
      
      expect(onChange).toHaveBeenCalledWith(75)
    })

    it('renders as read-only for parent tasks (non-leaf)', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          isLeafTask={false}
          hasChildren={true}
          computedValue={60}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      expect(input).toHaveAttribute('readonly')
      expect(input).toHaveValue(60)
      expect(screen.getByText(/computed from children/i)).toBeInTheDocument()
    })

    it('shows validation message for non-leaf tasks', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          isLeafTask={false}
          hasChildren={true}
          data-testid="progress-input"
        />
      )
      
      expect(screen.getByText(/Progress automatically calculated from subtasks/)).toBeInTheDocument()
    })

    it('handles keyboard shortcuts', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(
        <ProgressInput 
          value={50} 
          onChange={onChange} 
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      await user.click(input)
      
      // Test arrow up
      await user.keyboard('{ArrowUp}')
      expect(onChange).toHaveBeenCalledWith(51)
      
      // Test arrow down with shift (increment by 10)
      await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
      expect(onChange).toHaveBeenCalledWith(40)
    })

    it('validates decimal values when not allowed', async () => {
      const user = userEvent.setup()
      
      render(
        <ProgressInput 
          {...defaultProps} 
          allowDecimal={false}
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      await user.clear(input)
      await user.type(input, '50.5')
      await user.tab()
      
      await waitFor(() => {
        expect(screen.getByText(/must be a whole number/)).toBeInTheDocument()
      })
    })

    it('allows decimal values when enabled', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(
        <ProgressInput 
          value={50} 
          onChange={onChange} 
          allowDecimal={true}
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      await user.clear(input)
      await user.type(input, '50.5')
      await user.tab()
      
      expect(onChange).toHaveBeenCalledWith(50.5)
    })

    it('displays percentage icon', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          showIcon={true}
          data-testid="progress-input"
        />
      )
      
      // Check if calculator icon is present
      expect(screen.getByTestId('calculator-icon')).toBeInTheDocument()
    })

    it('handles disabled state', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          disabled={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      expect(input).toBeDisabled()
    })

    it('shows success message when provided', async () => {
      const user = userEvent.setup()
      
      render(
        <ProgressInput 
          {...defaultProps} 
          successMessage="Progress updated successfully"
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      // Trigger validation by interacting with the input
      await user.click(input)
      await user.tab()
      
      await waitFor(() => {
        expect(screen.getByText('Progress updated successfully')).toBeInTheDocument()
      })
    })

    it('prevents editing when readOnly is true', () => {
      render(
        <ProgressInput 
          {...defaultProps} 
          readOnly={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      expect(input).toHaveAttribute('readonly')
    })

    it('shows error icon for invalid values', async () => {
      const user = userEvent.setup()
      
      render(
        <ProgressInput 
          {...defaultProps} 
          isLeafTask={true}
          showValidation={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      await user.clear(input)
      await user.type(input, '150')
      await user.tab()
      
      await waitFor(() => {
        expect(screen.getByTestId('exclamation-icon')).toBeInTheDocument()
      })
    })

    it('shows lock icon for parent tasks', async () => {
      const user = userEvent.setup()
      
      render(
        <ProgressInput 
          {...defaultProps} 
          isLeafTask={false}
          hasChildren={true}
          showValidation={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      // Trigger validation by interacting with the input
      await user.click(input)
      await user.tab()
      
      await waitFor(() => {
        expect(screen.getByTestId('lock-icon')).toBeInTheDocument()
      })
    })

    it('handles escape key to cancel changes', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(
        <ProgressInput 
          value={50} 
          onChange={onChange} 
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      await user.click(input)
      await user.clear(input)
      await user.type(input, '75')
      await user.keyboard('{Escape}')
      
      // Value should be reset to original
      expect(input).toHaveValue(50)
    })

    it('handles enter key to commit changes', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(
        <ProgressInput 
          value={50} 
          onChange={onChange} 
          isLeafTask={true}
          data-testid="progress-input"
        />
      )
      
      const input = screen.getByTestId('progress-input')
      
      await user.click(input)
      await user.clear(input)
      await user.type(input, '75')
      await user.keyboard('{Enter}')
      
      expect(onChange).toHaveBeenCalledWith(75)
      expect(input).not.toHaveFocus()
    })
  })
})