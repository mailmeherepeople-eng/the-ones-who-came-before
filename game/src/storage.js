// Durable snapshots retain the original art. localStorage remains a fast
// fallback, never a reason to silently throw the player's drawings away.
let opening;
function database() {
  return opening ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open('towcb-stories', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage blocked'));
  });
}
export async function snapshotRead(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction('saves').objectStore('saves').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function snapshotWrite(key, data) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(data, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function snapshotList() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const store = db.transaction('saves').objectStore('saves');
    const keys = store.getAllKeys(), values = store.getAll();
    values.onsuccess = () => resolve(keys.result.map((key, i) => [key, values.result[i]]));
    values.onerror = () => reject(values.error);
  });
}
