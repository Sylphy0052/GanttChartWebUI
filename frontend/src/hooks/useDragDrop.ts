import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  UniqueIdentifier,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

/**
 * ドラッグ可能なアイテムの基本インターフェース
 */
export interface DraggableItem {
  id: UniqueIdentifier;
  [key: string]: any;
}

/**
 * ドラッグドロップのイベントハンドラー
 */
export interface DragDropHandlers<T extends DraggableItem> {
  onDragStart?: (event: DragStartEvent, item: T) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent, items: T[]) => void;
}

/**
 * ドラッグドロップ機能のカスタムフック
 */
export function useDragDrop<T extends DraggableItem>(
  items: T[],
  handlers: DragDropHandlers<T>
) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [localItems, setLocalItems] = useState<T[]>(items);

  // センサー設定（マウス・キーボード対応）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // アクティブアイテムの取得
  const activeItem = localItems.find((item) => item.id === activeId);

  // ドラッグ開始ハンドラー
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id);
      
      const item = localItems.find((item) => item.id === active.id);
      if (item && handlers.onDragStart) {
        handlers.onDragStart(event, item);
      }
    },
    [localItems, handlers]
  );

  // ドラッグオーバーハンドラー
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (handlers.onDragOver) {
        handlers.onDragOver(event);
      }
    },
    [handlers]
  );

  // ドラッグ終了ハンドラー
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
        setLocalItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over?.id);
          const newItems = arrayMove(items, oldIndex, newIndex);
          
          // 外部ハンドラーに新しい順序を通知
          handlers.onDragEnd(event, newItems);
          
          return newItems;
        });
      }

      setActiveId(null);
    },
    [handlers]
  );

  // アイテム更新（外部からの変更を反映）
  const updateItems = useCallback((newItems: T[]) => {
    setLocalItems(newItems);
  }, []);

  return {
    // DndContext用のprops
    dndContextProps: {
      sensors,
      collisionDetection: closestCenter,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
    },
    // SortableContext用のprops
    sortableContextProps: {
      items: localItems.map((item) => item.id),
      strategy: verticalListSortingStrategy,
    },
    // 状態とユーティリティ
    activeId,
    activeItem,
    items: localItems,
    updateItems,
    // コンポーネント
    DndContext,
    SortableContext,
    DragOverlay,
  };
}

/**
 * 単純なリスト並び替え用のヘルパーフック
 */
export function useSimpleDragDrop<T extends DraggableItem>(
  items: T[],
  onReorder: (items: T[]) => void
) {
  return useDragDrop(items, {
    onDragEnd: (_, newItems) => {
      onReorder(newItems);
    },
  });
}