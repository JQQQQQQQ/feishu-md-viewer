import { useInstance } from '@milkdown/react';
import { TableHandleOverlay } from './TableHandleOverlay';
import { useTableHandleActions } from './useTableHandleActions';
import { useTableHandleVisibility } from './useTableHandleVisibility';

/**
 * Feishu-style table column/row selection handles.
 * Shows thin strips above columns and to the left of rows when hovering a table.
 */
export function TableHandles() {
  const [loading, getEditor] = useInstance();
  const {
    handles,
    activeHandle,
    tableEl,
    setActiveHandle,
    cancelScheduledHide,
    scheduleHide,
    resetTableTools,
  } = useTableHandleVisibility(loading, getEditor);
  const {
    bgColorIndex,
    handleDelete,
    handleFormat,
    handleClearContent,
    handleBgColor,
  } = useTableHandleActions({
    activeHandle,
    tableEl,
    getEditor,
    cancelScheduledHide,
    resetTableTools,
  });

  return (
    <TableHandleOverlay
      handles={handles}
      activeHandle={activeHandle}
      bgColorIndex={bgColorIndex}
      setActiveHandle={setActiveHandle}
      cancelScheduledHide={cancelScheduledHide}
      scheduleHide={scheduleHide}
      onFormat={handleFormat}
      onBgColor={handleBgColor}
      onClearContent={handleClearContent}
      onDelete={handleDelete}
    />
  );
}

