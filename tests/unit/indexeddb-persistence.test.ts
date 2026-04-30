import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveFileHandle, getFileHandle, removeFileHandle } from '@/shared/utils/indexeddb';

// fake-indexeddb provides a full IndexedDB implementation in memory.
// We reset the database state before each test by deleting the database.

describe('IndexedDB persistence', () => {
  beforeEach(() => {
    // Delete the database to ensure a clean state
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('feishu-md-viewer');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  it('saveFileHandle stores a value', async () => {
    const mockHandle = { kind: 'file', name: 'test.md' } as unknown as FileSystemFileHandle;
    await expect(saveFileHandle('doc-1', mockHandle)).resolves.toBeUndefined();
  });

  it('getFileHandle retrieves a stored value', async () => {
    const mockHandle = { kind: 'file', name: 'test.md' } as unknown as FileSystemFileHandle;
    await saveFileHandle('doc-2', mockHandle);

    const retrieved = await getFileHandle('doc-2');
    expect(retrieved).not.toBeNull();
    expect((retrieved as unknown as { name: string }).name).toBe('test.md');
    expect((retrieved as unknown as { kind: string }).kind).toBe('file');
  });

  it('removeFileHandle removes a stored value', async () => {
    const mockHandle = { kind: 'file', name: 'remove-me.md' } as unknown as FileSystemFileHandle;
    await saveFileHandle('doc-3', mockHandle);

    // Verify it exists first
    const before = await getFileHandle('doc-3');
    expect(before).not.toBeNull();

    // Remove it
    await removeFileHandle('doc-3');

    // Verify it's gone
    const after = await getFileHandle('doc-3');
    expect(after).toBeNull();
  });

  it('getFileHandle returns null for non-existent key', async () => {
    const result = await getFileHandle('non-existent-key');
    expect(result).toBeNull();
  });
});
