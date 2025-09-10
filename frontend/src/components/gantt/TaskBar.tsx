'use client';

import React, { useState } from 'react';
import { Issue } from '../../types/issue';
import { getTaskBarColor, getTaskTextColor, getBlockedIssueStyles } from '../../utils/gantt-colors';
import ProgressBar from './ProgressBar';

export interface TaskBarProps {
  issue: Issue;
  startDate: Date;
  endDate: Date;
  width: number;
  height?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  showLabel?: boolean;
  showProgress?: boolean;
  readOnly?: boolean;
}

/**
 * Issue期間バー表示コンポーネント
 * 横バー形式でIssueの期間とステータスを視覚化
 */
const TaskBar: React.FC<TaskBarProps> = ({
  issue,
  startDate,
  endDate,
  width,
  height = 24,
  onClick,
  onDoubleClick,
  className = '',
  showLabel = true,
  showProgress = true,
  readOnly = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // 日付の妥当性チェック
  if (!startDate || !endDate || endDate <= startDate) {
    return null;
  }

  // 色の計算
  const barColor = getTaskBarColor(issue.status, isHovered);
  const textColor = getTaskTextColor(issue.status);
  const blockedStyles = getBlockedIssueStyles(issue.is_blocked);

  // バーのスタイル
  const barStyle: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: barColor,
    color: textColor,
    borderRadius: '3px',
    position: 'relative',
    cursor: readOnly ? 'default' : 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isHovered 
      ? '0 2px 4px rgba(0, 0, 0, 0.15)' 
      : '0 1px 2px rgba(0, 0, 0, 0.1)',
    ...blockedStyles,
  };

  // ブロック状態の追加スタイル
  if (issue.is_blocked) {
    barStyle.backgroundImage = blockedStyles['--gantt-blocked-overlay'];
    barStyle.border = blockedStyles['--gantt-blocked-border'];
  }

  // ラベル表示用のテキスト
  const displayText = showLabel 
    ? (issue.wbs_number ? `${issue.wbs_number} ${issue.title}` : issue.title)
    : '';

  // 期間情報の表示
  const durationText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  return (
    <div
      className={`task-bar-container ${className}`}
      style={barStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${displayText}\n期間: ${durationText}\n進捗: ${issue.progress_pct}%\nステータス: ${getStatusDisplayName(issue.status)}${issue.is_blocked ? '\n⚠️ ブロック中' : ''}`}
    >
      {/* 進捗バー（内部プログレスバー） */}
      {showProgress && (
        <ProgressBar
          progress={issue.progress_pct}
          status={issue.status}
          height={height}
          className="absolute inset-0"
        />
      )}

      {/* タスク名・期間ラベル */}
      {showLabel && width > 60 && (
        <div 
          className="absolute inset-0 flex items-center px-2 text-xs font-medium truncate z-10"
          style={{ color: textColor }}
        >
          <span className="truncate max-w-full">
            {displayText}
          </span>
        </div>
      )}

      {/* ブロック状態インジケーター */}
      {issue.is_blocked && (
        <div 
          className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-white transform translate-x-1 -translate-y-1 z-20"
          title="ブロック中"
        >
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>
      )}

      {/* ホバー時の詳細情報 */}
      {isHovered && !readOnly && (
        <div className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-30 pointer-events-none">
          {issue.assignee && `担当: ${issue.assignee} | `}
          進捗: {issue.progress_pct}%
          {issue.effort_hours && ` | 工数: ${issue.effort_hours}h`}
        </div>
      )}
    </div>
  );
};

/**
 * ステータスの表示名を取得
 */
function getStatusDisplayName(status: string): string {
  const statusMap: Record<string, string> = {
    'open': '未着手',
    'in_progress': '進行中',
    'done': '完了',
    'blocked': 'ブロック中',
  };
  
  return statusMap[status] || status;
}

export default TaskBar;