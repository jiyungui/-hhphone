// 系统中已注册的 12 个核心应用板块
export const SYSTEM_APPS = [
  {
    id: 'app-chat',
    name: 'CHAT',
    desc: '信息 · 动态 · 角色中枢',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  },
  {
    id: 'app-api',
    name: 'API 设置',
    desc: '模型接口 · 端点与Key配置',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`
  },
  {
    id: 'app-theme',
    name: '美化',
    desc: '壁纸气泡 · 字体与质感',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.03-.23-.28-.38-.63-.38-1.01 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-9-10-9z"/></svg>`
  },
  {
    id: 'app-diary',
    name: '日记',
    desc: '私密日记 · 心情与随笔',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="13" y2="11"/></svg>`
  },
  {
    id: 'app-messages',
    name: '短信',
    desc: '系统通知 · 验证码与信息',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  },
  {
    id: 'app-music',
    name: '音乐',
    desc: '黑胶唱片 · 律动与白噪',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="4"/><path d="M18 10l3-2"/></svg>`
  },
  {
    id: 'app-inspect',
    name: '查手机',
    desc: '窥探模式 · 秘密相册与记录',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 3"/><circle cx="12" cy="14.5" r=".5" fill="currentColor"/></svg>`
  },
  {
    id: 'app-social',
    name: '社交',
    desc: '圈子广场 · 动态连结分享',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`
  },
  {
    id: 'app-worldbook',
    name: '世界书',
    desc: '世界观设定 · 词条规则集',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3v18"/></svg>`
  },
  {
    id: 'app-overworld',
    name: '大世界',
    desc: '场景探索 · 地图与漫游',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`
  },
  {
    id: 'app-market',
    name: '闲鱼',
    desc: '二手置换 · 角色物品集市',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/><circle cx="12" cy="15" r="1"/></svg>`
  },
  {
    id: 'app-lofter',
    name: '老福特',
    desc: '图文创作 · 同人粮仓基地',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`
  },
  {
    id: 'app-secret',
    name: '你懂得',
    desc: '隐秘专区 · 私享解锁空间',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5"/><line x1="12" y1="17.5" x2="12" y2="19.5"/></svg>`
  }
];

let currentActiveAppId = 'app-chat';
let onAppSwitchCallback = null;

export function initAppDrawer(onSwitch) {
  onAppSwitchCallback = onSwitch;
  renderDrawerDom();
  bindDrawerEvents();
}

function renderDrawerDom() {
  const phoneBody = document.querySelector('.phone-body');
  if (!phoneBody) return;

  const edgeZone = document.createElement('div');
  edgeZone.className = 'edge-swipe-zone';
  edgeZone.id = 'edge-swipe-zone';
  edgeZone.innerHTML = `<div class="edge-swipe-indicator"></div>`;

  const mask = document.createElement('div');
  mask.className = 'app-drawer-mask';
  mask.id = 'app-drawer-mask';

  const sidebar = document.createElement('aside');
  sidebar.className = 'app-drawer-sidebar';
  sidebar.id = 'app-drawer-sidebar';
  sidebar.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-os-title">
        <span class="drawer-os-name">SYSTEM HUB</span>
        <span class="drawer-os-version">MINI PHONE OS · 12 APPS</span>
      </div>
      <button class="drawer-close-btn" id="drawer-close-btn" title="收起">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <!-- 12 个应用滚动列表 -->
    <ul class="drawer-app-list" id="drawer-app-list">
      ${SYSTEM_APPS.map(app => `
        <li class="drawer-app-item ${app.id === currentActiveAppId ? 'active' : ''}" data-app-id="${app.id}">
          <div class="drawer-app-icon">${app.icon}</div>
          <div class="drawer-app-info">
            <span class="drawer-app-name">${app.name}</span>
            <span class="drawer-app-desc">${app.desc}</span>
          </div>
          ${app.id === currentActiveAppId ? '<div class="drawer-app-dot"></div>' : ''}
        </li>
      `).join('')}
    </ul>

    <div class="drawer-footer">
      <div class="drawer-status-chip">
        <div class="drawer-live-pulse"></div>
        <span>ALL SYSTEMS ONLINE</span>
      </div>
      <span>OS 1.0</span>
    </div>
  `;

  phoneBody.appendChild(edgeZone);
  phoneBody.appendChild(mask);
  phoneBody.appendChild(sidebar);
}

function bindDrawerEvents() {
  const mask = document.getElementById('app-drawer-mask');
  const sidebar = document.getElementById('app-drawer-sidebar');
  const edgeZone = document.getElementById('edge-swipe-zone');
  const closeBtn = document.getElementById('drawer-close-btn');

  edgeZone.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  mask.addEventListener('click', closeDrawer);

  // 手势滑动引擎
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    if (touchStartX <= 45 && diffX > 40 && diffY < 60) {
      openDrawer();
    }
  }, { passive: true });

  sidebar.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    if (diffX < -40) {
      closeDrawer();
    }
  }, { passive: true });

  // 绑定应用点击切换
  const appItems = sidebar.querySelectorAll('.drawer-app-item');
  appItems.forEach(item => {
    item.addEventListener('click', () => {
      const appId = item.getAttribute('data-app-id');
      if (appId !== currentActiveAppId) {
        currentActiveAppId = appId;
        appItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        if (onAppSwitchCallback) {
          onAppSwitchCallback(appId);
        }
      }
      closeDrawer();
    });
  });
}

export function openDrawer() {
  document.getElementById('app-drawer-mask')?.classList.add('active');
  document.getElementById('app-drawer-sidebar')?.classList.add('active');
}

export function closeDrawer() {
  document.getElementById('app-drawer-mask')?.classList.remove('active');
  document.getElementById('app-drawer-sidebar')?.classList.remove('active');
}
