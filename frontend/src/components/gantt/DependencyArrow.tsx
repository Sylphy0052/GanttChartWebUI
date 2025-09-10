'use client';

import React, { useState, useCallback } from 'react';
import { DependencyLine, DependencyLineOptions, isPointOnDependencyLine } from '../../utils/gantt-geometry';

export interface DependencyArrowProps {
  dependency: DependencyLine;
  options?: Partial<DependencyLineOptions>;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (dependency: DependencyLine) => void;
  onHover?: (dependency: DependencyLine | null) => void;
  className?: string;
}

/**
 * 単一依存関係矢印線コンポーネント
 * FS依存関係を矢印線で表示し、ホバー・クリック対応
 */
const DependencyArrow: React.FC<DependencyArrowProps> = ({
  dependency,
  options = {},
  isSelected = false,
  isHovered = false,
  onClick,
  onHover,
  className = '',
}) => {
  const [internalHover, setInternalHover] = useState(false);
  const isHoveredState = isHovered || internalHover;

  // 描画オプションのマージ
  const lineOptions = {
    arrowSize: 6,
    lineStrokeWidth: 2,
    lineColor: '#6b7280',
    hoverLineColor: '#3b82f6', 
    selectedLineColor: '#ef4444',
    ...options,
  };

  // 線の色を決定
  const getLineColor = (): string => {
    if (isSelected) return lineOptions.selectedLineColor;
    if (isHoveredState) return lineOptions.hoverLineColor;
    return lineOptions.lineColor;
  };

  // マウスイベントハンドラー
  const handleMouseEnter = useCallback(() => {
    setInternalHover(true);
    onHover?.(dependency);
  }, [dependency, onHover]);

  const handleMouseLeave = useCallback(() => {
    setInternalHover(false);
    onHover?.(null);
  }, [onHover]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(dependency);
  }, [dependency, onClick]);

  // 線の太さとスタイル
  const strokeWidth = isSelected ? lineOptions.lineStrokeWidth + 1 : lineOptions.lineStrokeWidth;
  const opacity = isHoveredState ? 0.9 : 0.7;

  // SVGスタイル
  const pathStyle: React.CSSProperties = {
    fill: 'none',
    stroke: getLineColor(),
    strokeWidth: strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    opacity: opacity,
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
  };

  // ホバー時の太い透明線（当たり判定用）
  const hitAreaStyle: React.CSSProperties = {
    fill: 'none',
    stroke: 'transparent',
    strokeWidth: Math.max(10, lineOptions.lineStrokeWidth * 3),
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    cursor: 'pointer',
  };

  return (
    <g
      className={`dependency-arrow ${className}`}
      data-dependency-id={dependency.id}
      data-predecessor={dependency.predecessorIssueId}
      data-successor={dependency.successorIssueId}
    >
      {/* 当たり判定用の太い透明線 */}
      <path
        d={dependency.path}
        style={hitAreaStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      
      {/* 実際の矢印線 */}
      <path
        d={dependency.path}
        style={pathStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* 選択時のハイライト効果 */}
      {isSelected && (
        <path
          d={dependency.path}
          style={{
            fill: 'none',
            stroke: lineOptions.selectedLineColor,
            strokeWidth: strokeWidth + 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            opacity: 0.3,
          }}
        />
      )}

      {/* ホバー時のラベル表示（依存関係の詳細） */}
      {isHoveredState && (
        <g className="dependency-label">
          {/* ラベル背景 */}
          <rect
            x={dependency.startPoint.x + (dependency.endPoint.x - dependency.startPoint.x) / 2 - 40}
            y={dependency.startPoint.y + (dependency.endPoint.y - dependency.startPoint.y) / 2 - 10}
            width="80"
            height="20"
            rx="4"
            fill="rgba(0, 0, 0, 0.8)"
            stroke="none"
          />
          
          {/* ラベルテキスト */}
          <text
            x={dependency.startPoint.x + (dependency.endPoint.x - dependency.startPoint.x) / 2}
            y={dependency.startPoint.y + (dependency.endPoint.y - dependency.startPoint.y) / 2 + 4}
            textAnchor="middle"
            fontSize="10"
            fill="white"
            fontWeight="500"
            pointerEvents="none"
          >
            FS依存
          </text>
        </g>
      )}

      {/* デバッグ用の制御点表示（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && isHoveredState && (
        <g className="debug-control-points">
          {dependency.controlPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="2"
              fill="orange"
              opacity="0.6"
            />
          ))}
          <circle
            cx={dependency.startPoint.x}
            cy={dependency.startPoint.y}
            r="3"
            fill="green"
            opacity="0.8"
          />
          <circle
            cx={dependency.endPoint.x}
            cy={dependency.endPoint.y}
            r="3"
            fill="red"
            opacity="0.8"
          />
        </g>
      )}
    </g>
  );
};

export default DependencyArrow;