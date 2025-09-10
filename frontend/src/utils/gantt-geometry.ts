/**
 * ガントチャート幾何学計算ユーティリティ
 * 依存関係矢印線の座標計算とSVGパス生成
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DependencyLine {
  id: string;
  predecessorIssueId: string;
  successorIssueId: string;
  type: 'FS'; // Finish-to-Start
  path: string; // SVG path
  startPoint: Point;
  endPoint: Point;
  controlPoints: Point[];
}

/**
 * タスクバーの位置情報
 */
export interface TaskPosition {
  issueId: string;
  rect: Rect;
  isVisible: boolean;
  isTaskBar: boolean; // true: TaskBar, false: Milestone
}

/**
 * 依存関係線描画設定
 */
export interface DependencyLineOptions {
  arrowSize: number;
  lineStrokeWidth: number;
  lineColor: string;
  hoverLineColor: string;
  selectedLineColor: string;
  cornerRadius: number;
  lineMargin: number; // タスクバーからの余白
}

export const DEFAULT_DEPENDENCY_LINE_OPTIONS: DependencyLineOptions = {
  arrowSize: 6,
  lineStrokeWidth: 2,
  lineColor: '#6b7280', // gray-500
  hoverLineColor: '#3b82f6', // blue-500
  selectedLineColor: '#ef4444', // red-500
  cornerRadius: 4,
  lineMargin: 8,
};

/**
 * FS（Finish-to-Start）依存関係の矢印線パスを計算
 * 
 * @param predecessorPos 先行タスクの位置
 * @param successorPos 後続タスクの位置
 * @param options 描画オプション
 * @returns SVGパス文字列
 */
export function calculateFSArrowPath(
  predecessorPos: TaskPosition,
  successorPos: TaskPosition,
  options: DependencyLineOptions = DEFAULT_DEPENDENCY_LINE_OPTIONS
): DependencyLine {
  const { lineMargin, cornerRadius, arrowSize } = options;

  // 先行タスクの終了点（右端中央）
  const startPoint: Point = {
    x: predecessorPos.rect.x + predecessorPos.rect.width,
    y: predecessorPos.rect.y + predecessorPos.rect.height / 2,
  };

  // 後続タスクの開始点（左端中央）
  const endPoint: Point = {
    x: successorPos.rect.x,
    y: successorPos.rect.y + successorPos.rect.height / 2,
  };

  // 線の重複回避のための垂直オフセット計算
  const verticalOffset = calculateVerticalOffset(predecessorPos, successorPos);
  
  // 制御点の計算（3点ベジェ曲線）
  const controlPoints = calculateControlPoints(
    startPoint,
    endPoint,
    lineMargin,
    verticalOffset,
    cornerRadius
  );

  // SVGパスの生成
  const path = generateArrowPath(startPoint, endPoint, controlPoints, arrowSize);

  return {
    id: `${predecessorPos.issueId}->${successorPos.issueId}`,
    predecessorIssueId: predecessorPos.issueId,
    successorIssueId: successorPos.issueId,
    type: 'FS',
    path,
    startPoint,
    endPoint,
    controlPoints,
  };
}

/**
 * 線の重複を避けるための垂直オフセット計算
 */
function calculateVerticalOffset(
  predecessorPos: TaskPosition,
  successorPos: TaskPosition
): number {
  // 同じ高さまたは近接している場合はオフセットを適用
  const verticalDistance = Math.abs(successorPos.rect.y - predecessorPos.rect.y);
  
  if (verticalDistance < 20) {
    // 線の重複を避けるため下にオフセット
    return 20;
  }
  
  return 0;
}

/**
 * ベジェ曲線制御点の計算
 */
function calculateControlPoints(
  start: Point,
  end: Point,
  margin: number,
  verticalOffset: number,
  radius: number
): Point[] {
  const horizontalGap = end.x - start.x;
  
  if (horizontalGap > margin * 2) {
    // 直接接続できる場合（水平線）
    return [
      { x: start.x + margin, y: start.y },
      { x: end.x - margin, y: end.y }
    ];
  } else {
    // 右→下→左→上の順でL字接続
    const midX = start.x + margin;
    const midY = Math.max(start.y, end.y) + margin + verticalOffset;
    
    return [
      { x: midX, y: start.y }, // 右へ水平移動
      { x: midX, y: midY },   // 下へ垂直移動
      { x: end.x - margin, y: midY }, // 左へ水平移動
      { x: end.x - margin, y: end.y } // 上へ垂直移動
    ];
  }
}

/**
 * 矢印付きSVGパスの生成
 */
function generateArrowPath(
  start: Point,
  end: Point,
  controlPoints: Point[],
  arrowSize: number
): string {
  let pathData = `M ${start.x} ${start.y}`;
  
  // 制御点を使ってパスを構築
  if (controlPoints.length === 2) {
    // 直線の場合
    pathData += ` L ${controlPoints[0].x} ${controlPoints[0].y}`;
    pathData += ` L ${controlPoints[1].x} ${controlPoints[1].y}`;
  } else if (controlPoints.length >= 4) {
    // L字曲線の場合
    pathData += ` L ${controlPoints[0].x} ${controlPoints[0].y}`;
    pathData += ` L ${controlPoints[1].x} ${controlPoints[1].y}`;
    pathData += ` L ${controlPoints[2].x} ${controlPoints[2].y}`;
    pathData += ` L ${controlPoints[3].x} ${controlPoints[3].y}`;
  }
  
  // 矢印終端への線
  pathData += ` L ${end.x} ${end.y}`;
  
  // 矢印先端の描画
  const arrowAngle = Math.atan2(
    end.y - controlPoints[controlPoints.length - 1]?.y || start.y,
    end.x - controlPoints[controlPoints.length - 1]?.x || start.x
  );
  
  const arrowPoint1 = {
    x: end.x - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
    y: end.y - arrowSize * Math.sin(arrowAngle - Math.PI / 6),
  };
  
  const arrowPoint2 = {
    x: end.x - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
    y: end.y - arrowSize * Math.sin(arrowAngle + Math.PI / 6),
  };
  
  // 矢印の描画
  pathData += ` M ${end.x} ${end.y}`;
  pathData += ` L ${arrowPoint1.x} ${arrowPoint1.y}`;
  pathData += ` M ${end.x} ${end.y}`;
  pathData += ` L ${arrowPoint2.x} ${arrowPoint2.y}`;
  
  return pathData;
}

/**
 * 表示範囲内の依存関係線のフィルタリング（パフォーマンス最適化）
 */
export function filterVisibleDependencies(
  dependencies: DependencyLine[],
  viewportRect: Rect,
  buffer: number = 50
): DependencyLine[] {
  return dependencies.filter(dep => {
    // 線が表示範囲と重複するかチェック
    const lineRect = {
      x: Math.min(dep.startPoint.x, dep.endPoint.x) - buffer,
      y: Math.min(dep.startPoint.y, dep.endPoint.y) - buffer,
      width: Math.abs(dep.endPoint.x - dep.startPoint.x) + buffer * 2,
      height: Math.abs(dep.endPoint.y - dep.startPoint.y) + buffer * 2,
    };
    
    return isRectIntersecting(lineRect, viewportRect);
  });
}

/**
 * 2つの矩形が重複するかチェック
 */
function isRectIntersecting(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}

/**
 * 依存関係線の当たり判定（クリック・ホバー用）
 */
export function isPointOnDependencyLine(
  point: Point,
  line: DependencyLine,
  tolerance: number = 5
): boolean {
  // 簡易的な線の当たり判定（制御点を直線で結んだ近似）
  const points = [line.startPoint, ...line.controlPoints, line.endPoint];
  
  for (let i = 0; i < points.length - 1; i++) {
    const distance = distanceFromPointToLineSegment(point, points[i], points[i + 1]);
    if (distance <= tolerance) {
      return true;
    }
  }
  
  return false;
}

/**
 * 点から線分への最短距離を計算
 */
function distanceFromPointToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // 線分が点の場合
    return Math.sqrt(A * A + B * B);
  }
  
  let param = dot / lenSq;
  
  if (param < 0) {
    param = 0;
  } else if (param > 1) {
    param = 1;
  }
  
  const xx = lineStart.x + param * C;
  const yy = lineStart.y + param * D;
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * タスク位置情報の更新（スクロール・リサイズ対応）
 */
export function updateTaskPositions(
  issueIds: string[],
  containerElement: HTMLElement,
  rowHeight: number
): TaskPosition[] {
  const positions: TaskPosition[] = [];
  
  issueIds.forEach((issueId, index) => {
    const taskElement = containerElement.querySelector(`[data-issue-id="${issueId}"]`);
    
    if (taskElement) {
      const rect = taskElement.getBoundingClientRect();
      const containerRect = containerElement.getBoundingClientRect();
      
      positions.push({
        issueId,
        rect: {
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        },
        isVisible: rect.top >= containerRect.top && rect.bottom <= containerRect.bottom,
        isTaskBar: !taskElement.classList.contains('milestone-marker'),
      });
    } else {
      // 要素が見つからない場合は推定位置
      positions.push({
        issueId,
        rect: {
          x: 0,
          y: index * rowHeight,
          width: 0,
          height: rowHeight,
        },
        isVisible: false,
        isTaskBar: true,
      });
    }
  });
  
  return positions;
}