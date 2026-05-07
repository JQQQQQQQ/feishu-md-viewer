import type { Dispatch, SetStateAction } from 'react';
import type { HandleInfo, TableFormat } from './types';
import { BG_COLORS, TOOLBAR_HEIGHT, TOOLBAR_WIDTH } from './table-utils';

interface TableHandleOverlayProps {
  handles: HandleInfo[];
  activeHandle: HandleInfo | null;
  bgColorIndex: number;
  setActiveHandle: Dispatch<SetStateAction<HandleInfo | null>>;
  cancelScheduledHide: () => void;
  scheduleHide: () => void;
  onFormat: (format: TableFormat) => void;
  onBgColor: () => void;
  onClearContent: () => void;
  onDelete: () => void;
}

export function TableHandleOverlay({
  handles,
  activeHandle,
  bgColorIndex,
  setActiveHandle,
  cancelScheduledHide,
  scheduleHide,
  onFormat,
  onBgColor,
  onClearContent,
  onDelete,
}: TableHandleOverlayProps) {
  if (handles.length === 0) return null;

  return (
    <>
      {handles.map((handle) => (
        <div
          key={`${handle.type}-${handle.index}`}
          className={`feishu-table-handle feishu-table-handle--${handle.type}${activeHandle?.type === handle.type && activeHandle?.index === handle.index ? ' feishu-table-handle--active' : ''}`}
          style={{ left: handle.x, top: handle.y, width: handle.width, height: handle.height }}
          role="button"
          tabIndex={-1}
          onMouseEnter={() => {
            cancelScheduledHide();
            setActiveHandle(handle);
          }}
          onMouseLeave={(event) => {
            const related = event.relatedTarget as HTMLElement | null;
            if (!related?.closest('.feishu-table-handle-toolbar')) scheduleHide();
          }}
          onMouseDown={(event) => event.preventDefault()}
        />
      ))}

      {activeHandle && (
        <div
          className="feishu-table-handle-toolbar"
          style={{
            left: activeHandle.type === 'col' ? activeHandle.x : activeHandle.x - TOOLBAR_WIDTH,
            top: activeHandle.type === 'col'
              ? activeHandle.y - TOOLBAR_HEIGHT - 4
              : activeHandle.y,
          }}
          onMouseEnter={cancelScheduledHide}
          onMouseMove={cancelScheduledHide}
          onMouseDown={(event) => {
            cancelScheduledHide();
            event.preventDefault();
          }}
        >
          <button onClick={() => onFormat('bold')} title="加粗">
            <strong>B</strong>
          </button>
          <button onClick={() => onFormat('italic')} title="斜体">
            <em>I</em>
          </button>
          <button onClick={() => onFormat('strikethrough')} title="删除线">
            <s>S</s>
          </button>
          <div className="feishu-table-handle-toolbar__divider" />
          <button
            onClick={onBgColor}
            title="单元格背景色"
            className="feishu-table-handle-toolbar__bgcolor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                fill={BG_COLORS[bgColorIndex] || '#f5f5f5'}
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </button>
          <button
            onClick={onClearContent}
            title="清除内容"
            className="feishu-table-handle-toolbar__clear"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2zM18 9l-6 6M12 9l6 6" />
            </svg>
          </button>
          <div className="feishu-table-handle-toolbar__divider" />
          <button
            onClick={onDelete}
            title={activeHandle.type === 'col' ? '删除列' : '删除行'}
            className="feishu-table-handle-toolbar__delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

