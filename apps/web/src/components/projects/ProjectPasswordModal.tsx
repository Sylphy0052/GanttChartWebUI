'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Project } from '@/types/project'
import { useProjects } from '@/stores/projects.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProjectPasswordModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (project: Project) => void
}

interface RateLimitInfo {
  attemptsRemaining: number
  lockoutUntil?: number
  nextAttemptIn?: number
  totalAttempts?: number
  maxAttempts?: number
  lockoutDuration?: string
}

export const ProjectPasswordModal: React.FC<ProjectPasswordModalProps> = ({
  project,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // AC6: Enhanced accessibility refs
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  
  // AC6: Focus trap elements
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([])
  const [firstFocusableElement, setFirstFocusableElement] = useState<HTMLElement | null>(null)
  const [lastFocusableElement, setLastFocusableElement] = useState<HTMLElement | null>(null)
  
  // AC7: Enhanced rate limiting countdown
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null)
  const [remainingTime, setRemainingTime] = useState(0)
  
  const { selectProject } = useProjects()

  // AC6: Setup focus trap and accessibility features
  const setupFocusTrap = useCallback(() => {
    if (!modalRef.current) return

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ]

    const elements = Array.from(
      modalRef.current.querySelectorAll(focusableSelectors.join(', '))
    ) as HTMLElement[]

    const visibleElements = elements.filter(el => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.hasAttribute('hidden')
    })

    setFocusableElements(visibleElements)
    setFirstFocusableElement(visibleElements[0] || null)
    setLastFocusableElement(visibleElements[visibleElements.length - 1] || null)
  }, [])

  // AC6: Handle keyboard navigation and focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    // Handle Escape key
    if (e.key === 'Escape' && !isLoading) {
      e.preventDefault()
      onClose()
      return
    }

    // Handle Tab key for focus trap
    if (e.key === 'Tab') {
      if (!firstFocusableElement || !lastFocusableElement) return

      if (e.shiftKey) {
        // Shift + Tab (backwards)
        if (document.activeElement === firstFocusableElement) {
          e.preventDefault()
          lastFocusableElement.focus()
        }
      } else {
        // Tab (forwards)
        if (document.activeElement === lastFocusableElement) {
          e.preventDefault()
          firstFocusableElement.focus()
        }
      }
    }

    // Handle Enter key on submit button
    if (e.key === 'Enter' && document.activeElement === submitButtonRef.current) {
      e.preventDefault()
      if (!isLoading && password.trim() && (!rateLimitInfo?.lockoutUntil || Date.now() >= rateLimitInfo.lockoutUntil)) {
        handleSubmit(e as any)
      }
    }
  }, [isOpen, isLoading, firstFocusableElement, lastFocusableElement, onClose, password, rateLimitInfo])

  // AC6: Setup accessibility features when modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError('')
      setAttempts(0)
      setRateLimitInfo(null)
      setShowPassword(false)
      
      // Setup focus trap
      setupFocusTrap()
      
      // Focus password input after modal renders
      const focusTimeout = setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus()
        }
      }, 100)
      
      // Setup keyboard event listeners
      document.addEventListener('keydown', handleKeyDown)
      
      // Prevent body scroll and set aria-hidden
      document.body.style.overflow = 'hidden'
      const mainContent = document.querySelector('main')
      if (mainContent) {
        mainContent.setAttribute('aria-hidden', 'true')
      }

      // Announce modal opening to screen readers
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      announcement.textContent = 'プロジェクトアクセス認証ダイアログが開きました'
      document.body.appendChild(announcement)
      
      return () => {
        clearTimeout(focusTimeout)
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'unset'
        if (mainContent) {
          mainContent.removeAttribute('aria-hidden')
        }
        document.body.removeChild(announcement)
      }
    } else {
      document.body.style.overflow = 'unset'
      const mainContent = document.querySelector('main')
      if (mainContent) {
        mainContent.removeAttribute('aria-hidden')
      }
    }
  }, [isOpen, setupFocusTrap, handleKeyDown])

  // AC7: Enhanced error parsing with detailed rate limiting info
  const parseErrorResponse = (errorMessage: string) => {
    try {
      // Enhanced patterns for rate limiting detection
      const patterns = {
        attemptsRemaining: /(?:(\d+)\s*(?:attempts?|試行)\s*remaining)|(?:残り\s*(\d+)\s*回)/i,
        lockout: /try\s*again\s*in\s*(\d+)\s*(second|minute|hour)s?|(\d+)(秒|分|時間)後に再試行/i,
        maxAttempts: /maximum\s*of\s*(\d+)\s*attempts|最大\s*(\d+)\s*回/i,
        totalAttempts: /(\d+)\s*of\s*(\d+)\s*attempts\s*used|(\d+)\/(\d+)\s*回使用/i
      }
      
      // Parse attempts remaining
      const attemptsMatch = errorMessage.match(patterns.attemptsRemaining)
      const remaining = attemptsMatch ? parseInt(attemptsMatch[1] || attemptsMatch[2]) : 0

      // Parse lockout duration
      const lockoutMatch = errorMessage.match(patterns.lockout)
      let lockoutUntil: number | undefined
      let lockoutDuration: string | undefined
      
      if (lockoutMatch) {
        const time = parseInt(lockoutMatch[1] || lockoutMatch[3])
        const unit = lockoutMatch[2] || lockoutMatch[4]
        
        let multiplier = 1
        if (unit === 'minute' || unit === '分') multiplier = 60
        else if (unit === 'hour' || unit === '時間') multiplier = 3600
        
        lockoutUntil = Date.now() + (time * multiplier * 1000)
        lockoutDuration = `${time}${unit === 'second' ? '秒' : unit === 'minute' ? '分' : '時間'}`
      }

      // Parse maximum attempts
      const maxAttemptsMatch = errorMessage.match(patterns.maxAttempts)
      const maxAttempts = maxAttemptsMatch ? parseInt(maxAttemptsMatch[1] || maxAttemptsMatch[2]) : 5

      // Parse total attempts used
      const totalAttemptsMatch = errorMessage.match(patterns.totalAttempts)
      const totalAttempts = totalAttemptsMatch ? 
        parseInt(totalAttemptsMatch[1] || totalAttemptsMatch[3]) : attempts + 1

      const newRateLimitInfo: RateLimitInfo = {
        attemptsRemaining: Math.max(0, remaining),
        maxAttempts,
        totalAttempts,
        lockoutUntil,
        lockoutDuration
      }

      if (lockoutUntil) {
        newRateLimitInfo.nextAttemptIn = Math.ceil((lockoutUntil - Date.now()) / 1000)
        startCountdownTimer(lockoutUntil)
      }

      setRateLimitInfo(newRateLimitInfo)

    } catch (e) {
      console.warn('Could not parse rate limit info from error:', e)
      // Fallback rate limiting info
      setRateLimitInfo({
        attemptsRemaining: Math.max(0, 5 - attempts - 1),
        maxAttempts: 5,
        totalAttempts: attempts + 1
      })
    }
  }

  // AC7: Enhanced countdown timer for lockout period
  const startCountdownTimer = (lockoutUntil: number) => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
    }

    const timer = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((lockoutUntil - now) / 1000))
      
      setRemainingTime(remaining)
      
      if (remaining <= 0) {
        clearInterval(timer)
        setCountdownTimer(null)
        setRateLimitInfo(prev => prev ? { ...prev, lockoutUntil: undefined, nextAttemptIn: 0 } : null)
        
        // Announce to screen readers that lockout has ended
        const announcement = document.createElement('div')
        announcement.setAttribute('aria-live', 'polite')
        announcement.className = 'sr-only'
        announcement.textContent = 'セキュリティ制限が解除されました。再試行できます。'
        document.body.appendChild(announcement)
        setTimeout(() => document.body.removeChild(announcement), 3000)
      }
    }, 1000)

    setCountdownTimer(timer)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }
    }
  }, [countdownTimer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!project || !password.trim()) {
      return
    }

    // Check if still in lockout
    if (rateLimitInfo?.lockoutUntil && Date.now() < rateLimitInfo.lockoutUntil) {
      const remainingSeconds = Math.ceil((rateLimitInfo.lockoutUntil - Date.now()) / 1000)
      setError(`アカウントがロックされています。あと${remainingSeconds}秒後に再試行してください。`)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await selectProject(project.id, password.trim())
      
      // Announce success to screen readers
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.className = 'sr-only'
      announcement.textContent = 'プロジェクト認証に成功しました'
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 3000)
      
      onSuccess?.(project)
      onClose()
    } catch (error: any) {
      setAttempts(prev => prev + 1)
      
      // Parse error message for enhanced rate limiting info
      parseErrorResponse(error.message || '')
      
      // AC7: Enhanced error messages with better user guidance
      let errorMessage = ''
      
      if (error.message?.includes('Too many')) {
        errorMessage = 'セキュリティ制限: 試行回数が上限に達しました。一時的にアクセスが制限されています。'
      } else if (error.message?.includes('Invalid password')) {
        const remaining = rateLimitInfo?.attemptsRemaining ?? (5 - attempts - 1)
        if (remaining > 0) {
          errorMessage = `パスワードが正しくありません。残り ${remaining} 回まで試行可能です。`
        } else {
          errorMessage = 'パスワードが正しくありません。セキュリティ制限により一時的にアクセスが制限されました。'
        }
      } else if (error.message?.includes('locked') || error.message?.includes('rate limit')) {
        errorMessage = 'セキュリティ制限により一時的にアクセスが制限されています。しばらく時間をおいてから再度お試しください。'
      } else {
        errorMessage = error.message || '認証に失敗しました。パスワードをご確認の上、再度お試しください。'
      }

      setError(errorMessage)

      // Announce error to screen readers
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'assertive')
      announcement.className = 'sr-only'
      announcement.textContent = `認証エラー: ${errorMessage}`
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 5000)

    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
    
    // Announce to screen readers
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.className = 'sr-only'
    announcement.textContent = showPassword ? 'パスワードを隠しました' : 'パスワードを表示しました'
    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 2000)
  }

  // AC7: Format remaining time for display
  const formatRemainingTime = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      return `${hours}時間${mins > 0 ? mins + '分' : ''}`
    } else if (seconds >= 60) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}分${secs > 0 ? secs + '秒' : ''}`
    } else {
      return `${seconds}秒`
    }
  }

  if (!isOpen || !project) {
    return null
  }

  return (
    <>
      {/* AC6: Enhanced overlay with proper ARIA attributes */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading) {
            onClose()
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        {/* AC6: Enhanced modal with focus trap */}
        <div 
          ref={modalRef}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg 
                  className="w-6 h-6 text-blue-600 dark:text-blue-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 
                  id="modal-title"
                  className="text-xl font-semibold text-gray-900 dark:text-white"
                >
                  プロジェクトアクセス認証
                </h2>
                <p 
                  id="modal-description"
                  className="text-sm text-gray-600 dark:text-gray-300 mt-1"
                >
                  セキュアなプロジェクトにアクセスするにはパスワードが必要です
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
              aria-label="モーダルを閉じる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Project Info */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700">
                  <span className="text-2xl" role="img" aria-label="保護されたプロジェクト">🔐</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    パスワード保護プロジェクト
                  </p>
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  label="パスワード"
                  placeholder="プロジェクトのパスワードを入力してください"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={error}
                  required
                  disabled={isLoading}
                  helperText="認証に成功すると、24時間有効なアクセストークンが生成されます"
                  className="pr-12"
                  aria-describedby="password-help rate-limit-info"
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none rounded"
                  disabled={isLoading}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* AC7: Enhanced Rate Limiting Info */}
            {(attempts > 0 || rateLimitInfo) && (
              <div 
                id="rate-limit-info"
                className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-semibold mb-1">セキュリティ制限</p>
                    <p className="mb-2">
                      悪意のあるアクセスを防ぐため、パスワード試行回数に制限があります。
                    </p>
                    <div className="space-y-1">
                      {rateLimitInfo?.attemptsRemaining !== undefined && (
                        <p>
                          • 残り試行回数: 
                          <span className={`font-medium ml-1 ${rateLimitInfo.attemptsRemaining === 0 ? 'text-red-700 dark:text-red-300' : ''}`}>
                            {rateLimitInfo.attemptsRemaining}回
                          </span>
                          {rateLimitInfo.maxAttempts && (
                            <span className="text-amber-700 dark:text-amber-300 ml-1">
                              (最大 {rateLimitInfo.maxAttempts} 回)
                            </span>
                          )}
                        </p>
                      )}
                      {rateLimitInfo?.totalAttempts && (
                        <p>• 使用済み試行回数: <span className="font-medium">{rateLimitInfo.totalAttempts}回</span></p>
                      )}
                      <p>• 制限: <span className="font-medium">15分間に5回まで</span></p>
                      {rateLimitInfo?.lockoutUntil && remainingTime > 0 && (
                        <div className="text-red-700 dark:text-red-300 font-medium">
                          <p>• 一時的にロックされています</p>
                          <p>• 次回試行可能まで: <span className="tabular-nums">{formatRemainingTime(remainingTime)}</span></p>
                          {rateLimitInfo.lockoutDuration && (
                            <p className="text-xs mt-1">ロック期間: {rateLimitInfo.lockoutDuration}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Note */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p>
                  認証に成功すると、安全な暗号化されたトークンがデバイスに保存され、24時間有効です。
                  バックグラウンドで自動的に更新されます。
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="min-w-[100px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                キャンセル
              </Button>
              <Button
                ref={submitButtonRef}
                type="submit"
                loading={isLoading}
                disabled={
                  !password.trim() || 
                  isLoading || 
                  (rateLimitInfo?.lockoutUntil && Date.now() < rateLimitInfo.lockoutUntil)
                }
                className="min-w-[100px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-describedby={rateLimitInfo?.lockoutUntil ? "rate-limit-info" : undefined}
              >
                {isLoading ? '認証中...' : '認証する'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}