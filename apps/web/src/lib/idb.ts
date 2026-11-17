import type { TreeData } from '@familytree/domain'

const DB_NAME = 'familytree'
const STORE = 'trees'

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => request.transaction?.abort()
    request.onsuccess = () => {
      const db = request.result
      if (db.objectStoreNames.contains(STORE)) resolve(db)
      else {
        db.close()
        resolve(null)
      }
    }
    request.onerror = () => resolve(null)
  })
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function readBrowserTrees() {
  const db = await open()
  if (!db) return null
  return {
    trees: await run<TreeData[]>(db, 'readonly', (s) => s.getAll()),
    remove: (id: string) => run<undefined>(db, 'readwrite', (s) => s.delete(id)),
    close: () => db.close(),
  }
}
