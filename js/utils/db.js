// IndexedDB 本地数据库管理：支持 GB 级超大原图二进制存储，杜绝 LocalStorage 5MB 撑爆崩溃
const DB_NAME = 'MiniPhone_Storage';
const DB_VERSION = 1;
const STORE_NAME = 'custom_avatars';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 将原图 Blob/File 原封不动存入数据库（无损、不压缩）
 */
export async function saveAvatarToDB(slotId, fileBlob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ slotId: String(slotId), blob: fileBlob, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 从数据库读取原图 Blob 并转换为原生 Blob URL
 */
export async function getAvatarUrlFromDB(slotId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(String(slotId));
    request.onsuccess = () => {
      if (request.result && request.result.blob) {
        // 自动转换成纯净的 blob: 内存 URL
        const url = URL.createObjectURL(request.result.blob);
        resolve(url);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取所有 5 个槽位的图片 URL
 */
export async function getAllAvatarUrls() {
  const urls = {};
  for (let i = 0; i < 5; i++) {
    urls[i] = await getAvatarUrlFromDB(i);
  }
  return urls;
}

/**
 * 移除指定槽位的头像
 */
export async function removeAvatarFromDB(slotId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(String(slotId));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
