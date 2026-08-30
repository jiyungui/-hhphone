import { saveAvatarToDB, getAvatarUrlFromDB, getAllAvatarUrls, removeAvatarFromDB } from '../utils/db.js';

// 当前生成的 URL 缓存映射（防止重复创建 URL）
const activeObjectUrls = {};

/**
 * 渲染 5 个圆形头像框 HTML
 */
export function getStoryAvatarsHtml() {
  return `
    <div class="story-avatars-bar" id="story-avatars-bar">
      ${[0, 1, 2, 3, 4].map(idx => `
        <div class="story-avatar-item" data-slot="${idx}">
          <div class="story-avatar-circle" id="avatar-slot-${idx}">
            <div class="story-avatar-empty">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
          </div>
          <span class="story-avatar-label">Slot ${idx + 1}</span>
        </div>
      `).join('')}
      <!-- 隐藏的文件选择器 -->
      <input type="file" id="avatar-file-input" accept="image/*" style="display:none;" />
    </div>
  `;
}

/**
 * 挂载头像异步加载与交互事件
 */
export async function initStoryAvatars(container) {
  const bar = container.querySelector('#story-avatars-bar');
  if (!bar) return;

  const fileInput = container.querySelector('#avatar-file-input');
  let currentTargetSlot = null;

  // 1. 初始化从 IndexedDB 读取 5 个槽位的原图并生成 URL 渲染
  const savedUrls = await getAllAvatarUrls();
  for (let i = 0; i < 5; i++) {
    if (savedUrls[i]) {
      updateAvatarDom(container, i, savedUrls[i]);
    }
  }

  // 2. 点击头像框触发上传
  const items = container.querySelectorAll('.story-avatar-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      currentTargetSlot = item.getAttribute('data-slot');
      fileInput.value = ''; // 重置 file 状态以允许重复选同一张图
      fileInput.click();
    });
  });

  // 3. 监听文件选择并无损入库
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || currentTargetSlot === null) return;

    try {
      // 原图二进制存入 IndexedDB，不压缩画质，不撑爆 LocalStorage
      await saveAvatarToDB(currentTargetSlot, file);
      
      // 生成新的无损 Blob URL
      if (activeObjectUrls[currentTargetSlot]) {
        URL.revokeObjectURL(activeObjectUrls[currentTargetSlot]); // 释放旧 URL 内存
      }
      const newUrl = URL.createObjectURL(file);
      activeObjectUrls[currentTargetSlot] = newUrl;

      // 更新 DOM 显示
      updateAvatarDom(container, currentTargetSlot, newUrl);
    } catch (err) {
      console.error('图片保存失败:', err);
      alert('图片加载失败，请重试');
    }
  });
}

/**
 * 更新单个头像的展示
 */
function updateAvatarDom(container, slotId, imgUrl) {
  const circleEl = container.querySelector(`#avatar-slot-${slotId}`);
  if (!circleEl) return;

  circleEl.innerHTML = `
    <img src="${imgUrl}" class="story-avatar-img" alt="Slot ${slotId}" />
    <div class="story-avatar-badge"></div>
  `;
  circleEl.classList.add('has-image');
}
