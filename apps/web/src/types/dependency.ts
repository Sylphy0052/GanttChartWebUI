// T032: Enhanced dependency types for frontend Gantt visualization
// Mirrors backend DTO definitions with additional UI-specific types

export enum DependencyType {
  FS = 'FS', // Finish-to-Start (existing)
  SS = 'SS', // Start-to-Start (new)
  SF = 'SF', // Start-to-Finish (new) 
  FF = 'FF'  // Finish-to-Finish (new)
}

export interface Dependency {
  id: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lag: number; // in hours
  createdAt: string;
  updatedAt: string;
}

export interface CreateDependencyRequest {
  predecessorId: string;
  successorId: string;
  type?: DependencyType;
  lag?: number;
}

export interface UpdateDependencyRequest {
  type?: DependencyType;
  lag?: number;
}

export interface DependencyResponse extends Dependency {
  lagDisplay?: string;
  description?: string;
}

// T032: Visual styling for different dependency types
export interface DependencyVisualStyle {
  color: string;
  strokeDasharray: string;
  strokeWidth: number;
  label: string;
  icon: string;
}

// T032: Dependency visualization utilities
export class DependencyVisualUtils {
  static readonly STYLES: Record<DependencyType, DependencyVisualStyle> = {
    [DependencyType.FS]: {
      color: '#64748b',
      strokeDasharray: 'none',
      strokeWidth: 2,
      label: 'FS',
      icon: '→' // Finish to Start
    },
    [DependencyType.SS]: {
      color: '#3b82f6',
      strokeDasharray: '5,5',
      strokeWidth: 2,
      label: 'SS',
      icon: '⇉' // Start to Start
    },
    [DependencyType.SF]: {
      color: '#f97316',
      strokeDasharray: '2,3',
      strokeWidth: 2,
      label: 'SF',
      icon: '⇄' // Start to Finish
    },
    [DependencyType.FF]: {
      color: '#10b981',
      strokeDasharray: 'none',
      strokeWidth: 2.5,
      label: 'FF',
      icon: '⇒' // Finish to Finish
    }
  };

  static getStyle(type: DependencyType): DependencyVisualStyle {
    return this.STYLES[type];
  }

  static formatLagDisplay(lagHours: number): string {
    if (lagHours === 0) return '0h';
    
    const absDays = Math.floor(Math.abs(lagHours) / 24);
    const remainingHours = Math.abs(lagHours) % 24;
    const sign = lagHours > 0 ? '+' : '-';
    
    if (absDays > 0 && remainingHours === 0) {
      return `${sign}${absDays}d`;
    } else if (absDays > 0 && remainingHours > 0) {
      return `${sign}${absDays}d${remainingHours}h`;
    } else {
      return `${sign}${Math.abs(lagHours)}h`;
    }
  }

  static getDependencyDescription(type: DependencyType, predecessorName?: string, successorName?: string): string {
    const pred = predecessorName || 'predecessor';
    const succ = successorName || 'successor';
    
    const descriptions: Record<DependencyType, string> = {
      [DependencyType.FS]: `${succ} starts after ${pred} finishes`,
      [DependencyType.SS]: `${succ} starts after ${pred} starts`,
      [DependencyType.SF]: `${succ} finishes after ${pred} starts`,
      [DependencyType.FF]: `${succ} finishes after ${pred} finishes`
    };
    
    return descriptions[type];
  }

  static getAllTypes(): Array<{ value: DependencyType; label: string; description: string; icon: string }> {
    return [
      {
        value: DependencyType.FS,
        label: 'Finish-to-Start (FS)',
        description: 'Successor starts after predecessor finishes',
        icon: this.STYLES[DependencyType.FS].icon
      },
      {
        value: DependencyType.SS,
        label: 'Start-to-Start (SS)',
        description: 'Successor starts after predecessor starts',
        icon: this.STYLES[DependencyType.SS].icon
      },
      {
        value: DependencyType.SF,
        label: 'Start-to-Finish (SF)',
        description: 'Successor finishes after predecessor starts',
        icon: this.STYLES[DependencyType.SF].icon
      },
      {
        value: DependencyType.FF,
        label: 'Finish-to-Finish (FF)',
        description: 'Successor finishes after predecessor finishes',
        icon: this.STYLES[DependencyType.FF].icon
      }
    ];
  }

  static validateDependency(dependency: CreateDependencyRequest, tasks: Array<{id: string; startDate?: Date; endDate?: Date}>): {
    isValid: boolean;
    error?: string;
    warnings?: string[];
  } {
    const { predecessorId, successorId, type, lag = 0 } = dependency;

    // Basic validation
    if (predecessorId === successorId) {
      return { isValid: false, error: 'A task cannot depend on itself' };
    }

    const predecessor = tasks.find(t => t.id === predecessorId);
    const successor = tasks.find(t => t.id === successorId);

    if (!predecessor || !successor) {
      return { isValid: false, error: 'Both predecessor and successor tasks must exist' };
    }

    const warnings: string[] = [];

    // Check for potential scheduling conflicts
    if (predecessor.startDate && successor.startDate && predecessor.endDate && successor.endDate) {
      const predStart = predecessor.startDate.getTime();
      const predEnd = predecessor.endDate.getTime();
      const succStart = successor.startDate.getTime();
      const succEnd = successor.endDate.getTime();
      const lagMs = lag * 60 * 60 * 1000; // Convert hours to milliseconds

      switch (type) {
        case DependencyType.FS:
          if (succStart < predEnd + lagMs) {
            warnings.push('Successor may need to be rescheduled to start after predecessor finishes');
          }
          break;
        case DependencyType.SS:
          if (succStart < predStart + lagMs) {
            warnings.push('Successor may need to be rescheduled to start after predecessor starts');
          }
          break;
        case DependencyType.SF:
          if (succEnd < predStart + lagMs) {
            warnings.push('Successor may need to be rescheduled to finish after predecessor starts');
          }
          break;
        case DependencyType.FF:
          if (succEnd < predEnd + lagMs) {
            warnings.push('Successor may need to be rescheduled to finish after predecessor finishes');
          }
          break;
      }
    }

    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }
}

// T032: Gantt chart dependency line calculation
export interface DependencyLine {
  id: string;
  type: DependencyType;
  lag: number;
  lagDisplay: string;
  startPoint: { x: number; y: number; side: 'left' | 'right' };
  endPoint: { x: number; y: number; side: 'left' | 'right' };
  path: string; // SVG path data
  style: DependencyVisualStyle;
  isHighlighted: boolean;
  predecessor: { id: string; title: string };
  successor: { id: string; title: string };
}

export class DependencyLineCalculator {
  static calculateDependencyLine(
    dependency: DependencyResponse,
    predecessorElement: DOMRect,
    successorElement: DOMRect,
    ganttContainer: DOMRect
  ): DependencyLine {
    const style = DependencyVisualUtils.getStyle(dependency.type);
    
    // Calculate connection points based on dependency type
    const startPoint = this.getConnectionPoint(dependency.type, predecessorElement, ganttContainer, 'predecessor');
    const endPoint = this.getConnectionPoint(dependency.type, successorElement, ganttContainer, 'successor');
    
    // Generate SVG path
    const path = this.generatePath(startPoint, endPoint);
    
    return {
      id: dependency.id,
      type: dependency.type,
      lag: dependency.lag,
      lagDisplay: DependencyVisualUtils.formatLagDisplay(dependency.lag),
      startPoint,
      endPoint,
      path,
      style,
      isHighlighted: false,
      predecessor: { id: dependency.predecessorId, title: 'Predecessor' },
      successor: { id: dependency.successorId, title: 'Successor' }
    };
  }

  private static getConnectionPoint(
    type: DependencyType,
    element: DOMRect,
    container: DOMRect,
    role: 'predecessor' | 'successor'
  ): { x: number; y: number; side: 'left' | 'right' } {
    const relativeY = element.top - container.top + (element.height / 2);
    
    const connectionPoints = {
      [DependencyType.FS]: {
        predecessor: { x: element.right - container.left, y: relativeY, side: 'right' as const },
        successor: { x: element.left - container.left, y: relativeY, side: 'left' as const }
      },
      [DependencyType.SS]: {
        predecessor: { x: element.left - container.left, y: relativeY, side: 'left' as const },
        successor: { x: element.left - container.left, y: relativeY, side: 'left' as const }
      },
      [DependencyType.SF]: {
        predecessor: { x: element.left - container.left, y: relativeY, side: 'left' as const },
        successor: { x: element.right - container.left, y: relativeY, side: 'right' as const }
      },
      [DependencyType.FF]: {
        predecessor: { x: element.right - container.left, y: relativeY, side: 'right' as const },
        successor: { x: element.right - container.left, y: relativeY, side: 'right' as const }
      }
    };

    return connectionPoints[type][role];
  }

  private static generatePath(
    start: { x: number; y: number; side: 'left' | 'right' },
    end: { x: number; y: number; side: 'left' | 'right' }
  ): string {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Create smooth curved path
    const controlOffset = Math.min(Math.abs(dx) * 0.5, 50);
    
    let startControlX = start.x;
    let endControlX = end.x;
    
    if (start.side === 'right') {
      startControlX += controlOffset;
    } else {
      startControlX -= controlOffset;
    }
    
    if (end.side === 'left') {
      endControlX -= controlOffset;
    } else {
      endControlX += controlOffset;
    }
    
    return `M ${start.x} ${start.y} C ${startControlX} ${start.y}, ${endControlX} ${end.y}, ${end.x} ${end.y}`;
  }
}