import { useCallback, useEffect, useRef, useState } from 'react';
import { editorViewCtx } from '@milkdown/core';
import type { Editor } from '@milkdown/core';
import type { HandleInfo } from './types';
import { computeTableHandles, getActiveHandleZone } from './table-utils';

type GetEditor = () => Editor | undefined;

export function useTableHandleVisibility(loading: boolean, getEditor: GetEditor) {
  const [handles, setHandles] = useState<HandleInfo[]>([]);
  const [activeHandle, setActiveHandle] = useState<HandleInfo | null>(null);
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const tableElRef = useRef<HTMLTableElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledHide = useCallback(() => {
    if (!hideTimeoutRef.current) return;
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimeoutRef.current) return;
    hideTimeoutRef.current = setTimeout(() => {
      setHandles([]);
      setTableEl(null);
      setActiveHandle(null);
      tableElRef.current = null;
      hideTimeoutRef.current = null;
    }, 300);
  }, []);

  const resetTableTools = useCallback(() => {
    cancelScheduledHide();
    setHandles([]);
    setTableEl(null);
    setActiveHandle(null);
    tableElRef.current = null;
  }, [cancelScheduledHide]);

  const isInsideActiveHandleZone = useCallback((clientX: number, clientY: number): boolean => {
    if (!activeHandle) return false;
    const editor = getEditor();
    if (!editor) return false;

    let editorDom: HTMLElement | null = null;
    try {
      editor.action((ctx) => {
        editorDom = ctx.get(editorViewCtx).dom;
      });
    } catch {
      return false;
    }
    if (!editorDom) return false;

    const listenTarget =
      ((editorDom as HTMLElement).closest('.feishu-wysiwyg__editor') as HTMLElement) ??
      editorDom;
    const zone = getActiveHandleZone(activeHandle, listenTarget.getBoundingClientRect());

    return clientX >= zone.left && clientX <= zone.right && clientY >= zone.top && clientY <= zone.bottom;
  }, [activeHandle, getEditor]);

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let editorDom: HTMLElement | null = null;
    try {
      editor.action((ctx) => {
        editorDom = ctx.get(editorViewCtx).dom;
      });
    } catch {
      return;
    }
    if (!editorDom) return;

    const listenTarget =
      ((editorDom as HTMLElement).closest('.feishu-wysiwyg__editor') as HTMLElement) ??
      editorDom;

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.feishu-table-handle') || target.closest('.feishu-table-handle-toolbar')) {
        cancelScheduledHide();
        return;
      }

      const table = target.closest('table');
      if (table instanceof HTMLTableElement) {
        cancelScheduledHide();
        tableElRef.current = table;
        setTableEl(table);
        setHandles(computeTableHandles(table, listenTarget));
        return;
      }

      if (isInsideActiveHandleZone(event.clientX, event.clientY)) {
        cancelScheduledHide();
        return;
      }

      const currentTable = tableElRef.current;
      if (currentTable) {
        const rect = currentTable.getBoundingClientRect();
        if (
          event.clientX >= rect.left - 40 &&
          event.clientX <= rect.right + 10 &&
          event.clientY >= rect.top - 30 &&
          event.clientY <= rect.bottom + 10
        ) {
          return;
        }
      }

      if (handles.length > 0) scheduleHide();
    };

    const handleMouseLeave = () => {
      cancelScheduledHide();
      scheduleHide();
    };

    listenTarget.addEventListener('mousemove', handleMouseMove);
    listenTarget.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      listenTarget.removeEventListener('mousemove', handleMouseMove);
      listenTarget.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [
    loading,
    getEditor,
    handles.length,
    cancelScheduledHide,
    scheduleHide,
    isInsideActiveHandleZone,
  ]);

  return {
    handles,
    activeHandle,
    tableEl,
    setActiveHandle,
    cancelScheduledHide,
    scheduleHide,
    resetTableTools,
  };
}

