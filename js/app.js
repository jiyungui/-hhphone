import { renderIMessageView } from './modules/imessage.js';
import { renderMomentsView } from './modules/moments.js';
import { renderCharactersView } from './modules/characters.js';
import { renderUserView } from './modules/user.js';
import { initAppDrawer } from './modules/appDrawer.js';
import { renderApiSettingsView } from './modules/apiSettings.js'; // ✨引入 API 设置

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化视口与顶部时钟
  initViewportHeight();
  updateClock();
  setInterval(updateClock, 1000 * 15);

  // 2. 初始化系统侧边栏
  initAppDrawer((targetAppId) => {
    switchApp(targetAppId);
  });

  // 3. 初始化 Chat 内部 Dock
  initChatDock();

  // 4. 默认加载 Chat 应用首页
  const chatImessagePanel = document.getElementById('view-imessage');
  renderIMessageView(chatImessagePanel);
});

/**
 * 全局系统 App 切换总控
 */
function switchApp(appId) {
  const appViews = document.querySelectorAll('.app-view-container');
  appViews.forEach(view => view.classList.remove('active'));

  const targetView = document.getElementById(`${appId}-root`);
  if (targetView) {
    targetView.classList.add('active');

    // 路由分发按需渲染
    if (appId === 'app-api') {
      renderApiSettingsView(targetView);
    }
  }
}

/**
 * Chat 应用专属 Dock 切换
 */
function initChatDock() {
  const dockItems = document.querySelectorAll('.dock-item');
  const panels = {
    imessage: document.getElementById('view-imessage'),
    moments: document.getElementById('view-moments'),
    characters: document.getElementById('view-characters'),
    user: document.getElementById('view-user')
  };

  dockItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!panels[target]) return;

      dockItems.forEach(i => i.classList.remove('active'));
      btn.classList.add('active');

      Object.keys(panels).forEach(key => panels[key].classList.remove('active'));
      panels[target].classList.add('active');

      if (target === 'imessage') renderIMessageView(panels.imessage);
      if (target === 'moments') renderMomentsView(panels.moments);
      if (target === 'characters') renderCharactersView(panels.characters);
      if (target === 'user') renderUserView(panels.user);
    });
  });
}

function updateClock() {
  const timeEl = document.getElementById('current-time');
  if (!timeEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${minutes}`;
}

function initViewportHeight() {
  const setHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };
  setHeight();
  window.addEventListener('resize', setHeight);
  window.addEventListener('orientationchange', setHeight);
}
