// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 媒体持久化引擎 (BASE64 永久存储)
// 彻底解决移动端/Safari 刷新后头像变成问号裂图的 Bug
// ═══════════════════════════════════════════════════════════════

export class MediaStorage {
  /**
   * 将上传的 File 图片文件压缩并转换为永久 Base64 字符串
   */
  static fileToBase64(file, maxWidth = 360, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // 导出永久高质量 Base64 JPEG/PNG
          const base64Url = canvas.toDataURL('image/jpeg', quality);
          resolve(base64Url);
        };
        img.onerror = () => resolve(e.target.result); // 降级
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * 获取头像库
   */
  static async loadAvatarLibrary(charName) {
    const key = `mini_avatar_lib_${encodeURIComponent(charName || 'default')}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * 保存头像库
   */
  static async saveAvatarLibrary(charName, libData) {
    const key = `mini_avatar_lib_${encodeURIComponent(charName || 'default')}`;
    localStorage.setItem(key, JSON.stringify(libData));
  }
}
