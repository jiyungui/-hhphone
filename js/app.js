import { renderIMessageView } from './modules/imessage.js';
import { renderCharactersView } from './modules/characters.js';
import { renderUserView } from './modules/user.js';
import { renderApiSettingsView } from './modules/apiSettings.js';

/**
 * 8 大 Dock 项切换与页面渲染
 */
export function initDockNavigation() {
  const dockButtons = document.querySelectorAll('.dock-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  dockButtons.forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');

      // 1. 切换 Dock 高亮
      dockButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. 切换内容视图 Panel
      viewPanels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`view-${target}`);
      if (activePanel) {
        activePanel.classList.add('active');
        renderDockTargetView(target, activePanel);
      }
    };
  });

  // 默认渲染第一个（消息）
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
    renderApiSettingsView(panel); // 直连系统 API、记忆库与总结设置
  } else if (target === 'stickers') {
    renderStickersGalleryView(panel); // 表情包库
  } else if (target === 'theme') {
    renderThemeCustomView(panel); // 美化中心
  } else if (target === 'games') {
    renderGamesCenterView(panel); // 互动游戏
  } else if (target === 'moments') {
    renderMomentsView(panel); // 动态
  }
}

// ════════════ 4 大新增板块的 INS 极简白黑风渲染函数 (绝无 Emoji) ════════════

// 1. 表情包库视图
function renderStickersGalleryView(container) {
  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding: 0 14px 14px 14px; overflow-y:auto;">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--line-color);">
        <span class="user-header-title" style="font-size:16px; font-weight:800; color:#111;">Stickers</span>
        <span class="user-count-badge" style="font-size:9.5px; font-weight:700; color:#888;">STICKER VAULT</span>
      </div>
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        <div class="api-card" style="border: 1px solid var(--line-color); border-radius:10px; padding:12px; background:#FFF;">
          <div style="font-size:11.5px; font-weight:800; color:#111; margin-bottom:4px;">默认表情包预设</div>
          <span style="font-size:9.5px; color:#888;">聊天中可随时在「更多 ➔ 表情包」中快速发送极简线条表情。</span>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-top:8px;">
            <div style="padding:6px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:6px; text-align:center; font-size:10px; font-weight:700;">[暗中观察]</div>
            <div style="padding:6px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:6px; text-align:center; font-size:10px; font-weight:700;">[叹气]</div>
            <div style="padding:6px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:6px; text-align:center; font-size:10px; font-weight:700;">[给心心]</div>
            <div style="padding:6px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:6px; text-align:center; font-size:10px; font-weight:700;">[问号]</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. 美化中心视图
function renderThemeCustomView(container) {
  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding: 0 14px 14px 14px; overflow-y:auto;">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--line-color);">
        <span class="user-header-title" style="font-size:16px; font-weight:800; color:#111;">Theme & Style</span>
        <span class="user-count-badge" style="font-size:9.5px; font-weight:700; color:#888;">INS LINEAR B&W</span>
      </div>
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
        <div class="api-card" style="border: 1px solid var(--line-color); border-radius:10px; padding:12px; background:#FFF;">
          <div style="font-size:11.5px; font-weight:800; color:#111; margin-bottom:4px;">极简白黑线条风 (当前主题)</div>
          <span style="font-size:9.5px; color:#888; line-height:1.4;">纯粹白底黑线设计、时间戳外置、连发首条头像、零 Emoji。</span>
        </div>
      </div>
    </div>
  `;
}

// 3. 游戏中心视图
function renderGamesCenterView(container) {
  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding: 0 14px 14px 14px; overflow-y:auto;">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--line-color);">
        <span class="user-header-title" style="font-size:16px; font-weight:800; color:#111;">Games Hub</span>
        <span class="user-count-badge" style="font-size:9.5px; font-weight:700; color:#888;">INTERACTION</span>
      </div>
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        <div class="api-card" style="border: 1px solid var(--line-color); border-radius:10px; padding:12px; background:#FFF;">
          <div style="font-size:11.5px; font-weight:800; color:#111; margin-bottom:2px;">双人互动小游戏 (准备就绪)</div>
          <span style="font-size:9.5px; color:#888;">在聊天中与 Char 发起投骰子、抽塔罗牌或真心话大冒险对决。</span>
        </div>
      </div>
    </div>
  `;
}

// 4. 动态广场视图
function renderMomentsView(container) {
  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding: 0 14px 14px 14px; overflow-y:auto;">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--line-color);">
        <span class="user-header-title" style="font-size:16px; font-weight:800; color:#111;">Moments</span>
        <span class="user-count-badge" style="font-size:9.5px; font-weight:700; color:#888;">TIMELINE</span>
      </div>
      <div style="padding: 40px 0; text-align: center; font-size: 10.5px; color: var(--text-muted);">
        暂无新动态更新，角色在后台活动时将在此发布生活切片
      </div>
    </div>
  `;
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', () => {
  initDockNavigation();
});
