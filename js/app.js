import { renderIMessageView } from './modules/imessage.js';
import { renderCharactersView } from './modules/characters.js';
import { renderUserView } from './modules/user.js';
import { renderApiSettingsView } from './modules/apiSettings.js';
import { renderWalletView } from './modules/wallet.js';
import { renderMessagesView } from './modules/messages.js';

// 系统应用配置表 (INS 极简白黑风格)
const SYSTEM_APPS = [
  { id: 'chat', name: 'CHAT', desc: '信息 · 动态 · 角色中枢', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>` },
  { id: 'api', name: 'API 设置', desc: '模型接口 · 端点与Key配置', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` },
  { id: 'theme', name: '美化', desc: '壁纸气泡 · 字体与质感', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20v-5a5 5 0 0 1 0-10V2z"/></svg>` },
  { id: 'diary', name: '日记', desc: '私密日记 · 心情与随笔', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` },
  { id: 'messages', name: '短信', desc: '系统验证 · 银行与通知', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>` },
  { id: 'music', name: '音乐', desc: '黑胶唱片 · 律动与白噪', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>` },
  { id: 'inspect', name: '查手机', desc: '窥探模式 · 秘密相册与记录', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="1"/></svg>` },
  { id: 'social', name: '社交', desc: '圈子广场 · 动态连结分享', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>` },
  { id: 'worldbook', name: '世界书', desc: '世界观设定 · 词条规则集', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/></svg>` },
  { id: 'overworld', name: '大世界', desc: '场景探索 · 地图与漫游', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>` },
  { id: 'market', name: '闲鱼', desc: '二手置换 · 好物奇遇', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><circle cx="12" cy="15" r="1"/></svg>` },
  { id: 'lofter', name: '老福特', desc: '创作同人 · 粮仓集散地', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>` },
  { id: 'secret', name: '你懂得', desc: '秘密沙盒 · 私享空间', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` }
];

let currentActiveApp = 'chat';

// ════════════════════ 1. 初始化 Chat 内部 Dock 导航 ════════════════════
export function initDockNavigation() {
  const dockButtons = document.querySelectorAll('.dock-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  dockButtons.forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');

      dockButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      viewPanels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`view-${target}`);
      if (activePanel) {
        activePanel.classList.add('active');
        renderDockTargetView(target, activePanel);
      }
    };
  });

  // 默认渲染第一个消息页面
  const defaultPanel = document.getElementById('view-imessage');
  if (defaultPanel) renderIMessageView(defaultPanel);
}

function renderDockTargetView(target, panel) {
  if (target === 'imessage') {
    renderIMessageView(panel);
  } else if (target === 'characters') {
    renderCharactersView(panel);
  } else if (target === 'user') {
    renderUserView(panel);
  } else if (target === 'settings') {
    renderApiSettingsView(panel);
  } else if (target === 'wallet') { // ✨ 接入独立钱包渲染
    renderWalletView(panel);
  } else if (target === 'stickers') {
    renderStickersGalleryView(panel);
  } else if (target === 'theme') {
    renderThemeCustomView(panel);
  } else if (target === 'games') {
    renderGamesCenterView(panel);
  } else if (target === 'moments') {
    renderMomentsView(panel);
  }
}

// ════════════════════ 2. 初始化全局侧边栏 (SYSTEM HUB) ════════════════════
export function initSystemHubSidebar() {
  let sidebarEl = document.getElementById('system-hub-sidebar-drawer');
  if (!sidebarEl) {
    sidebarEl = document.createElement('div');
    sidebarEl.id = 'system-hub-sidebar-drawer';
    sidebarEl.className = 'system-hub-drawer-wrap';
    document.body.appendChild(sidebarEl);
  }

  sidebarEl.innerHTML = `
    <!-- 屏幕最左侧微型呼出手柄 -->
    <div class="system-hub-edge-handle" id="btn-trigger-system-hub" title="点击或右滑展开系统目录">
      <span class="hub-edge-bar"></span>
    </div>

    <!-- 遮罩 -->
    <div class="system-hub-backdrop" id="system-hub-backdrop"></div>

    <!-- 侧边抽屉 -->
    <aside class="system-hub-sheet" id="system-hub-sheet">
      <div class="hub-sheet-header">
        <div class="hub-header-left">
          <span class="hub-title">SYSTEM HUB</span>
          <span class="hub-sub-title">MINI PHONE OS · 12 APPS</span>
        </div>
        <button class="hub-close-btn" id="btn-close-system-hub" title="关闭目录">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="hub-apps-scroll-list">
        ${SYSTEM_APPS.map(app => {
          const isActive = currentActiveApp === app.id;
          return `
            <div class="hub-app-card ${isActive ? 'active' : ''}" data-hub-app="${app.id}">
              <div class="hub-app-icon-box">${app.icon}</div>
              <div class="hub-app-info">
                <span class="hub-app-name">${app.name}</span>
                <span class="hub-app-desc">${app.desc}</span>
              </div>
              <span class="hub-app-indicator"></span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="hub-sheet-footer">
        <span class="hub-footer-status">
          <span class="hub-status-dot"></span>
          <span>ALL SYSTEMS ONLINE</span>
        </span>
        <span class="hub-footer-ver">OS 1.0</span>
      </div>
    </aside>
  `;

  const edgeHandle = sidebarEl.querySelector('#btn-trigger-system-hub');
  const backdrop = sidebarEl.querySelector('#system-hub-backdrop');
  const closeBtn = sidebarEl.querySelector('#btn-close-system-hub');

  const openDrawer = () => sidebarEl.classList.add('open');
  const closeDrawer = () => sidebarEl.classList.remove('open');

  if (edgeHandle) edgeHandle.onclick = openDrawer;
  if (backdrop) backdrop.onclick = closeDrawer;
  if (closeBtn) closeBtn.onclick = closeDrawer;

  sidebarEl.querySelectorAll('[data-hub-app]').forEach(card => {
    card.onclick = () => {
      const appId = card.getAttribute('data-hub-app');
      switchSystemApp(appId);
      closeDrawer();
    };
  });

  // 支持屏幕边缘右滑呼出
  let touchStartX = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX < 30 && touchEndX - touchStartX > 40) {
      openDrawer();
    }
  }, { passive: true });
}

export function switchSystemApp(appId) {
  // 1. 统一提取 cleanId (如 'app-api' -> 'api')
  const cleanId = appId.startsWith('app-') ? appId.replace('app-', '') : appId;
  currentActiveApp = cleanId;

  // 2. 隐藏所有顶层应用视口
  const allContainers = document.querySelectorAll('.app-view-container');
  allContainers.forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none'; // 强制隐藏其他页面
  });

  // 3. 找到目标容器并以 flex 撑满视口激活展示
  const targetRoot = document.getElementById(`app-${cleanId}-root`) || document.getElementById(`app-${appId}-root`) || document.getElementById(appId);
  if (targetRoot) {
    targetRoot.classList.add('active');
    targetRoot.style.display = 'flex'; // 撑满视口，彻底告别空白
    targetRoot.style.width = '100%';
    targetRoot.style.height = '100%';
  }

  // 4. 挂载具体应用的核心主视图
  if (cleanId === 'api' && targetRoot) {
    renderApiSettingsView(targetRoot); // ✨ 立即渲染 API 设置中枢
  } else if (cleanId === 'messages' && targetRoot) {
    renderMessagesView(targetRoot);
  }

  // 5. 同步所有侧边栏抽屉卡片的高亮状态
  document.querySelectorAll('[data-hub-app], [data-app-id]').forEach(card => {
    const cardId = card.getAttribute('data-hub-app') || card.getAttribute('data-app-id');
    const cleanCardId = cardId.startsWith('app-') ? cardId.replace('app-', '') : cardId;
    card.classList.toggle('active', cleanCardId === cleanId);
  });
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', () => {
  initDockNavigation();
  initSystemHubSidebar();

  // 如果引入了 appDrawer 模块，同样注册联动
  if (window.initAppDrawer) {
    window.initAppDrawer(switchSystemApp);
  }
});
