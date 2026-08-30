import { renderIMessageView } from './modules/imessage.js';
import { renderMomentsView } from './modules/moments.js';
import { renderCharactersView } from './modules/characters.js';
import { renderUserView } from './modules/user.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化视口与动态尺寸监听
  initViewportHeight();
  
  // 2. 初始化顶部时钟
  updateClock();
  setInterval(updateClock, 1000 * 15);

  // 3. 获取视图容器
  const dockItems = document.querySelectorAll('.dock-item');
  const panels = {
    imessage: document.getElementById('view-imessage'),
    moments: document.getElementById('view-moments'),
    characters: document.getElementById('view-characters'),
    user: document.getElementById('view-user')
  };

  // 4. 默认加载 iMessage
  renderIMessageView(panels.imessage);

  // 5. Dock 栏切换事件
  dockItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!panels[target]) return;

      dockItems.forEach(i => i.classList.remove('active'));
      btn.classList.add('active');

      Object.keys(panels).forEach(key => {
        panels[key].classList.remove('active');
      });
      panels[target].classList.add('active');

      if (target === 'imessage') renderIMessageView(panels.imessage);
      if (target === 'moments') renderMomentsView(panels.moments);
      if (target === 'characters') renderCharactersView(panels.characters);
      if (target === 'user') renderUserView(panels.user);
    });
  });
});

// 动态更新时钟
function updateClock() {
  const timeEl = document.getElementById('current-time');
  if (!timeEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${minutes}`;
}

// 动态处理移动端真实 100% 视口（解决 iOS Safari/Android 浏览器地址栏伸缩导致的抖动）
function initViewportHeight() {
  const setHeight = () => {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  };

  setHeight();
  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setHeight);
  }
}
