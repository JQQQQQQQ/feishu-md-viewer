import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isFileAccessSupported, useFileAccess } from '@/viewer/hooks/useFileAccess';

// Mock the indexeddb module
vi.mock('@/shared/utils/indexeddb', () => ({
  saveFileHandle: vi.fn().mockResolvedValue(undefined),
  getFileHandle: vi.fn().mockResolvedValue(null),
}));

describe('isFileAccessSupported', () => {
  const originalShowSaveFilePicker = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');

  afterEach(() => {
    // Restore original state
    if (originalShowSaveFilePicker) {
      Object.defineProperty(window, 'showSaveFilePicker', originalShowSaveFilePicker);
    } else {
      delete (window as Record<string, unknown>).showSaveFilePicker;
    }
  });

  it('returns false when showSaveFilePicker does not exist on window', () => {
    delete (window as Record<string, unknown>).showSaveFilePicker;
    expect(isFileAccessSupported()).toBe(false);
  });

  it('returns true when showSaveFilePicker exists as a function on window', () => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    expect(isFileAccessSupported()).toBe(true);
  });
});

describe('useFileAccess', () => {
  beforeEach(() => {
    // Default: API not supported
    delete (window as Record<string, unknown>).showSaveFilePicker;
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).showSaveFilePicker;
  });

  describe('requestFileHandle', () => {
    it('calls showSaveFilePicker with correct options when API is supported', async () => {
      const mockHandle = { kind: 'file', name: 'test.md' } as unknown as FileSystemFileHandle;
      const mockPicker = vi.fn().mockResolvedValue(mockHandle);

      Object.defineProperty(window, 'showSaveFilePicker', {
        value: mockPicker,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useFileAccess());

      let handle: FileSystemFileHandle | null = null;
      await act(async () => {
        handle = await result.current.requestFileHandle();
      });

      expect(mockPicker).toHaveBeenCalledWith({
        types: [
          {
            description: 'Markdown files',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
        suggestedName: 'document.md',
      });
      expect(handle).toBe(mockHandle);
      expect(result.current.fileHandle).toBe(mockHandle);
      expect(result.current.error).toBeNull();
    });

    it('sets error when API is not supported', async () => {
      const { result } = renderHook(() => useFileAccess());

      let handle: FileSystemFileHandle | null = null;
      await act(async () => {
        handle = await result.current.requestFileHandle();
      });

      expect(handle).toBeNull();
      expect(result.current.error).toBe('File System Access API is not supported in this browser');
    });
  });

  describe('saveToHandle', () => {
    it('writes content to writable stream', async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const mockWrite = vi.fn().mockResolvedValue(undefined);
      const mockWritable = { write: mockWrite, close: mockClose };
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      } as unknown as FileSystemFileHandle;

      const { result } = renderHook(() => useFileAccess());

      await act(async () => {
        await result.current.saveToHandle(mockHandle, '# Hello');
      });

      expect(mockHandle.createWritable).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith('# Hello');
      expect(mockClose).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('handles permission denied error (NotAllowedError)', async () => {
      const permError = new DOMException('Permission denied', 'NotAllowedError');
      const mockHandle = {
        createWritable: vi.fn().mockRejectedValue(permError),
      } as unknown as FileSystemFileHandle;

      const { result } = renderHook(() => useFileAccess());

      await act(async () => {
        await expect(result.current.saveToHandle(mockHandle, '# Hello')).rejects.toThrow();
      });

      expect(result.current.error).toBe(
        'Permission denied. Please allow file access and try again.'
      );
    });
  });

  describe('downloadFallback', () => {
    it('creates and clicks a download link', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectURLMock,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: revokeObjectURLMock,
        writable: true,
        configurable: true,
      });

      const clickMock = vi.fn();
      const appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        // Intercept to capture the anchor
        return node;
      });
      const removeChildMock = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
        return node;
      });

      // Mock createElement to return an object we control
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      const { result } = renderHook(() => useFileAccess());

      act(() => {
        result.current.downloadFallback('# Content', 'test.md');
      });

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(appendChildMock).toHaveBeenCalled();

      // Cleanup
      createElementSpy.mockRestore();
      appendChildMock.mockRestore();
      removeChildMock.mockRestore();
    });
  });
});
