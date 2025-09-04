'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormActions, FormError } from '@/components/ui/form'
import { useIssues } from '@/stores/issues.store'
import { useAuth } from '@/stores/auth.store'
import { CreateIssueData, IssueStatus, IssueType, EstimateUnit } from '@/types/issue'

const statusOptions: { value: IssueStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' }
]

const typeOptions: { value: IssueType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'spike', label: 'Spike' },
  { value: 'chore', label: 'Chore' }
]

const unitOptions: { value: EstimateUnit; label: string }[] = [
  { value: 'h', label: '時間' },
  { value: 'd', label: '日' }
]

export default function CreateIssuePage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { createIssue, isLoading, error, clearError } = useIssues()
  
  const [formData, setFormData] = useState<CreateIssueData>({
    projectId: 'default-project',
    title: '',
    description: '',
    status: 'todo',
    type: 'feature',
    priority: 50,
    estimateValue: 1,
    estimateUnit: 'h',
    progress: 0,
    labels: []
  })
  
  const [labelInput, setLabelInput] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    clearError()
  }, [isAuthenticated, router, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const newIssue = await createIssue(formData)
      router.push(`/issues/${newIssue.id}`)
    } catch (error) {
      console.error('Create failed:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  const handleAddLabel = () => {
    if (labelInput.trim() && !formData.labels.includes(labelInput.trim())) {
      setFormData(prev => ({
        ...prev,
        labels: [...prev.labels, labelInput.trim()]
      }))
      setLabelInput('')
    }
  }

  const handleRemoveLabel = (labelToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddLabel()
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600">認証が必要です...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <Link href="/issues" className="text-sm text-gray-600 hover:text-gray-900">
              ← Issue一覧に戻る
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              新しいIssue作成
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Form onSubmit={handleSubmit}>
          <FormError message={error || undefined} />
          
          <FormField>
            <Input
              label="タイトル"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Issue のタイトル"
            />
          </FormField>

          <FormField>
            <label className="block text-sm font-medium text-gray-700">
              説明
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Issue の詳細説明"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField>
              <label className="block text-sm font-medium text-gray-700">
                ステータス <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField>
              <label className="block text-sm font-medium text-gray-700">
                タイプ <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField>
            <Input
              label="優先度 (1-100)"
              type="number"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              min={1}
              max={100}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField>
              <Input
                label="見積もり工数"
                type="number"
                name="estimateValue"
                value={formData.estimateValue}
                onChange={handleChange}
                min={0.1}
                step={0.1}
                required
              />
            </FormField>

            <FormField>
              <label className="block text-sm font-medium text-gray-700">
                単位 <span className="text-red-500">*</span>
              </label>
              <select
                name="estimateUnit"
                value={formData.estimateUnit}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {unitOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField>
              <Input
                label="開始日"
                type="date"
                name="startDate"
                value={formData.startDate || ''}
                onChange={handleChange}
              />
            </FormField>

            <FormField>
              <Input
                label="期限"
                type="date"
                name="dueDate"
                value={formData.dueDate || ''}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <FormField>
            <Input
              label="担当者ID"
              type="text"
              name="assigneeId"
              value={formData.assigneeId || ''}
              onChange={handleChange}
              placeholder="担当者のID"
            />
          </FormField>

          <FormField>
            <label className="block text-sm font-medium text-gray-700">
              ラベル
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="block w-full rounded-l-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="ラベルを入力"
              />
              <Button
                type="button"
                onClick={handleAddLabel}
                className="rounded-l-none"
                size="sm"
              >
                追加
              </Button>
            </div>
            {formData.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.labels.map((label, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(label)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </FormField>

          <FormActions>
            <Button
              type="submit"
              loading={isLoading}
              disabled={!formData.title.trim()}
              className="flex-1"
            >
              作成
            </Button>
            <Link href="/issues" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                キャンセル
              </Button>
            </Link>
          </FormActions>
        </Form>
      </div>
    </div>
  )
}