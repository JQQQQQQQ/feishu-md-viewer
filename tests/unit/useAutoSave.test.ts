import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '@/viewer/hooks/useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not save when disabled', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const mockHandle = {} as FileSystemFileHandle;

    renderHook(() =>
      useAutoSave({
        content: 'new content',
        fileHandle: mockHandle,
        enabled: false,
        onSave,
        debounceMs: 1000,
      })
    );

    vi.advanceTimersByTime(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save when no file handle', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useAutoSave({
        content: 'new content',
        fileHandle: null,
        enabled: true,
        onSave,
        debounceMs: 1000,
      })
    );

    vi.advanceTimersByTime(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save when content matches last saved content (initial content)', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const mockHandle = {} as FileSystemFileHandle;

    // The hook initializes lastSavedContentRef to the initial content value.
    // So if content never changes from the initial value, no save should trigger.
    renderHook(() =>
      useAutoSave({
        content: 'initial content',
        fileHandle: mockHandle,
        enabled: true,
        onSave,
        debounceMs: 1000,
      })
    );

    vi.advanceTimersByTime(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves after debounce delay when conditions are met', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const mockHandle = {} as FileSystemFileHandle;

    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          content: 'initial',
          fileHandle: mockHandle,
          enabled: true,
          onSave,
          debounceMs: 1000,
        },
      }
    );

    // Change content to trigger auto-save
    rerender({
      content: 'modified content',
      fileHandle: mockHandle,
      enabled: true,
      onSave,
      debounceMs: 1000,
    });

    // Before debounce fires
    expect(onSave).not.toHaveBeenCalled();

    // Advance past debounce delay
    await vi.advanceTimersByTimeAsync(1100);

    expect(onSave).toHaveBeenCalledWith(mockHandle, 'modified content');
  });

  it('cleans up timer on unmount', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const mockHandle = {} as FileSystemFileHandle;

    const { rerender, unmount } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          content: 'initial',
          fileHandle: mockHandle,
          enabled: true,
          onSave,
          debounceMs: 1000,
        },
      }
    );

    // Trigger content change to start timer
    rerender({
      content: 'changed',
      fileHandle: mockHandle,
      enabled: true,
      onSave,
      debounceMs: 1000,
    });

    // Unmount before timer fires
    unmount();

    // Advance time past debounce
    vi.advanceTimersByTime(2000);

    // onSave should NOT be called since the component unmounted
    expect(onSave).not.toHaveBeenCalled();
  });
});
