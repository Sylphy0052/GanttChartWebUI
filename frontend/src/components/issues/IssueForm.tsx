'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Issue, CreateIssueDto, UpdateIssueDto, IssueStatus } from '@/types/issue';
import { issuesApi, ApiError } from '@/lib/api';
import ParentIssueSelector from './ParentIssueSelector';
import MarkdownEditor from '@/components/common/MarkdownEditor';

interface IssueFormProps {
  mode: 'create' | 'edit';
  projectId: string;
  initialData?: Issue;
  onSubmit: (data: CreateIssueDto | UpdateIssueDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const statusOptions: Array<{ value: IssueStatus; label: string; color: string }> = [
  { value: 'open', label: 'オープン', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: '進行中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'done', label: '完了', color: 'bg-green-100 text-green-800' },
  { value: 'blocked', label: 'ブロック', color: 'bg-red-100 text-red-800' },
];

const IssueForm: React.FC<IssueFormProps> = ({
  mode,
  projectId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
}) => {
  const [formData, setFormData] = useState<CreateIssueDto | UpdateIssueDto>(() => {
    if (mode === 'edit' && initialData) {
      return {
        parent_id: initialData.parent_id,
        title: initialData.title,
        description_md: initialData.description_md || '',
        assignee: initialData.assignee || '',
        status: initialData.status,
        start_date: initialData.start_date ? 
          (typeof initialData.start_date === 'string' ? 
            initialData.start_date.split('T')[0] : 
            new Date(initialData.start_date).toISOString().split('T')[0]
          ) : '',
        end_date: initialData.end_date ? 
          (typeof initialData.end_date === 'string' ? 
            initialData.end_date.split('T')[0] : 
            new Date(initialData.end_date).toISOString().split('T')[0]
          ) : '',
        progress_pct: initialData.progress_pct,
        effort_hours: initialData.effort_hours,
        is_blocked: initialData.is_blocked,
        labels: initialData.labels,
      };
    }
    return {
      title: '',
      description_md: '',
      assignee: '',
      status: 'open',
      start_date: '',
      end_date: '',
      progress_pct: 0,
      effort_hours: undefined,
      is_blocked: false,
      labels: [],
    };
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [labelInput, setLabelInput] = useState('');
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  
  // 既存の担当者とラベルの提案用データ
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<string[]>([]);
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      errors.title = 'タイトルは必須です';
    }

    if (formData.progress_pct !== undefined && (formData.progress_pct < 0 || formData.progress_pct > 100)) {
      errors.progress_pct = '進捗率は0から100の間で入力してください';
    }

    if (formData.effort_hours !== undefined && formData.effort_hours < 0) {
      errors.effort_hours = '見積時間は0以上で入力してください';
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (startDate > endDate) {
        errors.end_date = '終了日は開始日以降の日付を選択してください';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // 日付フィールドの処理
      const submitData = { ...formData };
      if (submitData.start_date) {
        submitData.start_date = new Date(submitData.start_date).toISOString();
      } else {
        delete submitData.start_date;
      }
      if (submitData.end_date) {
        submitData.end_date = new Date(submitData.end_date).toISOString();
      } else {
        delete submitData.end_date;
      }

      await onSubmit(submitData);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  const handleInputChange = useCallback((field: keyof (CreateIssueDto | UpdateIssueDto), value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // フィールドが変更されたらそのフィールドの検証エラーをクリア
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [validationErrors]);

  const handleAddLabel = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      const newLabel = labelInput.trim();
      if (!formData.labels?.includes(newLabel)) {
        handleInputChange('labels', [...(formData.labels || []), newLabel]);
      }
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    handleInputChange('labels', formData.labels?.filter(label => label !== labelToRemove) || []);
  };

  // プロジェクトのIssue一覧を取得し、担当者・ラベルの提案データを作成
  useEffect(() => {
    const loadIssues = async () => {
      try {
        setIsLoadingIssues(true);
        const issues = await issuesApi.getAll(projectId);
        setAllIssues(issues);
        
        // 担当者一覧を専用APIから取得
        const assignees = await issuesApi.getAssignees(projectId);
        setAssigneeSuggestions(assignees);
        
        // 既存のラベルを収集（重複除去・空文字除去）
        const labels = [...new Set(
          issues
            .flatMap(issue => issue.labels || [])
            .filter(label => label && label.trim())
        )].sort();
        setLabelSuggestions(labels);
      } catch (error) {
        console.error('Failed to load issues:', error);
        setAllIssues([]);
        setAssigneeSuggestions([]);
        setLabelSuggestions([]);
      } finally {
        setIsLoadingIssues(false);
      }
    };

    if (projectId) {
      loadIssues();
    }
  }, [projectId]);

  const handleParentChange = useCallback((parentId: string | null) => {
    handleInputChange('parent_id', parentId);
  }, [handleInputChange]);

  // 担当者の選択・入力処理
  const handleAssigneeSelect = useCallback((assignee: string) => {
    handleInputChange('assignee', assignee);
    setShowAssigneeDropdown(false);
  }, [handleInputChange]);

  const handleAssigneeInputChange = useCallback((value: string) => {
    handleInputChange('assignee', value);
    setShowAssigneeDropdown(value.length > 0);
  }, [handleInputChange]);

  // ラベルのオートコンプリート処理
  const handleLabelSelect = useCallback((label: string) => {
    if (!formData.labels?.includes(label)) {
      handleInputChange('labels', [...(formData.labels || []), label]);
    }
    setLabelInput('');
    setShowLabelDropdown(false);
  }, [formData.labels, handleInputChange]);

  const handleLabelInputChange = useCallback((value: string) => {
    setLabelInput(value);
    setShowLabelDropdown(true);
  }, []);

  // 担当者の絞り込み
  const filteredAssignees = assigneeSuggestions.filter(assignee =>
    assignee.toLowerCase().includes((formData.assignee || '').toLowerCase())
  );

  // ラベルの絞り込み
  const filteredLabels = labelSuggestions.filter(label =>
    label.toLowerCase().includes(labelInput.toLowerCase()) &&
    !formData.labels?.includes(label)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg">
          <div className="px-8 py-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'create' ? 'Issue作成' : 'Issue編集'}
            </h1>
            <p className="mt-2 text-gray-600">
              {mode === 'create' ? '新しいIssueを作成します' : 'Issueの情報を編集します'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-red-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* 親Issue選択 */}
            <div>
              <ParentIssueSelector
                currentIssue={mode === 'edit' ? initialData : null}
                allIssues={allIssues || []}
                selectedParentId={formData.parent_id || null}
                onParentChange={handleParentChange}
                isLoading={isLoadingIssues}
                disabled={isLoading}
              />
            </div>

            {/* タイトル */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  validationErrors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Issueのタイトルを入力"
                disabled={isLoading}
              />
              {validationErrors.title && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
              )}
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明 (Markdown)
              </label>
              <MarkdownEditor
                value={formData.description_md || ''}
                onChange={(value) => handleInputChange('description_md', value)}
                placeholder="Issueの詳細説明をMarkdown形式で入力"
                disabled={isLoading}
                rows={8}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ステータス */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  ステータス
                </label>
                <select
                  id="status"
                  value={formData.status || 'open'}
                  onChange={(e) => handleInputChange('status', e.target.value as IssueStatus)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                >
                  {statusOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 担当者 */}
              <div className="relative">
                <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 mb-2">
                  担当者
                </label>
                <div className="relative">
                  <input
                    id="assignee"
                    type="text"
                    value={formData.assignee || ''}
                    onChange={(e) => handleAssigneeInputChange(e.target.value)}
                    onFocus={() => setShowAssigneeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowAssigneeDropdown(false), 150)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="担当者名を入力または選択"
                    disabled={isLoading}
                  />
                  {showAssigneeDropdown && assigneeSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredAssignees.slice(0, 5).map((assignee, index) => (
                        <div
                          key={index}
                          onClick={() => handleAssigneeSelect(assignee)}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-900"
                        >
                          {assignee}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 開始日 */}
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                  開始日
                </label>
                <input
                  id="start_date"
                  type="date"
                  value={typeof formData.start_date === 'string' ? formData.start_date : ''}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                />
              </div>

              {/* 終了日 */}
              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                  終了日
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={typeof formData.end_date === 'string' ? formData.end_date : ''}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    validationErrors.end_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                />
                {validationErrors.end_date && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.end_date}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 見積時間 */}
              <div>
                <label htmlFor="effort_hours" className="block text-sm font-medium text-gray-700 mb-2">
                  見積時間 (時間)
                </label>
                <input
                  id="effort_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.effort_hours || ''}
                  onChange={(e) => handleInputChange('effort_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    validationErrors.effort_hours ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="見積時間を入力"
                  disabled={isLoading}
                />
                {validationErrors.effort_hours && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.effort_hours}</p>
                )}
              </div>

              {/* 進捗率 */}
              <div>
                <label htmlFor="progress_pct" className="block text-sm font-medium text-gray-700 mb-2">
                  進捗率 (%)
                </label>
                <input
                  id="progress_pct"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress_pct || 0}
                  onChange={(e) => handleInputChange('progress_pct', parseInt(e.target.value) || 0)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    validationErrors.progress_pct ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                />
                {validationErrors.progress_pct && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.progress_pct}</p>
                )}
              </div>
            </div>

            {/* ブロック状態 */}
            <div>
              <div className="flex items-center">
                <input
                  id="is_blocked"
                  type="checkbox"
                  checked={formData.is_blocked || false}
                  onChange={(e) => handleInputChange('is_blocked', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="is_blocked" className="ml-2 block text-sm text-gray-900">
                  このIssueはブロック状態です
                </label>
              </div>
            </div>

            {/* ラベル */}
            <div>
              <label htmlFor="labels" className="block text-sm font-medium text-gray-700 mb-2">
                ラベル
              </label>
              <div className="space-y-2">
                {formData.labels && formData.labels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.labels.map((label, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(label)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          disabled={isLoading}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => handleLabelInputChange(e.target.value)}
                    onKeyDown={handleAddLabel}
                    onFocus={() => setShowLabelDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLabelDropdown(false), 150)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="ラベルを入力・選択してEnterキーまたはクリックで追加"
                    disabled={isLoading}
                  />
                  {showLabelDropdown && labelSuggestions.filter(label => !formData.labels?.includes(label)).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredLabels.slice(0, 5).map((label, index) => (
                        <div
                          key={index}
                          onClick={() => handleLabelSelect(label)}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-900 flex items-center"
                        >
                          <span className="inline-block w-3 h-3 bg-blue-100 rounded-full mr-2"></span>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {mode === 'create' ? '作成中...' : '更新中...'}
                  </div>
                ) : (
                  mode === 'create' ? '作成' : '更新'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default IssueForm;