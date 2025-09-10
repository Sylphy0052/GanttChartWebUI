'use client';

import React from 'react';
import { IssueStatus } from '../../types/issue';
import { getProgressBarColor, getProgressBackgroundColor } from '../../utils/gantt-colors';

export interface ProgressBarProps {
  progress: number; // 0-100
  status: IssueStatus;
  height?: number;
  className?: string;
  animated?: boolean;
  showPercentage?: boolean;
}

/**
 * Issue進捗率視覚化コンポーネント
 * TaskBar内部に表示される内部プログレスバー
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  height = 24,
  className = '',
  animated = true,
  showPercentage = false,
}) => {
  // 進捗値を0-100に正規化
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  
  // 色の計算
  const progressColor = getProgressBarColor(status);
  const backgroundColor = getProgressBackgroundColor(status);

  // プログレスバーのスタイル
  const containerStyle: React.CSSProperties = {
    height: `${height}px`,
    backgroundColor: backgroundColor,
    borderRadius: '3px',
    overflow: 'hidden',
    position: 'relative',
  };

  const progressStyle: React.CSSProperties = {
    width: `${normalizedProgress}%`,
    height: '100%',
    backgroundColor: progressColor,
    transition: animated ? 'width 0.3s ease-in-out' : 'none',
    borderRadius: '3px',
  };

  // 進捗パーセンテージのスタイル
  const percentageStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '10px',
    fontWeight: 'bold',
    color: normalizedProgress > 50 ? '#ffffff' : '#374151',
    textShadow: normalizedProgress > 50 ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none',
    pointerEvents: 'none',
    zIndex: 10,
  };

  return (
    <div 
      className={`progress-bar-container ${className}`} 
      style={containerStyle}
      title={`進捗: ${normalizedProgress}%`}
    >
      {/* 進捗バー本体 */}
      <div 
        className="progress-bar-fill"
        style={progressStyle}
      />
      
      {/* 進捗パーセンテージ表示 */}
      {showPercentage && (
        <div style={percentageStyle}>
          {Math.round(normalizedProgress)}%
        </div>
      )}

      {/* 完了状態のチェックマーク */}
      {normalizedProgress >= 100 && status === 'done' && (
        <div 
          className="absolute top-1/2 right-1 transform -translate-y-1/2 text-white"
          style={{ fontSize: '10px', zIndex: 15 }}
        >
          ✓
        </div>
      )}

      {/* アニメーション効果（オプション） */}
      {animated && normalizedProgress > 0 && (
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
            animation: 'progress-shimmer 2s infinite',
            width: `${normalizedProgress}%`,
          }}
        />
      )}

      {/* アニメーション用CSS（インライン定義） */}
      <style jsx>{`
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;