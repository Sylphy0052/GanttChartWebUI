'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Comment, CreateCommentDto, UpdateCommentDto } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { commentsApi, ApiError } from '@/lib/api';
import MarkdownEditor from '@/components/common/MarkdownEditor';
import MarkdownIt from 'markdown-it';

interface CommentSectionProps {
  projectId: string;
  issueId: string;
  comments: Comment[];
  userRole: ProjectRole;
}

interface EditingComment {
  id: string;
  body_md: string;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  projectId,
  issueId,
  comments: initialComments,
  userRole,
}) => {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<EditingComment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // markdown-itインスタンスを作成（カスタム設定付き）
  const md = useMemo(() => {
    const markdownIt = new MarkdownIt({
      html: true,        // HTMLタグを有効化
      linkify: true,     // URLを自動的にリンクに変換
      typographer: true, // タイポグラフィー記号の変換を有効化
      breaks: true,      // 改行を<br>に変換
    });

    // カスタムレンダリングルールを追加してTailwind CSSクラスを適用
    markdownIt.renderer.rules.heading_open = (tokens, idx) => {
      const token = tokens[idx];
      const level = token.tag.slice(1);
      const classes: Record<string, string> = {
        '1': 'text-lg font-bold text-gray-900 mb-2',
        '2': 'text-base font-semibold text-gray-900 mb-2',
        '3': 'text-sm font-semibold text-gray-900 mb-1',
        '4': 'text-sm font-medium text-gray-900 mb-1',
        '5': 'text-xs font-medium text-gray-900 mb-1',
        '6': 'text-xs font-medium text-gray-900 mb-1',
      };
      return `<${token.tag} class="${classes[level] || ''}">`;
    };

    markdownIt.renderer.rules.strong_open = () => '<strong class="font-semibold text-gray-900">';
    markdownIt.renderer.rules.em_open = () => '<em class="italic text-gray-800">';
    markdownIt.renderer.rules.code_inline = (tokens, idx) => {
      const token = tokens[idx];
      const code = markdownIt.utils.escapeHtml(token.content);
      return `<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-900">${code}</code>`;
    };

    markdownIt.renderer.rules.link_open = (tokens, idx) => {
      const token = tokens[idx];
      const hrefIndex = token.attrIndex('href');
      const href = hrefIndex >= 0 ? token.attrs![hrefIndex][1] : '#';
      return `<a href="${href}" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">`;
    };

    markdownIt.renderer.rules.bullet_list_open = () => '<ul class="ml-4 list-disc space-y-0 mb-2">';
    markdownIt.renderer.rules.ordered_list_open = () => '<ol class="ml-4 list-decimal space-y-0 mb-2">';
    markdownIt.renderer.rules.list_item_open = () => '<li class="text-gray-800">';

    // コードブロックのレンダリング
    markdownIt.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      const code = markdownIt.utils.escapeHtml(token.content);
      const lang = token.info || '';
      return `<pre class="bg-gray-100 rounded p-2 overflow-x-auto mb-2"><code class="text-xs font-mono text-gray-900"${lang ? ` data-lang="${lang}"` : ''}>${code}</code></pre>`;
    };

    // 段落のレンダリング
    markdownIt.renderer.rules.paragraph_open = () => '<p class="text-gray-800 mb-2">';

    // テーブルのレンダリング
    markdownIt.renderer.rules.table_open = () => '<table class="min-w-full divide-y divide-gray-200 mb-4 border border-gray-200 rounded-lg overflow-hidden">';
    markdownIt.renderer.rules.thead_open = () => '<thead class="bg-gray-50">';
    markdownIt.renderer.rules.tbody_open = () => '<tbody class="bg-white divide-y divide-gray-200">';
    markdownIt.renderer.rules.tr_open = () => '<tr>';
    markdownIt.renderer.rules.th_open = () => '<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">';
    markdownIt.renderer.rules.td_open = () => '<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 last:border-r-0">';

    // 引用のレンダリング
    markdownIt.renderer.rules.blockquote_open = () => '<blockquote class="border-l-4 border-gray-300 pl-4 py-1 mb-2 bg-gray-50">';

    return markdownIt;
  }, []);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    try {
      return md.render(markdown);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return '<p class="text-red-600">Markdownのレンダリングに失敗しました</p>';
    }
  };

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const commentData: CreateCommentDto = {
        body_md: newComment.trim(),
      };

      const createdComment = await commentsApi.create(projectId, issueId, commentData);
      setComments(prev => [createdComment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
      if (error instanceof ApiError) {
        setError(`コメントの投稿に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingComment({
      id: comment.id,
      body_md: comment.body_md,
    });
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingComment || !editingComment.body_md.trim()) {
      return;
    }

    try {
      setError(null);

      const updateData: UpdateCommentDto = {
        body_md: editingComment.body_md.trim(),
      };

      const updatedComment = await commentsApi.update(projectId, issueId, commentId, updateData);
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId ? updatedComment : comment
        )
      );
      setEditingComment(null);
    } catch (error) {
      console.error('Failed to update comment:', error);
      if (error instanceof ApiError) {
        setError(`コメントの更新に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。');
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('このコメントを削除しますか？')) {
      return;
    }

    try {
      setError(null);
      await commentsApi.delete(projectId, issueId, commentId);
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
      if (error instanceof ApiError) {
        setError(`コメントの削除に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        コメント ({comments.length})
      </h2>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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

      {/* 新規コメントフォーム */}
      {userRole === 'editor' && (
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              新しいコメント (Markdown)
            </label>
            <MarkdownEditor
              value={newComment}
              onChange={setNewComment}
              placeholder="コメントをMarkdown形式で入力してください..."
              disabled={isSubmitting}
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
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
                  投稿中...
                </>
              ) : (
                'コメント投稿'
              )}
            </button>
          </div>
        </form>
      )}

      {/* コメント一覧 */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="mt-2 text-gray-500">まだコメントがありません</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{comment.author}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(comment.created_at)}
                      {comment.is_edited && (
                        <span className="ml-2 text-gray-400">(編集済み)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* 編集・削除ボタン（Editor権限時のみ） */}
                {userRole === 'editor' && (
                  <div className="flex space-x-2">
                    {editingComment?.id === comment.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateComment(comment.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditComment(comment)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* コメント本文 */}
              {editingComment?.id === comment.id ? (
                <MarkdownEditor
                  value={editingComment.body_md}
                  onChange={(value) => setEditingComment({ ...editingComment, body_md: value })}
                  rows={4}
                />
              ) : (
                <div
                  className="prose max-w-none text-gray-900"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body_md) }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentSection;