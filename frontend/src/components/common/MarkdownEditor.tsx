'use client';

import React, { useState, useMemo } from 'react';
import MarkdownIt from "markdown-it";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

// markdown-itインスタンスを作成（カスタム設定付き）
const md = new MarkdownIt({
  html: true,        // HTMLタグを有効化
  linkify: true,     // URLを自動的にリンクに変換
  typographer: true, // タイポグラフィー記号の変換を有効化
  breaks: true,      // 改行を<br>に変換
});

// カスタムレンダリングルールを追加してTailwind CSSクラスを適用
md.renderer.rules.heading_open = (tokens, idx) => {
  const token = tokens[idx];
  const level = token.tag.slice(1); // h1 -> 1, h2 -> 2, etc.
  const classes: Record<string, string> = {
    '1': 'text-2xl font-bold text-gray-900 mb-4',
    '2': 'text-xl font-semibold text-gray-900 mb-3',
    '3': 'text-lg font-semibold text-gray-900 mb-2',
    '4': 'text-base font-semibold text-gray-900 mb-1',
    '5': 'text-sm font-semibold text-gray-900 mb-1',
    '6': 'text-xs font-semibold text-gray-900 mb-1',
  };
  return `<${token.tag} class="${classes[level] || ''}">`;
};

md.renderer.rules.strong_open = () => '<strong class="font-semibold text-gray-900">';
md.renderer.rules.em_open = () => '<em class="italic text-gray-800">';
md.renderer.rules.code_inline = (tokens, idx) => {
  const token = tokens[idx];
  const code = md.utils.escapeHtml(token.content);
  return `<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-900">${code}</code>`;
};

md.renderer.rules.link_open = (tokens, idx) => {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');
  const href = hrefIndex >= 0 ? token.attrs![hrefIndex][1] : '#';
  return `<a href="${href}" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">`;
};

md.renderer.rules.bullet_list_open = () => '<ul class="ml-4 list-disc space-y-0 mb-2">';
md.renderer.rules.ordered_list_open = () => '<ol class="ml-4 list-decimal space-y-0 mb-2">';
md.renderer.rules.list_item_open = () => '<li class="text-gray-800">';

// コードブロックのレンダリング
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const code = md.utils.escapeHtml(token.content);
  const lang = token.info || '';
  return `<pre class="bg-gray-100 rounded p-3 overflow-x-auto mb-4"><code class="text-sm font-mono text-gray-900"${lang ? ` data-lang="${lang}"` : ''}>${code}</code></pre>`;
};

// 段落のレンダリング
md.renderer.rules.paragraph_open = () => '<p class="text-gray-800 mb-2">';

// テーブルのレンダリング
md.renderer.rules.table_open = () => '<table class="min-w-full divide-y divide-gray-200 mb-4">';
md.renderer.rules.thead_open = () => '<thead class="bg-gray-50">';
md.renderer.rules.tbody_open = () => '<tbody class="bg-white divide-y divide-gray-200">';
md.renderer.rules.tr_open = () => '<tr>';
md.renderer.rules.th_open = () => '<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">';
md.renderer.rules.td_open = () => '<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">';

// 引用のレンダリング
md.renderer.rules.blockquote_open = () => '<blockquote class="border-l-4 border-gray-300 pl-4 py-1 mb-4">';

// MarkdownEditor Component (Updated)
const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Markdownで入力してください',
  disabled = false,
  rows = 8,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  
  // パフォーマンス向上のためのメモ化
  const renderedHTML = useMemo(() => {
    if (!value) return '';
    try {
      return md.render(value);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return '<p class="text-red-600">Markdownのレンダリングに失敗しました</p>';
    }
  }, [value]);

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'edit'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'preview'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          プレビュー
        </button>
      </div>

      {/* コンテンツエリア */}
      <div className="p-0">
        {activeTab === 'edit' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className="w-full px-3 py-2 text-gray-900 bg-white border-0 resize-none focus:outline-none focus:ring-0"
          />
        ) : (
          <div className="px-3 py-2 min-h-[200px] bg-white text-gray-800">
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderedHTML }}
              />
            ) : (
              <div className="text-gray-500 italic">
                プレビューするコンテンツがありません
              </div>
            )}
          </div>
        )}
      </div>

      {/* フッター（Markdownヘルプ） */}
      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span>
            {'Markdown対応: # 見出し, **太字**, *斜体*, `コード`, [リンク](url), - リスト, \\> 引用, | テーブル |'}
          </span>
          {activeTab === 'edit' && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              プレビューで確認
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;
