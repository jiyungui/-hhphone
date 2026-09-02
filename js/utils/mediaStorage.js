/**
 * MINI PHONE OS · 海量图片与媒体数据库 (IndexedDB Storage Engine)
 * 专门用于持久化存放全量高清图片、头像库、情侣头像对与聊天照片
 * 彻底解放 LocalStorage，容量提升至数百 MB / 数 GB，永不超限撑爆！
 */

const DB_NAME = "MiniPhoneMediaDB";
const DB_VERSION = 2;
const STORE_MEDIA = "media_store";          // 存放单独图片/照片卡片 (id -> base64)
const STORE_AVATAR_LIB = "avatar_libraries"; // 存放每个角色的专属三栏头像库 (charName -> libObject)

let dbInstance = null;

// 初始化打开或创建 IndexedDB
function getDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_AVATAR_LIB)) {
        db.createObjectStore(STORE_AVATAR_LIB, { keyPath: "charName" });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      console.error("打开 MediaStorage 数据库失败:", e);
      reject(e);
    };
  });
}

export const MediaStorage = {
  /**
   * 1. 保存角色专属头像库（Char头像 / User头像 / 情头对）到 IndexedDB
   */
  async saveAvatarLibrary(charName, libObject) {
    if (!charName) return;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AVATAR_LIB, "readwrite");
        const store = tx.objectStore(STORE_AVATAR_LIB);
        store.put({
          charName: charName,
          data: libObject,
          updatedAt: new Date().toISOString()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn("MediaStorage 存储头像库异常:", e);
      return false;
    }
  },

  /**
   * 2. 从 IndexedDB 加载角色的专属头像库
   */
  async loadAvatarLibrary(charName) {
    if (!charName) return null;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AVATAR_LIB, "readonly");
        const store = tx.objectStore(STORE_AVATAR_LIB);
        const req = store.get(charName);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve(req.result.data);
          } else {
            // 兼容旧 LocalStorage 迁移数据
            const safeChar = encodeURIComponent(charName);
            const oldData = localStorage.getItem(`mini_char_avatar_library_${safeChar}`);
            if (oldData) {
              try {
                const parsed = JSON.parse(oldData);
                this.saveAvatarLibrary(charName, parsed); // 迁移入库
                localStorage.removeItem(`mini_char_avatar_library_${safeChar}`); // 释放 LocalStorage
                resolve(parsed);
                return;
              } catch (err) {}
            }
            resolve({ charAvatars: [], userAvatars: [], couplePairs: [] });
          }
        };
        req.onerror = () => resolve({ charAvatars: [], userAvatars: [], couplePairs: [] });
      });
    } catch (e) {
      return { charAvatars: [], userAvatars: [], couplePairs: [] };
    }
  },

  /**
   * 3. 保存单张聊天照片到 IndexedDB
   */
  async saveMedia(id, base64Data) {
    if (!id || !base64Data) return false;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, "readwrite");
        const store = tx.objectStore(STORE_MEDIA);
        store.put({ id, data: base64Data, savedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  },

  /**
   * 4. 读取单张聊天照片
   */
  async getMedia(id) {
    if (!id) return null;
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, "readonly");
        const store = tx.objectStore(STORE_MEDIA);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },

  /**
   * 5. 彻底清空所有图片数据（供恢复出厂设置使用）
   */
  async clearAllMedia() {
    try {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(true);
      });
    } catch (e) {
      return false;
    }
  }
};
