const DB_NAME = 'feishu-md-viewer';
const STORE_NAME = 'file-handles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message ?? 'unknown error'}`));
    };
  });
}

export async function saveFileHandle(key: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to save file handle: ${request.error?.message ?? 'unknown error'}`));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

export async function getFileHandle(key: string): Promise<FileSystemFileHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as FileSystemFileHandle | undefined;
      resolve(result ?? null);
    };

    request.onerror = () => {
      reject(
        new Error(`Failed to get file handle: ${request.error?.message ?? 'unknown error'}`)
      );
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

export async function removeFileHandle(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(
        new Error(`Failed to remove file handle: ${request.error?.message ?? 'unknown error'}`)
      );
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}
