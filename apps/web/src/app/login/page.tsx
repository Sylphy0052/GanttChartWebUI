'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormActions, FormError } from '@/components/ui/form'
import { useAuth } from '@/stores/auth.store'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuth()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/issues')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    // Clear error when component mounts
    clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const setDemoCredentials = (email: string, password: string) => {
    setFormData({ email, password })
    clearError()
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">ログイン済みです。リダイレクト中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Gantt Chart WebUI
            </h1>
          </Link>
          <p className="text-gray-600">
            アカウントにログインしてください
          </p>
        </div>

        <Form
          title=""
          onSubmit={handleSubmit}
          className="mt-8"
        >
          <FormError message={error || undefined} />
          
          <FormField>
            <Input
              label="メールアドレス"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="user@example.com"
            />
          </FormField>

          <FormField>
            <Input
              label="パスワード"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              placeholder="パスワードを入力"
            />
          </FormField>

          <FormActions className="flex-col space-y-4 space-x-0">
            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              disabled={!formData.email || !formData.password}
            >
              ログイン
            </Button>
            
            <div className="flex space-x-2">
              <Link href="/" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  ホームに戻る
                </Button>
              </Link>
              <Link href="/issues" className="flex-1">
                <Button type="button" variant="ghost" className="w-full">
                  ゲストとして続行
                </Button>
              </Link>
            </div>
          </FormActions>
        </Form>

        {/* Demo accounts section */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-center">
            デモアカウント
          </h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setDemoCredentials('admin@example.com', 'admin123')}
              className="w-full text-left p-3 rounded border hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">管理者アカウント</div>
              <div className="text-sm text-gray-600">admin@example.com / admin123</div>
            </button>
            
            <button
              type="button"
              onClick={() => setDemoCredentials('user@example.com', 'user123')}
              className="w-full text-left p-3 rounded border hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">一般ユーザーアカウント</div>
              <div className="text-sm text-gray-600">user@example.com / user123</div>
            </button>
            
            <button
              type="button"
              onClick={() => setDemoCredentials('demo@example.com', 'demo123')}
              className="w-full text-left p-3 rounded border hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">デモアカウント</div>
              <div className="text-sm text-gray-600">demo@example.com / demo123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}