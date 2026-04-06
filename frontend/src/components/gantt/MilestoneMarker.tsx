'use client';

import React, { useState } from 'react';
import { Issue } from '../../types/issue';
import { getMilestoneColor, getTaskTextColor, getBlockedIssueStyles } from '../../utils/gantt-colors';

export interface MilestoneMarkerProps {
  issue: Issue;
  date: Date;
  size?: number;
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  className?: string;
  showLabel?: boolean;
  readOnly?: boolean;
}

/**
 * Milestone型Issue菱形マーカー表示コンポーネント
 * マイルストーン（単日または短期間）のIssueを菱形で表示
 */
const MilestoneMarker: React.FC<MilestoneMarkerProps> = ({
  issue,
  date,
  size = 16,
  onClick,
  onDoubleClick,
  onContextMenu,
  className = '',
  showLabel = true,
  readOnly = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // 日付の妥当性チェック
  if (!date) {
    return null;
  }

  // 色の計算
  const milestoneColor = getMilestoneColor(issue.status, isHovered);
  const textColor = getTaskTextColor(issue.status);
  const blockedStyles = getBlockedIssueStyles(issue.is_blocked);

  // 菱形のスタイル（45度回転した正方形）
  const diamondStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: milestoneColor,
    transform: 'rotate(45deg)',
    position: 'relative',
    cursor: readOnly ? 'default' : 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isHovered 
      ? '0 3px 6px rgba(0, 0, 0, 0.2)' 
      : '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '2px',
  };

  // ブロック状態の追加スタイル
  if (issue.is_blocked) {
    diamondStyle.backgroundImage = blockedStyles['--gantt-blocked-overlay'];
    diamondStyle.border = blockedStyles['--gantt-blocked-border'];
  }

  // コンテナのスタイル
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: `${size + 20}px`, // ラベル用スペース
  };

  // ラベル表示用のテキスト
  const displayText = showLabel 
    ? (issue.wbs_number ? `${issue.wbs_number} ${issue.title}` : issue.title)
    : '';

  // 日付情報の表示
  const dateText = date.toLocaleDateString();

  return (
    <div 
      className={`milestone-marker-container ${className}`}
      style={containerStyle}
    >
      {/* 菱形マーカー本体 */}
      <div
        className="milestone-diamond"
        style={diamondStyle}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`${displayText}\n日付: ${dateText}\n進捗: ${issue.progress_pct}%\nステータス: ${getStatusDisplayName(issue.status)}${issue.is_blocked ? '\n⚠️ ブロック中' : ''}`}
      >
        {/* 内部コンテンツ（進捗・完了インジケーター） */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            transform: 'rotate(-45deg)', // 菱形の回転を打ち消し
            fontSize: `${Math.max(8, size * 0.4)}px`,
            color: textColor,
            fontWeight: 'bold',
          }}
        >
          {issue.status === 'done' && '✓'}
          {issue.is_blocked && '!'}
          {issue.status === 'in_progress' && issue.progress_pct >= 50 && '●'}
        </div>
      </div>

      {/* マイルストーン名ラベル */}
      {showLabel && displayText && (
        <div 
          className="milestone-label mt-1 text-xs font-medium text-center px-1"
          style={{
            color: '#374151',
            maxWidth: `${Math.max(80, size * 5)}px`,
            lineHeight: '1.2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={displayText}
        >
          {displayText}
        </div>
      )}

      {/* ブロック状態インジケーター */}
      {issue.is_blocked && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white z-20"
          title="ブロック中"
        >
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>
      )}

      {/* ホバー時の詳細情報 */}
      {isHovered && !readOnly && (
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-30 pointer-events-none">
          マイルストーン: {dateText}
          {issue.assignee && ` | 担当: ${issue.assignee}`}
          <br />
          進捗: {issue.progress_pct}%
          {issue.effort_hours && ` | 工数: ${issue.effort_hours}h`}
        </div>
      )}

      {/* 接続線（オプション - 親子関係を示す場合） */}
      {issue.parent_id && (
        <div 
          className="absolute top-0 left-1/2 w-px bg-gray-300 transform -translate-x-1/2"
          style={{ height: '20px', top: '-20px' }}
        />
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

export default MilestoneMarker;