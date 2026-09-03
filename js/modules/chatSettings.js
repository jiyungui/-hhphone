// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · CHAT 专属设置与通知中枢 (CHAT SETTINGS)
// 移动端切后台保活 · 全局弹窗提醒 · 铃声管理与角色绑定 · 严禁 Emoji
// ═══════════════════════════════════════════════════════════════

const CHAT_PREFS_KEY = 'mini_chat_room_preferences';
const RINGTONES_VAULT_KEY = 'mini_chat_ringtones_vault';
const CHAR_RINGTONE_BINDINGS_KEY = 'mini_char_ringtone_bindings';

// 默认 Chat 偏好配置
const DEFAULT_CHAT_PREFS = {
  keepAliveAudio: false,    // 后台静音音频保活
  popupNotification: true,  // 全局弹窗提醒 (系统通知 + 内部灵动岛)
  soundEnabled: true        // 收到消息播放提示音
};

// 默认内置铃声
const DEFAULT_RINGTONES = [
  { id: 'default-chime', name: '极简脉冲短音 (Classic Chime)', isDefault: true, url: '' }
];

let audioKeepAliveEl = null;

export function getChatPreferences() {
  const saved = localStorage.getItem(CHAT_PREFS_KEY);
  if (!saved) return { ...DEFAULT_CHAT_PREFS };
  try {
    return { ...DEFAULT_CHAT_PREFS, ...JSON.parse(saved) };
  } catch (e) {
    return { ...DEFAULT_CHAT_PREFS };
  }
}

export function saveChatPreferences(prefs) {
  localStorage.setItem(CHAT_PREFS_KEY, JSON.stringify(prefs));
  applyKeepAliveState(prefs.keepAliveAudio);
}

// 铃声库存取
export function getRingtonesVault() {
  const saved = localStorage.getItem(RINGTONES_VAULT_KEY);
  if (!saved) return [...DEFAULT_RINGTONES];
  try {
    return JSON.parse(saved);
  } catch (e) {
    return [...DEFAULT_RINGTONES];
  }
}

export function saveRingtonesVault(list) {
  localStorage.setItem(RINGTONES_VAULT_KEY, JSON.stringify(list));
}

// 角色专属铃声绑定存取 { [charName]: ringtoneId }
export function getCharRingtoneBindings() {
  const saved = localStorage.getItem(CHAR_RINGTONE_BINDINGS_KEY);
  if (!saved) return {};
  try {
    return JSON.parse(saved);
  } catch (e) {
    return {};
  }
}

export function saveCharRingtoneBindings(bindings) {
  localStorage.setItem(CHAR_RINGTONE_BINDINGS_KEY, JSON.stringify(bindings));
}

// 播放默认的 Web Audio 高级合成脉冲音
function playDefaultSynthesizedChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {
    console.warn('[Audio Synth Notice]', e);
  }
}

// 核心：触发角色消息提示音 (支持角色专属铃声绑定)
export function playCharNotificationSound(charName) {
  const prefs = getChatPreferences();
  if (!prefs.soundEnabled) return;

  const bindings = getCharRingtoneBindings();
  const ringtoneId = bindings[charName] || 'default-chime';

  if (ringtoneId === 'default-chime') {
    playDefaultSynthesizedChime();
    return;
  }

  const vault = getRingtonesVault();
  const matched = vault.find(r => r.id === ringtoneId);
  if (matched && matched.url) {
    const audio = new Audio(matched.url);
    audio.play().catch(e => {
      console.warn('[Custom Ringtone Play Fail]', e);
      playDefaultSynthesizedChime();
    });
  } else {
    playDefaultSynthesizedChime();
  }
}

// 核心：触发全局消息通知 (系统 Notification + 内部灵动岛弹窗)
export function triggerGlobalMessageNotification(charInfo, messageText) {
  const prefs = getChatPreferences();
  if (!prefs.popupNotification) return;

  // 1. 播放提示音
  playCharNotificationSound(charInfo.name);

  // 2. 移动端/桌面后台系统通知 (当页面不在前台时)
  if (document.hidden && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(charInfo.name, {
        body: messageText || '发来了一条新消息',
        icon: charInfo.avatarUrl || ''
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  // 3. 项目内部灵动岛弹窗 (不在当前聊天室时弹出)
  const currentOpenRoom = document.getElementById('chat-room-instance');
  const isCurrentlyInThisRoom = currentOpenRoom && currentOpenRoom.getAttribute('data-active-char') === charInfo.name;

  if (!isCurrentlyInThisRoom) {
    showInAppIslandNotification(charInfo, messageText);
  }
}

// 呈现项目内部顶部灵动岛通知条
function showInAppIslandNotification(charInfo, text) {
  const existing = document.getElementById('mini-island-notification');
  if (existing) existing.remove();

  const island = document.createElement('div');
  island.id = 'mini-island-notification';
  island.style.cssText = `
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%) translateY(-30px);
    width: 90%;
    max-width: 340px;
    background: #111111;
    color: #FFFFFF;
    border: 1.2px solid #333333;
    border-radius: 24px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    z-index: 99999;
    cursor: pointer;
    opacity: 0;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  `;

  island.innerHTML = `
    <div style="width:26px; height:26px; border-radius:50%; border:1px solid #FFF; overflow:hidden; background:#222; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
      ${charInfo.avatarUrl ? `<img src="${charInfo.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:7px; font-weight:800;">${charInfo.name.slice(0,2)}</span>`}
    </div>
    <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:9.5px; font-weight:900; color:#FFF;">${escapeHtml(charInfo.name)}</span>
        <span style="font-size:7.5px; color:#888; font-family:ui-monospace, monospace;">刚刚</span>
      </div>
      <span style="font-size:8.5px; color:#DDD; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${escapeHtml(text || '发来了一条新消息')}
      </span>
    </div>
  `;

  document.body.appendChild(island);

  // 动画滑入
  requestAnimationFrame(() => {
    island.style.opacity = '1';
    island.style.transform = 'translateX(-50%) translateY(0)';
  });

  // 点击自动跳转进该角色的聊天室
  island.onclick = () => {
    island.remove();
    import('./chatRoom.js').then(m => {
      const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
      const targetChar = charVault.find(c => c.name === charInfo.name) || charInfo;
      const appChatRoot = document.getElementById('app-chat-root');
      if (appChatRoot) m.openChatRoom(targetChar, appChatRoot);
    });
  };

  // 4秒后自动淡出消失
  setTimeout(() => {
    if (island.parentElement) {
      island.style.opacity = '0';
      island.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => island.remove(), 250);
    }
  }, 4000);
}

// 静音保活核心引擎
function applyKeepAliveState(enable) {
  if (enable) {
    if (!audioKeepAliveEl) {
      audioKeepAliveEl = document.createElement('audio');
      audioKeepAliveEl.id = 'mini-silent-audio-keepalive';
      audioKeepAliveEl.loop = true;
      audioKeepAliveEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      document.body.appendChild(audioKeepAliveEl);
    }
    audioKeepAliveEl.play().catch(() => {});
  } else {
    if (audioKeepAliveEl) {
      audioKeepAliveEl.pause();
      audioKeepAliveEl.remove();
      audioKeepAliveEl = null;
    }
  }
}

export function initChatKeepAliveEngine() {
  const prefs = getChatPreferences();
  if (prefs.keepAliveAudio) {
    applyKeepAliveState(true);
  }
  // 请求系统通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// 渲染 Chat 设置面板主页面
export function renderChatSettingsView(container) {
  const prefs = getChatPreferences();
  const ringtones = getRingtonesVault();
  const bindings = getCharRingtoneBindings();
  const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  const chatList = JSON.parse(localStorage.getItem('mini_active_chat_list') || '[]');

  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 14px 14px 14px; overflow-y:auto; background:var(--chat-ui-bg, #FFF);">
      <!-- 顶栏 -->
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--chat-ui-border, #111);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="user-header-title" style="font-size:15px; font-weight:900; color:var(--chat-ui-text-main, #111);">CHAT SETTINGS</span>
          <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid var(--chat-ui-border, #111); padding:1px 4px; border-radius:3px;">NOTIFICATIONS & AUDIO</span>
        </div>
        <span class="user-count-badge" style="font-size:8.5px; font-weight:800;">聊天设置</span>
      </div>

      <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
        <!-- 板块 1：移动端切后台保活 -->
        <div class="ins-settings-card" style="padding:12px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:11.5px; font-weight:900; color:var(--chat-ui-text-main, #111);">后台静音音频保活 (KEEP-ALIVE)</span>
              <span style="font-size:8px; color:var(--chat-ui-text-sub, #888);">防止切后台或锁屏时 Char 回复被系统截断</span>
            </div>
            <label class="ins-switch" style="position:relative; width:36px; height:20px; display:inline-block;">
              <input type="checkbox" id="chk-pref-keepalive" ${prefs.keepAliveAudio ? 'checked' : ''} style="opacity:0; width:0; height:0;" />
              <span class="ins-slider-switch" style="position:absolute; cursor:pointer; inset:0; background:${prefs.keepAliveAudio ? '#111' : '#CCC'}; border-radius:20px; transition:0.2s;">
                <span style="position:absolute; height:14px; width:14px; left:${prefs.keepAliveAudio ? '18px' : '3px'}; bottom:3px; background:#FFF; border-radius:50%; transition:0.2s;"></span>
              </span>
            </label>
          </div>
          <p style="font-size:8px; color:var(--chat-ui-text-sub, #888); line-height:1.45; margin:0; border-top:1px dashed #EAEAEA; padding-top:6px;">
            开启后将在底层循环运行 0 字节静音音频流，向手机申请后台挂起保护，确保锁屏或使用其他 App 也能完整收到回复。
          </p>
        </div>

        <!-- 板块 2：全局消息弹窗提醒 -->
        <div class="ins-settings-card" style="padding:12px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:11.5px; font-weight:900; color:var(--chat-ui-text-main, #111);">消息弹窗提醒 (POPUP NOTICE)</span>
              <span style="font-size:8px; color:var(--chat-ui-text-sub, #888);">切后台系统通知 + 站内顶部灵动岛即时提醒</span>
            </div>
            <label class="ins-switch" style="position:relative; width:36px; height:20px; display:inline-block;">
              <input type="checkbox" id="chk-pref-popup" ${prefs.popupNotification ? 'checked' : ''} style="opacity:0; width:0; height:0;" />
              <span class="ins-slider-switch" style="position:absolute; cursor:pointer; inset:0; background:${prefs.popupNotification ? '#111' : '#CCC'}; border-radius:20px; transition:0.2s;">
                <span style="position:absolute; height:14px; width:14px; left:${prefs.popupNotification ? '18px' : '3px'}; bottom:3px; background:#FFF; border-radius:50%; transition:0.2s;"></span>
              </span>
            </label>
          </div>
          <p style="font-size:8px; color:var(--chat-ui-text-sub, #888); line-height:1.45; margin:0; border-top:1px dashed #EAEAEA; padding-top:6px;">
            在浏览其他板块或不在该聊天室时，顶部将滑出黑色灵动岛提示，点击可直接跳入该会话。
          </p>
        </div>

        <!-- 板块 3：铃声管理与角色专属铃声绑定 -->
        <div class="ins-settings-card" style="padding:12px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:11.5px; font-weight:900; color:var(--chat-ui-text-main, #111);">提示铃声中枢 (RINGTONES)</span>
              <span style="font-size:8px; color:var(--chat-ui-text-sub, #888);">上传自定义音频 · 为不同 Char 绑定专属提示音</span>
            </div>
            <label class="ins-switch" style="position:relative; width:36px; height:20px; display:inline-block;">
              <input type="checkbox" id="chk-pref-sound" ${prefs.soundEnabled ? 'checked' : ''} style="opacity:0; width:0; height:0;" />
              <span class="ins-slider-switch" style="position:absolute; cursor:pointer; inset:0; background:${prefs.soundEnabled ? '#111' : '#CCC'}; border-radius:20px; transition:0.2s;">
                <span style="position:absolute; height:14px; width:14px; left:${prefs.soundEnabled ? '18px' : '3px'}; bottom:3px; background:#FFF; border-radius:50%; transition:0.2s;"></span>
              </span>
            </label>
          </div>

          <!-- 上传新铃声卡片 -->
          <div class="ins-upload-dashed-card" id="btn-upload-ringtone" style="padding:10px; background:#FFF; border:1px dashed #111; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span style="font-size:9.5px; font-weight:800; color:#111;">上传本地自定义音频 (MP3/WAV)</span>
            <input type="file" id="input-ringtone-file" accept="audio/*" style="display:none;" />
          </div>

          <!-- 铃声库列表 -->
          <div style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:8.5px; font-weight:800; color:#888;">已存铃声库 (${ringtones.length})</span>
            ${ringtones.map(r => `
              <div style="background:#FFF; border:1px solid #111; border-radius:6px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:9.5px; font-weight:800; color:#111;">${escapeHtml(r.name)}</span>
                  ${r.isDefault ? `<span style="font-size:7px; font-weight:800; background:#EAEAEA; padding:1px 4px; border-radius:3px;">默认</span>` : ''}
                </div>
                <div style="display:flex; gap:4px;">
                  <button class="ins-card-action-btn btn-audition-ringtone" data-id="${r.id}" style="padding:2px 8px; font-size:8px;">试听 ▷</button>
                  ${!r.isDefault ? `<button class="ins-card-action-btn del btn-delete-ringtone" data-id="${r.id}" style="padding:2px 6px; font-size:8px;">×</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- 为角色单独绑定专属铃声 -->
          <div style="display:flex; flex-direction:column; gap:6px; border-top:1px dashed #EAEAEA; padding-top:8px;">
            <span style="font-size:8.5px; font-weight:800; color:#888;">角色专属铃声独立绑定</span>
            ${charVault.length === 0 ? `<div style="font-size:8px; color:#999; padding:6px 0;">角色库暂无角色，录入后可在此为各角色分配铃声</div>` : charVault.map(c => {
              const currentBoundId = bindings[c.name] || 'default-chime';
              const boundRingtone = ringtones.find(r => r.id === currentBoundId) || ringtones[0];
              return `
                <div style="background:#FFF; border:1px solid #EAEAEA; border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:20px; height:20px; border-radius:50%; background:#111; overflow:hidden; border:1px solid #111;">
                      ${c.avatarUrl ? `<img src="${c.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : ''}
                    </div>
                    <span style="font-size:9.5px; font-weight:800; color:#111;">${escapeHtml(c.name)}</span>
                  </div>
                  <button class="ins-card-action-btn btn-bind-char-ringtone" data-char="${escapeHtml(c.name)}" style="padding:3px 8px; font-size:8px; background:#FAFAFA; border:1px solid #111; color:#111;">
                    ${escapeHtml(boundRingtone.name.slice(0, 10))} ✎
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 板块 4：消息备份与数据管理 -->
        <div class="ins-settings-card" style="padding:12px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; display:flex; flex-direction:column; gap:8px;">
          <span style="font-size:10px; font-weight:800; color:var(--chat-ui-text-sub, #666); letter-spacing:0.5px;">消息数据与备份管理</span>
          <div style="font-size:8.5px; color:var(--chat-ui-text-sub, #888);">
            当前活跃对话共 <strong>${chatList.length}</strong> 个，所有记录均保存在本设备沙盒存储中。
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button class="ins-card-action-btn" id="btn-export-all-chat-history" style="flex:1; padding:7px 0; font-size:9px; font-weight:800; background:#FFF; border:1px solid #111; color:#111;">
              导出所有聊天记录
            </button>
            <button class="ins-card-action-btn del" id="btn-clear-chat-dialogs" style="flex:1; padding:7px 0; font-size:9px; font-weight:800;">
              清空对话列表
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 1. 绑定保活开关
  const keepAliveChk = container.querySelector('#chk-pref-keepalive');
  if (keepAliveChk) {
    keepAliveChk.onchange = () => {
      prefs.keepAliveAudio = keepAliveChk.checked;
      saveChatPreferences(prefs);
      renderChatSettingsView(container);
    };
  }

  // 2. 绑定弹窗通知开关
  const popupChk = container.querySelector('#chk-pref-popup');
  if (popupChk) {
    popupChk.onchange = () => {
      prefs.popupNotification = popupChk.checked;
      saveChatPreferences(prefs);
      if (popupChk.checked && 'Notification' in window) {
        Notification.requestPermission();
      }
    };
  }

  // 3. 绑定声音开关
  const soundChk = container.querySelector('#chk-pref-sound');
  if (soundChk) {
    soundChk.onchange = () => {
      prefs.soundEnabled = soundChk.checked;
      saveChatPreferences(prefs);
    };
  }

  // 4. 上传铃声并命名
  const upRingBtn = container.querySelector('#btn-upload-ringtone');
  const upRingInput = container.querySelector('#input-ringtone-file');
  if (upRingBtn && upRingInput) {
    upRingBtn.onclick = () => {
      upRingInput.value = '';
      upRingInput.click();
    };
    upRingInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const customName = prompt('请为上传的铃声命名：', file.name.replace(/\.[^/.]+$/, ''));
        if (customName) {
          const newRingtone = {
            id: `ring-${Date.now()}`,
            name: customName.trim(),
            url: evt.target.result,
            isDefault: false
          };
          ringtones.push(newRingtone);
          saveRingtonesVault(ringtones);
          renderChatSettingsView(container);
        }
      };
      reader.readAsDataURL(file);
    };
  }

  // 5. 试听铃声
  container.querySelectorAll('.btn-audition-ringtone').forEach(btn => {
    btn.onclick = () => {
      const rId = btn.getAttribute('data-id');
      const target = ringtones.find(r => r.id === rId);
      if (target) {
        if (target.isDefault) playDefaultSynthesizedChime();
        else if (target.url) new Audio(target.url).play();
      }
    };
  });

  // 6. 删除自定义铃声
  container.querySelectorAll('.btn-delete-ringtone').forEach(btn => {
    btn.onclick = () => {
      const rId = btn.getAttribute('data-id');
      let list = ringtones.filter(r => r.id !== rId);
      saveRingtonesVault(list);
      renderChatSettingsView(container);
    };
  });

  // 7. 为特定 Char 绑定铃声
  container.querySelectorAll('.btn-bind-char-ringtone').forEach(btn => {
    btn.onclick = () => {
      const charName = btn.getAttribute('data-char');
      openRingtonePickerModal(charName, ringtones, (selectedRingtoneId) => {
        bindings[charName] = selectedRingtoneId;
        saveCharRingtoneBindings(bindings);
        renderChatSettingsView(container);
      });
    };
  });

  // 8. 导出与清空
  const exportBtn = container.querySelector('#btn-export-all-chat-history');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const allData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('mini_chat_dialog_history_') || key === 'mini_active_chat_list') {
          allData[key] = JSON.parse(localStorage.getItem(key) || '[]');
        }
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-history-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  const clearBtn = container.querySelector('#btn-clear-chat-dialogs');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('确定清空当前所有角色的会话列表吗？角色设定与画像将完好保留。')) {
        localStorage.removeItem('mini_active_chat_list');
        renderChatSettingsView(container);
      }
    };
  }
}

// 专属角色铃声选择弹窗
function openRingtonePickerModal(charName, ringtones, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'sticker-modal-overlay';
  overlay.innerHTML = `
    <div class="sticker-modal-card" style="max-width:300px; gap:8px;">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">为【${escapeHtml(charName)}】绑定提示音</span>
        <button class="sticker-modal-close" id="btn-close-ring-picker">×</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; max-height:240px; overflow-y:auto;">
        ${ringtones.map(r => `
          <div class="ring-option-item" data-id="${r.id}" style="padding:8px 10px; background:#FAFAFA; border:1.2px solid #111; border-radius:6px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span style="font-size:10px; font-weight:800; color:#111;">${escapeHtml(r.name)}</span>
            <button class="ins-card-action-btn use" style="padding:2px 8px; font-size:8px; pointer-events:none;">选用</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-ring-picker').onclick = () => overlay.remove();
  overlay.querySelectorAll('.ring-option-item').forEach(item => {
    item.onclick = () => {
      const rId = item.getAttribute('data-id');
      overlay.remove();
      onSelect(rId);
    };
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
