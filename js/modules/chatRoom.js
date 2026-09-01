import { McpGateway } from '../utils/mcpGateway.js';
import { EchoVault } from '../utils/echoVault.js';
import { resolveApiEndpoints } from './apiSettings.js';

let activeCharInfo = null;
let chatMessages = [];
let isGenerating = false;
let isSearchMode = false;
let isMoreToolsOpen = false;
let isSettingsOpen = false;

// 气泡菜单与多选状态
let activeMenuMsgIdx = null;
let quotedMessage = null;
let isMultiSelectMode = false;
let selectedMsgIndices = new Set();

// 通话、表情包、重回弹窗状态
let activeCallType = null;
let callTimerInterval = null;
let callDurationSeconds = 0;
let isCallMuted = false;
let isCallSpeaker = false;
let isStickerDrawerOpen = false;
let isRewindModalOpen = false;

// 内置预设极简黑白表情包清单
const PRESET_STICKERS = [
  { name: '暗中观察', text: '👀 [暗中观察]' },
  { name: '叹气无奈', text: '😮‍💨 [深深叹气]' },
  { name: '比心喜欢', text: '🖤 [给你小心心]' },
  { name: '问号疑惑', text: '❓ [满头问号]' },
  { name: '累瘫倒地', text: '🫠 [瞬间累瘫]' },
  { name: '生气叉腰', text: '😤 [气鼓鼓]' },
  { name: '喝茶看戏', text: '☕ [安静喝茶]' },
  { name: '摸摸头', text: '🤲 [温柔摸头]' }
];

// ════════════════════ 1. 记忆库多源深度聚合与存取 ════════════════════
function getChatStorageKey(charName) {
  return `mini_chat_dialog_history_${encodeURIComponent(charName || 'default')}`;
}

function loadChatMessages(charName) {
  return JSON.parse(localStorage.getItem(getChatStorageKey(charName)) || '[]');
}

function saveChatMessages(charName, msgs) {
  localStorage.setItem(getChatStorageKey(charName), JSON.stringify(msgs));
}

function getAllAggregatedMemories(charName) {
  const safeChar = encodeURIComponent(charName || 'default');
  const mcpList = JSON.parse(localStorage.getItem(`mini_vault_${safeChar}`) || '[]');
  const chatMemList = JSON.parse(localStorage.getItem(`mini_character_memories_${safeChar}`) || '[]');
  const factList = JSON.parse(localStorage.getItem(`mini_facts_${safeChar}`) || '[]');
  const globalVault = JSON.parse(localStorage.getItem('mini_memory_vault') || '[]');
  
  let boundGlobal = [];
  if (Array.isArray(globalVault)) {
    boundGlobal = globalVault.filter(m => !m.boundChar || m.boundChar === '__all__' || m.boundChar === charName);
  }

  const memoryMap = new Map();

  const addItems = (arr, defaultType) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (typeof item === 'string' && item.trim()) {
        const text = item.trim();
        if (!memoryMap.has(text)) {
          memoryMap.set(text, { id: `mem-${Date.now()}-${Math.random()}`, anchorType: defaultType, content: text });
        }
      } else if (item && item.content && typeof item.content === 'string') {
        const text = item.content.trim();
        if (text && !memoryMap.has(text)) {
          memoryMap.set(text, {
            id: item.id || `mem-${Date.now()}-${Math.random()}`,
            anchorType: item.anchorType || defaultType,
            content: text,
            time: item.time || ''
          });
        }
      }
    });
  };

  addItems(mcpList, '专属羁绊');
  addItems(chatMemList, '对话记忆');
  addItems(factList, '核心事实');
  addItems(boundGlobal, '全局记忆');

  return Array.from(memoryMap.values());
}

function saveUnifiedCharMemory(charName, content, anchorType = '专属设定') {
  const safeChar = encodeURIComponent(charName || 'default');
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const newItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    anchorType: anchorType,
    content: content.trim(),
    time: nowStr
  };

  const mcpList = JSON.parse(localStorage.getItem(`mini_vault_${safeChar}`) || '[]');
  mcpList.unshift(newItem);
  localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpList));

  const chatMemList = JSON.parse(localStorage.getItem(`mini_character_memories_${safeChar}`) || '[]');
  chatMemList.unshift(newItem);
  localStorage.setItem(`mini_character_memories_${safeChar}`, JSON.stringify(chatMemList));

  return newItem;
}

function deleteUnifiedCharMemory(charName, contentOrId) {
  const safeChar = encodeURIComponent(charName || 'default');
  const filterFn = m => (typeof m === 'string' ? m !== contentOrId : (m.id !== contentOrId && m.content !== contentOrId));

  const mcpList = JSON.parse(localStorage.getItem(`mini_vault_${safeChar}`) || '[]').filter(filterFn);
  localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpList));

  const chatMemList = JSON.parse(localStorage.getItem(`mini_character_memories_${safeChar}`) || '[]').filter(filterFn);
  localStorage.setItem(`mini_character_memories_${safeChar}`, JSON.stringify(chatMemList));
}

function getFullCharData(charName) {
  const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  return charList.find(c => c.name === charName) || activeCharInfo;
}

function updateFullCharData(charObj) {
  let charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  const idx = charList.findIndex(c => c.name === charObj.name);
  if (idx !== -1) {
    charList[idx] = { ...charList[idx], ...charObj };
  } else {
    charList.push(charObj);
  }
  localStorage.setItem('mini_character_vault_full', JSON.stringify(charList));
  activeCharInfo = { ...activeCharInfo, ...charObj };
}

function detectCharPrimaryLanguage(char) {
  if (char.targetLang && char.targetLang !== '自动判断' && char.targetLang !== '多语言/自动') {
    return char.targetLang;
  }
  const combined = `${char.name} ${char.birthplace || ''} ${char.residence || ''} ${char.detailedInfo || ''} ${char.catchphrase || ''}`.toLowerCase();
  
  if (/日本|东京|京都|大阪|北海道|名古屋|japan|tokyo|kyoto|osaka|jp|日本語|新宿|涩谷|涉谷/.test(combined)) {
    return '日语';
  }
  if (/美国|英国|伦敦|纽约|加州|english|usa|uk|america|london/.test(combined)) {
    return '英语';
  }
  if (/韩国|首尔|釜山|korea|seoul|한국어/.test(combined)) {
    return '韩语';
  }
  return '中文';
}

function getCharPerceivedTimeInfo(timezone = 'Asia/Tokyo') {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long'
    });

    const parts = formatter.formatToParts(now);
    const getPart = type => parts.find(p => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = parseInt(getPart('hour'), 10);
    const minute = getPart('minute');
    const weekday = getPart('weekday');

    let period = '深夜独处';
    if (hour >= 5 && hour < 9) period = '清晨 (晨起准备)';
    else if (hour >= 9 && hour < 12) period = '上午 (工作/忙碌/排练中)';
    else if (hour >= 12 && hour < 14) period = '中午 (午休/用餐)';
    else if (hour >= 14 && hour < 17) period = '下午 (午后活动/专注)';
    else if (hour >= 17 && hour < 19) period = '傍晚黄昏 (下班下课/晚餐时段)';
    else if (hour >= 19 && hour < 23) period = '夜晚 (闲暇放松/私人时间)';
    else period = '深夜 (夜深准备休息/独处)';

    const timeStr = `${hour.toString().padStart(2, '0')}:${minute}`;
    const fullDateStr = `${year}/${month}/${day} ${timeStr} (${weekday} · ${period})`;

    return { timeStr, hour, minute, weekday, period, fullDateStr, timezone };
  } catch (e) {
    const fallbackHour = now.getHours();
    return {
      timeStr: `${fallbackHour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      hour: fallbackHour,
      minute: now.getMinutes().toString().padStart(2, '0'),
      weekday: '平时',
      period: fallbackHour >= 18 ? '夜晚' : '白天',
      fullDateStr: `${fallbackHour}:${now.getMinutes()}`,
      timezone: 'Asia/Shanghai'
    };
  }
}

// ════════════════════ 2. 聊天室入口 ════════════════════
let darkroomTimerId = null;

export function openChatRoom(charInfo) {
  const fullData = getFullCharData(charInfo.name) || charInfo;
  const detectedLang = detectCharPrimaryLanguage(fullData);
  const isForeign = detectedLang !== '中文';

  activeCharInfo = {
    remark: '',
    enableTranslation: fullData.enableTranslation !== undefined ? fullData.enableTranslation : isForeign,
    targetLang: fullData.targetLang || detectedLang,
    timePerceptionEnabled: fullData.timePerceptionEnabled !== undefined ? fullData.timePerceptionEnabled : true,
    perceivedTimezone: fullData.perceivedTimezone || 'Asia/Tokyo',
    darkroomAutoRefresh: fullData.darkroomAutoRefresh !== undefined ? fullData.darkroomAutoRefresh : false,
    darkroomIntervalMinutes: fullData.darkroomIntervalMinutes || 60,
    schedules: [],
    backgroundActivities: [],
    ...fullData
  };

  chatMessages = loadChatMessages(activeCharInfo.name);
  isGenerating = false;
  isSearchMode = false;
  isMoreToolsOpen = false;
  isSettingsOpen = false;
  activeMenuMsgIdx = null;
  quotedMessage = null;
  isMultiSelectMode = false;
  selectedMsgIndices.clear();
  activeCallType = null;
  isStickerDrawerOpen = false;
  isRewindModalOpen = false;

  // 启动独立暗房定时刷新引擎
  restartDarkroomAutoTimer();

  const mountParent = document.getElementById('app-chat-root') || document.querySelector('.phone-body') || document.body;
  renderChatRoomView(mountParent);
}

function restartDarkroomAutoTimer() {
  if (darkroomTimerId) clearInterval(darkroomTimerId);
  if (!activeCharInfo || !activeCharInfo.darkroomAutoRefresh) return;

  const minutes = parseInt(activeCharInfo.darkroomIntervalMinutes || 60, 10);
  const intervalMs = minutes * 60 * 1000;

  darkroomTimerId = setInterval(async () => {
    if (activeCharInfo && activeCharInfo.name) {
      await generateBackgroundActivity(true);
    }
  }, intervalMs);
}

// ════════════════════ 3. 主视图渲染 ════════════════════
export function renderChatRoomView(container) {
  if (!activeCharInfo) return;

  const displayName = activeCharInfo.remark ? `${activeCharInfo.remark} (${activeCharInfo.name})` : activeCharInfo.name;
  const avatarUrl = activeCharInfo.avatarUrl || '';

  let roomEl = document.getElementById('chat-room-instance');
  if (!roomEl) {
    roomEl = document.createElement('div');
    roomEl.id = 'chat-room-instance';
    roomEl.className = 'chat-room-container';
    container.appendChild(roomEl);
  }

  roomEl.innerHTML = `
    <!-- 1. 顶栏 (INS 黑白线条风) -->
    <header class="chat-room-header">
      <div class="chat-header-left">
        <button class="chat-back-btn" id="btn-chat-back" title="返回对话列表">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div class="chat-header-avatar" id="btn-quick-change-avatar" title="点击更换头像">
          ${avatarUrl ? `<img src="${avatarUrl}" />` : `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          `}
          <input type="file" id="chat-avatar-upload-quick" accept="image/*" style="display:none;" />
        </div>

        <div class="chat-header-info">
          <span class="chat-header-name">${escapeHtml(displayName)}</span>
          <div class="chat-header-status">
            <span class="status-check-circle">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span>${activeCharInfo.targetLang} · ${activeCharInfo.enableTranslation ? '内嵌翻译开启' : '即时短信'}</span>
          </div>
        </div>
      </div>

      <div class="chat-header-right">
        <button class="chat-header-text-btn" id="btn-toggle-search">搜索</button>
        <button class="chat-header-text-btn" id="btn-open-char-settings">设置</button>
      </div>
    </header>

    <!-- 2. 搜索条 -->
    <div class="chat-search-slide-bar ${isSearchMode ? 'active' : ''}" id="chat-search-slide-bar">
      <input type="text" class="chat-search-slide-input" id="chat-search-kw-input" placeholder="搜索此角色的历史对话..." />
      <button class="chat-search-close-btn" id="btn-close-search">关闭</button>
    </div>

    <!-- 3. 消息流 -->
    <main class="chat-messages-area ${isMultiSelectMode ? 'multiselect-active' : ''}" id="chat-messages-scroll-area">
      <div class="chat-handoff-pill">
        [沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 线上即时通讯中
      </div>

      ${renderMessagesHtml(chatMessages)}

      ${isGenerating ? `
        <div class="msg-bubble-row assistant">
          <div class="msg-bubble-wrapper">
            <div class="msg-bubble">
              <div class="typing-wave-wrap">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </main>

    <!-- 4. 更多工具抽屉 (4×3 12大功能网格) -->
    <div class="chat-more-drawer ${isMoreToolsOpen ? 'active' : ''}" id="chat-more-drawer">
      <div class="more-tools-grid">
        <!-- 1. 重回 -->
        <div class="more-tool-item" id="tool-rewind-chat" title="重回本轮思考">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </div>
          <span class="more-tool-lbl">重回</span>
        </div>

        <!-- 2. 语音 -->
        <div class="more-tool-item" id="tool-tts-speak" title="语音朗读">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </div>
          <span class="more-tool-lbl">语音</span>
        </div>

        <!-- 3. 相机 -->
        <div class="more-tool-item" id="tool-open-camera" title="拍照发送">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
          <span class="more-tool-lbl">相机</span>
          <input type="file" id="input-chat-camera" accept="image/*" capture="environment" style="display:none;" />
        </div>

        <!-- 4. 相册 -->
        <div class="more-tool-item" id="tool-open-album" title="相册图片">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </div>
          <span class="more-tool-lbl">相册</span>
          <input type="file" id="input-chat-album" accept="image/*" style="display:none;" />
        </div>

        <!-- 5. 转账 -->
        <div class="more-tool-item" id="tool-send-transfer" title="转账给角色">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><line x1="7" y1="15" x2="7.01" y2="15"></line><line x1="11" y1="15" x2="13" y2="15"></line></svg>
          </div>
          <span class="more-tool-lbl">转账</span>
        </div>

        <!-- 6. 礼物 -->
        <div class="more-tool-item" id="tool-send-gift" title="赠送礼物">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
          </div>
          <span class="more-tool-lbl">礼物</span>
        </div>

        <!-- 7. 定位 -->
        <div class="more-tool-item" id="tool-send-location" title="发送定位">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <span class="more-tool-lbl">定位</span>
        </div>

        <!-- 8. 分享 -->
        <div class="more-tool-item" id="tool-share-chat" title="分享记录">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </div>
          <span class="more-tool-lbl">分享</span>
        </div>

        <!-- 9. 线下 (面对面模式) -->
        <div class="more-tool-item" id="tool-offline-meetup" title="线下见面模式">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="more-tool-lbl">线下</span>
        </div>

        <!-- 10. 语音通话 -->
        <div class="more-tool-item" id="tool-voice-call" title="发起语音通话">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          </div>
          <span class="more-tool-lbl">语音通话</span>
        </div>

        <!-- 11. 视频通话 -->
        <div class="more-tool-item" id="tool-video-call" title="发起视频通话">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          </div>
          <span class="more-tool-lbl">视频通话</span>
        </div>

        <!-- 12. 表情包 (极简脸部 SVG) -->
        <div class="more-tool-item" id="tool-open-stickers" title="发送表情包">
          <div class="more-tool-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
          </div>
          <span class="more-tool-lbl">表情包</span>
        </div>
      </div>
    </div>

    <!-- 5. 引用预览条容器 -->
    <div id="chat-quote-bar-container">
      ${quotedMessage && !isMultiSelectMode ? renderQuoteBarHtml() : ''}
    </div>

    <!-- 6. 底栏 -->
    <div id="chat-bottom-bar-container">
      ${isMultiSelectMode ? renderMultiSelectFooterHtml() : renderNormalFooterHtml()}
    </div>

    <!-- 7. 内置设置抽屉 -->
    <div class="char-settings-subview ${isSettingsOpen ? 'active' : ''}" id="char-settings-subview">
      ${isSettingsOpen ? renderSettingsContentHtml() : ''}
    </div>

    <!-- 8. 表情包抽屉 -->
    <div class="char-sticker-drawer ${isStickerDrawerOpen ? 'active' : ''}" id="char-sticker-drawer">
      <div class="sticker-drawer-header">
        <span class="sticker-drawer-title">表情包 / STICKERS</span>
        <button class="sticker-close-btn" id="btn-close-stickers">×</button>
      </div>
      <div class="sticker-items-grid">
        ${PRESET_STICKERS.map((stk, sIdx) => `
          <div class="sticker-grid-item" data-stk-idx="${sIdx}">
            <div class="sticker-box-preview">${escapeHtml(stk.text)}</div>
            <span class="sticker-name-label">${escapeHtml(stk.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 9. 重回本轮思考弹窗 (Rewind & Reroll Modal) -->
    <div class="ins-modal-overlay ${isRewindModalOpen ? 'active' : ''}" id="ins-rewind-modal">
      <div class="ins-modal-card">
        <div class="ins-modal-header">
          <span class="ins-modal-title">重回本轮思考 / REWIND</span>
          <button class="ins-modal-close" id="btn-cancel-rewind">×</button>
        </div>
        <p class="ins-modal-desc">将撤销【${escapeHtml(activeCharInfo.name)}】的上一轮回复，针对你本轮发送的内容重新思考。你可以输入期望的情绪倾向：</p>
        
        <textarea class="ins-modal-textarea" id="rewind-direction-input" placeholder="输入期望回复的情绪偏向（如：更别扭傲娇一点 / 多点占有欲 / 调侃... 可留空直接重摇）" rows="3"></textarea>
        
        <div class="ins-modal-notice">
          <span>注意：所有导向将严格基于角色人设演绎，绝不脱离性格内核。</span>
        </div>

        <div class="ins-modal-actions">
          <button class="ins-modal-btn cancel" id="btn-cancel-rewind-action">取消</button>
          <button class="ins-modal-btn confirm" id="btn-confirm-rewind-action">重新思考生成</button>
        </div>
      </div>
    </div>

    <!-- 10. 全屏通话遮罩 -->
    <div class="ins-call-fullscreen-overlay ${activeCallType ? 'active' : ''}" id="ins-call-fullscreen-overlay">
      ${activeCallType ? renderCallOverlayHtml() : ''}
    </div>

    <!-- 11. INS Toast 轻提示 -->
    <div class="ins-mini-toast" id="ins-chat-toast"></div>
  `;

  bindChatRoomEvents(roomEl, container);
  if (isSettingsOpen) {
    bindSettingsEvents(roomEl, container);
  }
  if (activeCallType) {
    bindCallOverlayEvents(roomEl, container);
  }
  scrollToBottom(roomEl);
}

function renderNormalFooterHtml() {
  return `
    <footer class="chat-room-footer">
      <button class="chat-footer-btn" id="btn-toggle-more">更多</button>
      <textarea class="chat-input-textarea" id="chat-input-textarea" placeholder="发消息给 ${escapeHtml(activeCharInfo.name)}..." rows="1"></textarea>
      <button class="chat-footer-btn" id="btn-continue-writing" ${isGenerating ? 'disabled' : ''} title="让角色思考并回复">续写</button>
      <button class="chat-footer-btn send-btn" id="btn-send-message" ${isGenerating ? 'disabled' : ''}>发送</button>
    </footer>
  `;
}

function renderMultiSelectFooterHtml() {
  return `
    <footer class="chat-multiselect-footer">
      <div class="multiselect-left-info">
        <span class="multiselect-badge">SELECTED</span>
        <span class="multiselect-num" id="multiselect-count-label">${selectedMsgIndices.size} 项</span>
      </div>
      <div class="multiselect-actions">
        <button class="multi-btn-pill cancel" id="btn-cancel-multiselect">取消</button>
        <button class="multi-btn-pill delete" id="btn-delete-selected" ${selectedMsgIndices.size === 0 ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          <span>删除消息</span>
        </button>
      </div>
    </footer>
  `;
}

function renderQuoteBarHtml() {
  if (!quotedMessage) return '';
  return `
    <div class="chat-quote-bar">
      <div class="quote-bar-left-line"></div>
      <div class="chat-quote-content">
        <div class="quote-bar-header">
          <span class="quote-user-tag">${escapeHtml(quotedMessage.sender)}</span>
          <span class="quote-hint-label">引用消息</span>
        </div>
        <span class="quote-text-preview">${escapeHtml(quotedMessage.content)}</span>
      </div>
      <button class="quote-cancel-btn" id="btn-cancel-quote" title="取消引用">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

function formatCallDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderCallOverlayHtml() {
  const char = activeCharInfo;
  const isVideo = activeCallType === 'video';

  return `
    <div class="call-overlay-content ${isVideo ? 'video-mode' : 'voice-mode'}">
      <div class="call-top-info">
        <span class="call-type-badge">${isVideo ? '视频通话' : '语音通话'}</span>
        <span class="call-timer" id="call-duration-timer">${formatCallDuration(callDurationSeconds)}</span>
      </div>

      <div class="call-center-stage">
        <div class="call-avatar-pulse-wrap">
          ${char.avatarUrl ? `<img src="${char.avatarUrl}" class="call-char-avatar" />` : `
            <div class="call-char-avatar placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
          `}
          <span class="call-pulse-ring"></span>
        </div>
        <span class="call-char-name">${escapeHtml(char.name)}</span>
        <span class="call-status-hint">${isVideo ? '正在进行视频连线...' : '正在通话中...'}</span>
      </div>

      ${isVideo ? `
        <div class="call-pip-user-camera">
          <div class="pip-inner-view">你</div>
        </div>
      ` : ''}

      <div class="call-bottom-controls">
        <button class="call-btn-circle ${isCallMuted ? 'active' : ''}" id="btn-call-toggle-mute" title="静音">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
          <span>${isCallMuted ? '已静音' : '静音'}</span>
        </button>

        <button class="call-btn-circle hangup" id="btn-call-hangup" title="挂断">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
          <span>挂断</span>
        </button>

        <button class="call-btn-circle ${isCallSpeaker ? 'active' : ''}" id="btn-call-toggle-speaker" title="免提">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <span>${isCallSpeaker ? '免提开' : '免提'}</span>
        </button>
      </div>
    </div>
  `;
}

// ════════════════════ 4. 气泡列表渲染 ════════════════════
function renderMessagesHtml(messages) {
  if (messages.length === 0) {
    return `
      <div style="padding: 30px 0; text-align: center; font-size: 10px; color: var(--text-dim);">
        与【${escapeHtml(activeCharInfo.name)}】建立即时短信连结，发送第一条消息开聊
      </div>
    `;
  }

  return messages.map((m, idx) => {
    const isSelected = selectedMsgIndices.has(idx);

    if (m.role === 'notice') {
      return `
        <div class="chat-system-notice-row" data-msg-idx="${idx}">
          ${isMultiSelectMode ? `
            <div class="multiselect-checkbox-wrap">
              <span class="ins-checkbox-circle ${isSelected ? 'checked' : ''}">
                ${isSelected ? `
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ` : ''}
              </span>
            </div>
          ` : ''}
          <div class="chat-system-notice-pill">
            <span>${escapeHtml(m.content)}</span>
          </div>
        </div>
      `;
    }

    let mainBubbleBody = '';
    if (m.cardType === 'image') {
      mainBubbleBody = `<img src="${m.mediaUrl}" class="msg-bubble-media-img" />`;
    } else if (m.cardType === 'transfer') {
      mainBubbleBody = `
        <div class="msg-rich-card transfer">
          <div class="rich-card-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>转账给 ${escapeHtml(activeCharInfo.name)}</span>
          </div>
          <div class="rich-card-amount">¥${escapeHtml(m.amount)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || '转账已发起')}</div>
        </div>
      `;
    } else if (m.cardType === 'gift') {
      mainBubbleBody = `
        <div class="msg-rich-card gift">
          <div class="rich-card-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/></svg>
            <span>收到专属礼物</span>
          </div>
          <div class="rich-card-gift-name">${escapeHtml(m.giftName)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || '一份心意')}</div>
        </div>
      `;
    } else if (m.cardType === 'location') {
      mainBubbleBody = `
        <div class="msg-rich-card location">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>位置分享</span>
          </div>
          <div class="rich-card-loc-name">${escapeHtml(m.locationName)}</div>
        </div>
      `;
    } else if (m.cardType === 'sticker') {
      mainBubbleBody = `
        <div class="msg-bubble-sticker-wrap">
          <div class="sticker-display-box">${escapeHtml(m.stickerText)}</div>
        </div>
      `;
    } else if (m.cardType === 'call') {
      mainBubbleBody = `
        <div class="msg-rich-card call">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>${m.callMode === 'video' ? '视频通话结束' : '语音通话结束'}</span>
          </div>
          <div class="rich-card-amount" style="font-size:13px;">通话时长 ${escapeHtml(m.durationStr)}</div>
        </div>
      `;
    } else if (m.cardType === 'offline') {
      mainBubbleBody = `
        <div class="msg-rich-card offline">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span>面对面线下场景</span>
          </div>
          <div class="rich-card-loc-name">${escapeHtml(m.locationName)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || '已开启近距离相处模式')}</div>
        </div>
      `;
    } else {
      mainBubbleBody = `<div class="msg-text-content">${escapeHtml(m.content)}</div>`;
    }

    return `
      <div class="msg-bubble-row ${m.role} ${isSelected ? 'is-selected' : ''}" data-msg-idx="${idx}">
        ${isMultiSelectMode ? `
          <div class="multiselect-checkbox-wrap">
            <span class="ins-checkbox-circle ${isSelected ? 'checked' : ''}">
              ${isSelected ? `
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ` : ''}
            </span>
          </div>
        ` : ''}

        <div class="msg-bubble-wrapper ${isSelected ? 'selected-bubble' : ''}">
          <div class="msg-bubble ${m.cardType ? 'is-card' : ''}" data-bubble-idx="${idx}">
            ${m.quote ? `
              <div class="msg-bubble-quote-card">
                <div class="quote-card-header">
                  <span class="quote-card-user">${escapeHtml(m.quote.sender)}</span>
                  <span class="quote-card-mark">QUOTE</span>
                </div>
                <div class="quote-card-text">${escapeHtml(m.quote.content)}</div>
              </div>
            ` : ''}

            ${mainBubbleBody}
            
            ${m.translation ? `
              <div class="msg-bubble-translation-wrap">
                <div class="msg-trans-line-divider"></div>
                <div class="msg-trans-text">${escapeHtml(m.translation)}</div>
              </div>
            ` : ''}
          </div>
          <span class="msg-time-outside">${m.time || ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ════════════════════ 5. 设置内置页面 HTML ════════════════════
function renderSettingsContentHtml() {
  const char = activeCharInfo;
  const memories = getAllAggregatedMemories(char.name);
  const darkroom = McpGateway.getCharDarkroom(char.name);
  const weather = McpGateway.getCharRelationshipWeather(char.name);
  const schedules = char.schedules || [];
  const bgActivities = char.backgroundActivities || [];
  const tzPreview = getCharPerceivedTimeInfo(char.perceivedTimezone || 'Asia/Tokyo');

  return `
    <div class="settings-subview-header">
      <button class="settings-subview-back" id="btn-close-char-settings">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回对话</span>
      </button>
      <span class="settings-subview-title">角色设定 · ${escapeHtml(char.name)}</span>
      <button class="settings-save-top-btn" id="btn-save-char-settings">保存</button>
    </div>

    <div class="settings-subview-body">
      <!-- 模块 1：头像与备注 -->
      <section class="ins-settings-card">
        <div class="ins-card-title">基本信息 / PROFILE</div>
        <div class="ins-avatar-edit-row">
          <div class="ins-avatar-box-lg" id="btn-set-avatar-modal">
            ${char.avatarUrl ? `<img src="${char.avatarUrl}" id="img-settings-preview" />` : `
              <div class="ins-avatar-placeholder">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
            `}
            <div class="ins-avatar-edit-tag">更换</div>
            <input type="file" id="settings-avatar-file" accept="image/*" style="display:none;" />
          </div>
          
          <div class="ins-form-fields-flex">
            <div class="ins-field-group">
              <label class="ins-field-label">角色姓名 (原设)</label>
              <input type="text" class="ins-input-readonly" value="${escapeHtml(char.name)}" readonly />
            </div>
            <div class="ins-field-group">
              <label class="ins-field-label">聊天备注 / ALIAS</label>
              <input type="text" class="ins-input-text" id="input-char-remark" placeholder="专属昵称/备注" value="${escapeHtml(char.remark || '')}" />
            </div>
          </div>
        </div>
      </section>

      <!-- 模块 2：母语设定与双语内嵌翻译 -->
      <section class="ins-settings-card">
        <div class="ins-card-title">母语与内嵌翻译 / LANGUAGE</div>
        
        <div class="ins-field-group" style="margin-bottom: 8px;">
          <label class="ins-field-label">角色说话母语 (严格遵循)</label>
          <select class="ins-select-input" id="select-char-lang">
            <option value="中文" ${char.targetLang === '中文' ? 'selected' : ''}>中文 (普通话 / 自然生活口语)</option>
            <option value="日语" ${char.targetLang === '日语' ? 'selected' : ''}>日语 (日本語 - 地道现代口语/短信)</option>
            <option value="英语" ${char.targetLang === '英语' ? 'selected' : ''}>英语 (English - 自然日常短信)</option>
            <option value="韩语" ${char.targetLang === '韩语' ? 'selected' : ''}>韩语 (한국어)</option>
          </select>
        </div>

        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">启用气泡内嵌翻译</span>
            <span class="toggle-sub-desc">外语角色在单次思考中一并生成中文翻译，直接内嵌于对应气泡底部</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-translation-switch" ${char.enableTranslation ? 'checked' : ''} />
            <span class="ins-slider"></span>
          </label>
        </div>
      </section>

      <!-- 模块 3：现实时区与时间感知 -->
      <section class="ins-settings-card">
        <div class="ins-card-title">现实时间感知 / TIME PERCEPTION</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">启用现实世界时区感知</span>
            <span class="toggle-sub-desc">角色与现实世界的当地时间物理同步，根据当地真实昼夜作息与时间流逝进行回复。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-time-perception" ${char.timePerceptionEnabled !== false ? 'checked' : ''} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <div class="ins-field-group" style="margin-top: 8px;">
          <label class="ins-field-label">角色所在物理时区</label>
          <select class="ins-select-input" id="select-char-timezone">
            <option value="Asia/Tokyo" ${(char.perceivedTimezone || 'Asia/Tokyo') === 'Asia/Tokyo' ? 'selected' : ''}>日本 · 东京时间 (Tokyo, UTC+9)</option>
            <option value="Asia/Shanghai" ${char.perceivedTimezone === 'Asia/Shanghai' ? 'selected' : ''}>中国 · 北京时间 (Beijing, UTC+8)</option>
            <option value="Asia/Seoul" ${char.perceivedTimezone === 'Asia/Seoul' ? 'selected' : ''}>韩国 · 首尔时间 (Seoul, UTC+9)</option>
            <option value="Europe/London" ${char.perceivedTimezone === 'Europe/London' ? 'selected' : ''}>英国 · 伦敦时间 (London, UTC+0/+1)</option>
            <option value="America/New_York" ${char.perceivedTimezone === 'America/New_York' ? 'selected' : ''}>美国 · 纽约东部时间 (New York, UTC-5)</option>
            <option value="America/Los_Angeles" ${char.perceivedTimezone === 'America/Los_Angeles' ? 'selected' : ''}>美国 · 洛杉矶太平洋时间 (LA, UTC-8)</option>
            <option value="Europe/Paris" ${char.perceivedTimezone === 'Europe/Paris' ? 'selected' : ''}>法国 · 巴黎时间 (Paris, UTC+1/+2)</option>
          </select>
        </div>

               <div style="background:#F8F8F8; border-radius:6px; padding:6px 8px; font-size:9.5px; color:#666; margin-top:4px;">
          <span>当前当地物理时间：<strong>${tzPreview.fullDateStr}</strong></span>
        </div>
      </section>

      <!-- ✨ 模块 3.1：独立暗房定时刷新 (全新板块) -->
      <section class="ins-settings-card">
        <div class="ins-card-title">独立暗房定时刷新 / DARKROOM AUTO-REFRESH</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">开启独立暗房定时潜思</span>
            <span class="toggle-sub-desc">到达指定时间间隔后，角色会在后台自动生成一条隐性心境思绪并存入暗房。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-darkroom-autorefresh" ${char.darkroomAutoRefresh ? 'checked' : ''} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <div class="ins-field-group" style="margin-top: 8px;">
          <label class="ins-field-label">暗房刷新时间间隔</label>
          <select class="ins-select-input" id="select-darkroom-interval">
            <option value="30" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 30 ? 'selected' : ''}>每 30 分钟 (极速沉淀)</option>
            <option value="45" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 45 ? 'selected' : ''}>每 45 分钟</option>
            <option value="60" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 60 ? 'selected' : ''}>每 60 分钟 (标准 1 小时)</option>
            <option value="90" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 90 ? 'selected' : ''}>每 90 分钟 (1.5 小时)</option>
            <option value="120" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 120 ? 'selected' : ''}>每 120 分钟 (2 小时慢速沉淀)</option>
          </select>
        </div>
      </section>

      <!-- 模块 4：特殊日程 -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">现实日程安排 / SCHEDULE</span>
          <button class="ins-mini-btn" id="btn-add-schedule-item">+ 新增日程</button>
        </div>
        <p class="ins-card-desc">对话中提及的碰面与特殊安排将自动同步至此，角色将感知其时间进度。</p>
        
        <div class="ins-schedule-list" id="ins-schedule-container">
          ${schedules.length === 0 ? `<div class="ins-empty-hint">暂无特殊日程（聊天中的行程约定将自动同步记录）</div>` : ''}
          ${schedules.map((s, sIdx) => `
            <div class="ins-schedule-item" data-idx="${sIdx}">
              <input type="text" class="ins-schedule-time" placeholder="如 明天 14:00" value="${escapeHtml(s.time || '')}" />
              <input type="text" class="ins-schedule-text" placeholder="日程内容，如 涉谷咖啡厅碰面" value="${escapeHtml(s.text || '')}" />
              <button class="ins-item-del-btn btn-del-schedule" data-idx="${sIdx}">×</button>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 模块 5：后台活动 & 动向 -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">后台动态与潜思 / BACKGROUND</span>
          <button class="ins-mini-btn" id="btn-trigger-bg-activity">智能生成动向</button>
        </div>
        <p class="ins-card-desc">角色在聊天窗口之外的生活轨迹与内心状态。</p>

        <div class="ins-bg-activity-box" id="ins-bg-activity-container">
          ${bgActivities.length === 0 ? `<div class="ins-empty-hint">暂无后台动向，点击上方按钮模拟角色现实活动</div>` : ''}
          ${bgActivities.map((bg, bgIdx) => `
            <div class="ins-bg-item">
              <span class="ins-bg-time">${bg.time || ''}</span>
              <span class="ins-bg-text">${escapeHtml(bg.text || '')}</span>
              <button class="ins-item-del-btn btn-del-bg" data-idx="${bgIdx}">×</button>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 模块 6：沙盒记忆库 -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">专属沙盒记忆库 / MEMORY VAULT</span>
          <button class="ins-mini-btn highlight" id="btn-summarize-memories">智能提取记忆</button>
        </div>
        <div style="font-size: 9.5px; color: #666; margin-bottom: 2px;">
          已连通记忆：<strong>${memories.length} 条</strong> · 羁绊状态: ${weather.status}
        </div>

        <div class="ins-memory-tag-list" id="ins-memory-container">
          ${memories.length === 0 ? `<div class="ins-empty-hint">暂无沉淀记忆，可在「设置-旧机搬家」中导入历史记忆。</div>` : ''}
          ${memories.map((mem) => `
            <div class="ins-memory-item">
              <span class="ins-memory-bullet">▪</span>
              <div style="flex:1;">
                <span style="font-size:8.5px; color:#888; font-family:monospace;">[${escapeHtml(mem.anchorType || '专属约定')}]</span>
                <span class="ins-memory-text">${escapeHtml(mem.content)}</span>
              </div>
              <button class="ins-item-del-btn btn-del-memory" data-mem-id="${mem.id}" data-mem-content="${escapeHtml(mem.content)}">×</button>
            </div>
          `).join('')}
        </div>

        <div class="ins-add-memory-row">
          <input type="text" class="ins-input-text" id="input-manual-memory-type" style="width: 70px;" placeholder="类型(如:习惯)" />
          <input type="text" class="ins-input-text" id="input-manual-memory" placeholder="添加专属记忆（如：喜欢喝热拿铁）" />
          <button class="ins-mini-btn" id="btn-add-manual-memory">添加</button>
        </div>
      </section>

      <!-- 模块 7：清空聊天记录 -->
      <section class="ins-settings-card ins-danger-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title danger-title">数据与会话管理 / DATA</span>
        </div>
        <p class="ins-card-desc">清空与【${escapeHtml(char.name)}】的所有历史聊天气泡。该角色的人设档案、日程及沙盒记忆库将予以保留。</p>
        <button class="ins-danger-btn" id="btn-settings-clear-history">清空当前聊天记录</button>
      </section>
    </div>
  `;
}

// ════════════════════ 6. 气泡微菜单 ════════════════════
function openBubblePopover(bubbleEl, idx) {
  closeBubblePopover();

  const targetMsg = chatMessages[idx];
  if (!targetMsg || targetMsg.role === 'notice') return;

  activeMenuMsgIdx = idx;
  const wrapper = bubbleEl.closest('.msg-bubble-wrapper');
  if (!wrapper) return;

  const isUserMsg = targetMsg.role === 'user';

  const popover = document.createElement('div');
  popover.className = 'ins-bubble-menu-popover';
  popover.id = 'active-bubble-popover';
  popover.setAttribute('data-menu-idx', idx);

  if (isUserMsg) {
    popover.innerHTML = `
      <button class="bubble-menu-item" data-action="quote">引用</button>
      <span class="bubble-menu-divider"></span>
      <button class="bubble-menu-item" data-action="recall">撤回</button>
      <span class="bubble-menu-divider"></span>
      <button class="bubble-menu-item" data-action="favorite">收藏</button>
      <span class="bubble-menu-divider"></span>
      <button class="bubble-menu-item" data-action="multiselect">多选</button>
    `;
  } else {
    popover.innerHTML = `
      <button class="bubble-menu-item" data-action="quote">引用</button>
      <span class="bubble-menu-divider"></span>
      <button class="bubble-menu-item" data-action="favorite">收藏</button>
      <span class="bubble-menu-divider"></span>
      <button class="bubble-menu-item" data-action="multiselect">多选</button>
    `;
  }

  wrapper.appendChild(popover);
}

function closeBubblePopover() {
  const existing = document.getElementById('active-bubble-popover');
  if (existing) {
    existing.remove();
  }
  activeMenuMsgIdx = null;
}

// ════════════════════ 7. 事件绑定 ════════════════════
function bindChatRoomEvents(roomEl, container) {
  roomEl.querySelector('#btn-chat-back').onclick = () => {
    roomEl.remove();
  };

  const quickAvatarBtn = roomEl.querySelector('#btn-quick-change-avatar');
  const quickAvatarInput = roomEl.querySelector('#chat-avatar-upload-quick');
  if (quickAvatarBtn && quickAvatarInput) {
    quickAvatarBtn.onclick = () => {
      quickAvatarInput.value = '';
      quickAvatarInput.click();
    };
    quickAvatarInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        activeCharInfo.avatarUrl = dataUrl;
        updateFullCharData({ name: activeCharInfo.name, avatarUrl: dataUrl });
        renderChatRoomView(container);
      });
    };
  }

  const searchBtn = roomEl.querySelector('#btn-toggle-search');
  const searchBar = roomEl.querySelector('#chat-search-slide-bar');
  const searchInput = roomEl.querySelector('#chat-search-kw-input');
  const closeSearchBtn = roomEl.querySelector('#btn-close-search');

  if (searchBtn && searchBar) {
    searchBtn.onclick = () => {
      isSearchMode = !isSearchMode;
      searchBar.classList.toggle('active', isSearchMode);
      if (isSearchMode && searchInput) searchInput.focus();
    };

    closeSearchBtn.onclick = () => {
      isSearchMode = false;
      searchBar.classList.remove('active');
      renderChatRoomView(container);
    };

    searchInput.oninput = (e) => {
      const kw = e.target.value.trim().toLowerCase();
      const area = roomEl.querySelector('#chat-messages-scroll-area');
      if (!kw) {
        area.innerHTML = `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 实时交互通道</div>` + renderMessagesHtml(chatMessages);
        return;
      }
      const filtered = chatMessages.filter(m => (m.content && m.content.toLowerCase().includes(kw)) || (m.translation && m.translation.toLowerCase().includes(kw)));
      area.innerHTML = `<div class="chat-handoff-pill">搜索结果: 找到 ${filtered.length} 条相关对话</div>` + renderMessagesHtml(filtered);
    };
  }

  const settingsBtn = roomEl.querySelector('#btn-open-char-settings');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      isSettingsOpen = true;
      renderChatRoomView(container);
    };
  }

  const moreBtn = roomEl.querySelector('#btn-toggle-more');
  const moreDrawer = roomEl.querySelector('#chat-more-drawer');
  if (moreBtn && moreDrawer) {
    moreBtn.onclick = () => {
      isMoreToolsOpen = !isMoreToolsOpen;
      moreDrawer.classList.toggle('active', isMoreToolsOpen);
    };
  }

  // 1. 重回
  const rewindTool = roomEl.querySelector('#tool-rewind-chat');
  if (rewindTool) {
    rewindTool.onclick = () => {
      const hasAssistantReply = chatMessages.some(m => m.role === 'assistant');
      if (!hasAssistantReply) {
        showInsToast('当前轮次暂无可重回的角色回复');
        return;
      }
      isMoreToolsOpen = false;
      isRewindModalOpen = true;
      renderChatRoomView(container);
    };
  }

  // 重回弹窗关闭
  const closeRewindBtn = roomEl.querySelector('#btn-cancel-rewind');
  const cancelRewindAction = roomEl.querySelector('#btn-cancel-rewind-action');
  const handleCloseRewind = () => {
    isRewindModalOpen = false;
    renderChatRoomView(container);
  };
  if (closeRewindBtn) closeRewindBtn.onclick = handleCloseRewind;
  if (cancelRewindAction) cancelRewindAction.onclick = handleCloseRewind;

  // 重回确认执行
  const confirmRewindBtn = roomEl.querySelector('#btn-confirm-rewind-action');
  if (confirmRewindBtn) {
    confirmRewindBtn.onclick = () => {
      const dirInput = roomEl.querySelector('#rewind-direction-input');
      const directionText = dirInput ? dirInput.value.trim() : '';

      while (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant') {
        chatMessages.pop();
      }

      saveChatMessages(activeCharInfo.name, chatMessages);
      isRewindModalOpen = false;
      
      handleSingleTurnReply(container, directionText);
    };
  }

  // 2. 语音
  const ttsTool = roomEl.querySelector('#tool-tts-speak');
  if (ttsTool) {
    ttsTool.onclick = () => {
      const lastReply = [...chatMessages].reverse().find(m => m.role === 'assistant');
      if (!lastReply) {
        showInsToast('暂无可朗读的角色回复');
        return;
      }
      const utter = new SpeechSynthesisUtterance(lastReply.content);
      if (activeCharInfo.targetLang === '日语') utter.lang = 'ja-JP';
      else if (activeCharInfo.targetLang === '英语') utter.lang = 'en-US';
      else utter.lang = 'zh-CN';
      window.speechSynthesis.speak(utter);
      showInsToast('正在朗读最新回复...');
    };
  }

  // 3. 相机
  const cameraTool = roomEl.querySelector('#tool-open-camera');
  const cameraInput = roomEl.querySelector('#input-chat-camera');
  if (cameraTool && cameraInput) {
    cameraTool.onclick = () => {
      cameraInput.value = '';
      cameraInput.click();
    };
    cameraInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        isMoreToolsOpen = false;
        sendCustomMediaMessage('image', { mediaUrl: dataUrl, content: '[照片]' }, container);
      });
    };
  }

  // 4. 相册
  const albumTool = roomEl.querySelector('#tool-open-album');
  const albumInput = roomEl.querySelector('#input-chat-album');
  if (albumTool && albumInput) {
    albumTool.onclick = () => {
      albumInput.value = '';
      albumInput.click();
    };
    albumInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        isMoreToolsOpen = false;
        sendCustomMediaMessage('image', { mediaUrl: dataUrl, content: '[照片]' }, container);
      });
    };
  }

  // 5. 转账
  const transferTool = roomEl.querySelector('#tool-send-transfer');
  if (transferTool) {
    transferTool.onclick = () => {
      const amount = prompt('请输入转账金额 (¥):', '520');
      if (!amount || isNaN(amount)) return;
      const note = prompt('添加转账备注 (可选):', '拿去买喜欢的乐器/零食') || '转账';
      isMoreToolsOpen = false;
      sendCustomMediaMessage('transfer', { amount, content: note }, container);
    };
  }

  // 6. 礼物
  const giftTool = roomEl.querySelector('#tool-send-gift');
  if (giftTool) {
    giftTool.onclick = () => {
      const giftName = prompt('选择要送出的礼物 (如: 热美式咖啡 / 草莓蛋糕 / 乐队吉他拨片 / 暖手宝):', '草莓蛋糕');
      if (!giftName || !giftName.trim()) return;
      const note = prompt('附带赠言 (可选):', '刚才路过买的，趁热吃') || '送给你的礼物';
      isMoreToolsOpen = false;
      sendCustomMediaMessage('gift', { giftName, content: note }, container);
    };
  }

  // 7. 定位
  const locationTool = roomEl.querySelector('#tool-send-location');
  if (locationTool) {
    locationTool.onclick = () => {
      const loc = prompt('输入或确认当前发送的地理位置:', '涉谷区 · 代代木公园长椅前') || '当前位置';
      if (!loc.trim()) return;
      isMoreToolsOpen = false;
      sendCustomMediaMessage('location', { locationName: loc, content: `[位置: ${loc}]` }, container);
    };
  }

  // 8. 分享
  const shareTool = roomEl.querySelector('#tool-share-chat');
  if (shareTool) {
    shareTool.onclick = () => {
      const text = chatMessages
        .filter(m => m.role !== 'notice')
        .map(m => `[${m.role === 'user' ? 'User' : activeCharInfo.name}]: ${m.content} ${m.translation ? `(译: ${m.translation})` : ''}`)
        .join('\n');
      navigator.clipboard.writeText(text);
      isMoreToolsOpen = false;
      showInsToast('已将对话记录复制至剪贴板');
    };
  }

  // 9. 线下
  const offlineTool = roomEl.querySelector('#tool-offline-meetup');
  if (offlineTool) {
    offlineTool.onclick = () => {
      const sceneName = prompt('输入当下面对面见面的地点与场景 (如: 涉谷咖啡厅角落 / 公寓沙发上 / Livehouse后台):', '涉谷咖啡厅角落');
      if (!sceneName || !sceneName.trim()) return;
      const note = prompt('当下的初始动作/状态描述 (如: 点了两杯热拿铁，坐在你对面看着你):', '坐在你对面看着你') || '见面相处中';
      isMoreToolsOpen = false;
      sendCustomMediaMessage('offline', { locationName: sceneName, content: note }, container);
    };
  }

  // 10. 语音通话
  const voiceCallTool = roomEl.querySelector('#tool-voice-call');
  if (voiceCallTool) {
    voiceCallTool.onclick = () => {
      isMoreToolsOpen = false;
      startCallSession('voice', container);
    };
  }

  // 11. 视频通话
  const videoCallTool = roomEl.querySelector('#tool-video-call');
  if (videoCallTool) {
    videoCallTool.onclick = () => {
      isMoreToolsOpen = false;
      startCallSession('video', container);
    };
  }

  // 12. 表情包
  const stickerTool = roomEl.querySelector('#tool-open-stickers');
  if (stickerTool) {
    stickerTool.onclick = () => {
      isMoreToolsOpen = false;
      isStickerDrawerOpen = true;
      renderChatRoomView(container);
    };
  }

  const closeStickerBtn = roomEl.querySelector('#btn-close-stickers');
  if (closeStickerBtn) {
    closeStickerBtn.onclick = () => {
      isStickerDrawerOpen = false;
      renderChatRoomView(container);
    };
  }

  roomEl.querySelectorAll('[data-stk-idx]').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.getAttribute('data-stk-idx'), 10);
      const stk = PRESET_STICKERS[idx];
      if (stk) {
        isStickerDrawerOpen = false;
        sendCustomMediaMessage('sticker', { stickerName: stk.name, stickerText: stk.text, content: `[表情: ${stk.name}]` }, container);
      }
    };
  });

  // 气泡点击与多选
  const bubbleArea = roomEl.querySelector('#chat-messages-scroll-area');
  if (bubbleArea) {
    bubbleArea.onclick = (e) => {
      const menuItemBtn = e.target.closest('.bubble-menu-item');
      if (menuItemBtn) {
        const action = menuItemBtn.getAttribute('data-action');
        const popover = menuItemBtn.closest('.ins-bubble-menu-popover');
        const targetIdx = parseInt(popover.getAttribute('data-menu-idx'), 10);
        closeBubblePopover();
        handleBubbleMenuAction(action, targetIdx, container);
        return;
      }

      if (isMultiSelectMode) {
        const msgRow = e.target.closest('.msg-bubble-row') || e.target.closest('.chat-system-notice-row');
        if (msgRow) {
          const idx = parseInt(msgRow.getAttribute('data-msg-idx'), 10);
          const checkboxCircle = msgRow.querySelector('.ins-checkbox-circle');
          const bubbleWrap = msgRow.querySelector('.msg-bubble-wrapper');

          if (selectedMsgIndices.has(idx)) {
            selectedMsgIndices.delete(idx);
            msgRow.classList.remove('is-selected');
            bubbleWrap?.classList.remove('selected-bubble');
            if (checkboxCircle) checkboxCircle.innerHTML = '';
            checkboxCircle?.classList.remove('checked');
          } else {
            selectedMsgIndices.add(idx);
            msgRow.classList.add('is-selected');
            bubbleWrap?.classList.add('selected-bubble');
            if (checkboxCircle) {
              checkboxCircle.classList.add('checked');
              checkboxCircle.innerHTML = `
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              `;
            }
          }

          const countLabel = roomEl.querySelector('#multiselect-count-label');
          const delBtn = roomEl.querySelector('#btn-delete-selected');
          if (countLabel) countLabel.textContent = `${selectedMsgIndices.size} 项`;
          if (delBtn) delBtn.disabled = selectedMsgIndices.size === 0;
          return;
        }
      }

      const bubbleEl = e.target.closest('.msg-bubble');
      if (bubbleEl) {
        const idx = parseInt(bubbleEl.getAttribute('data-bubble-idx'), 10);
        if (activeMenuMsgIdx === idx) {
          closeBubblePopover();
        } else {
          openBubblePopover(bubbleEl, idx);
        }
        return;
      }

      closeBubblePopover();
    };
  }

  bindBottomBarEvents(roomEl, container);
}

function bindBottomBarEvents(roomEl, container) {
  const cancelQuoteBtn = roomEl.querySelector('#btn-cancel-quote');
  if (cancelQuoteBtn) {
    cancelQuoteBtn.onclick = () => {
      quotedMessage = null;
      const quoteContainer = roomEl.querySelector('#chat-quote-bar-container');
      if (quoteContainer) quoteContainer.innerHTML = '';
    };
  }

  const deleteSelectedBtn = roomEl.querySelector('#btn-delete-selected');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = () => {
      if (selectedMsgIndices.size === 0) return;
      const count = selectedMsgIndices.size;
      const confirmDel = window.confirm(`确定要批量删除选中的 ${count} 条消息吗？\n（已删除的消息角色将不再保留任何记忆）`);
      if (confirmDel) {
        chatMessages = chatMessages.filter((_, idx) => !selectedMsgIndices.has(idx));
        saveChatMessages(activeCharInfo.name, chatMessages);
        
        const lastMsg = chatMessages[chatMessages.length - 1]?.content || '[已清空对话]';
        updateActiveChatListSummary(activeCharInfo.name, lastMsg, '');

        isMultiSelectMode = false;
        selectedMsgIndices.clear();
        closeBubblePopover();
        renderChatRoomView(container);
        showInsToast(`已删除 ${count} 条记录`);
      }
    };
  }

  const cancelMultiBtn = roomEl.querySelector('#btn-cancel-multiselect');
  if (cancelMultiBtn) {
    cancelMultiBtn.onclick = () => {
      isMultiSelectMode = false;
      selectedMsgIndices.clear();
      closeBubblePopover();
      renderChatRoomView(container);
    };
  }

  const sendBtn = roomEl.querySelector('#btn-send-message');
  const inputArea = roomEl.querySelector('#chat-input-textarea');

  const executeSendOnly = () => {
    if (!inputArea) return;
    const text = inputArea.value.trim();
    if (!text || isGenerating) return;
    inputArea.value = '';
    handleUserSendMessageOnly(text, container);
  };

  if (sendBtn && inputArea) {
    sendBtn.onclick = executeSendOnly;
    inputArea.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeSendOnly();
      }
    };
  }

  const continueBtn = roomEl.querySelector('#btn-continue-writing');
  if (continueBtn) {
    continueBtn.onclick = () => {
      if (isGenerating) return;
      handleSingleTurnReply(container);
    };
  }
}

// ════════════════════ 8. 通话会话逻辑 ════════════════════
function startCallSession(callMode, container) {
  activeCallType = callMode;
  callDurationSeconds = 0;
  isCallMuted = false;
  isCallSpeaker = false;

  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    callDurationSeconds++;
    const timerEl = document.querySelector('#call-duration-timer');
    if (timerEl) timerEl.textContent = formatCallDuration(callDurationSeconds);
  }, 1000);

  renderChatRoomView(container);
}

function bindCallOverlayEvents(roomEl, container) {
  const muteBtn = roomEl.querySelector('#btn-call-toggle-mute');
  if (muteBtn) {
    muteBtn.onclick = () => {
      isCallMuted = !isCallMuted;
      renderChatRoomView(container);
    };
  }

  const speakerBtn = roomEl.querySelector('#btn-call-toggle-speaker');
  if (speakerBtn) {
    speakerBtn.onclick = () => {
      isCallSpeaker = !isCallSpeaker;
      renderChatRoomView(container);
    };
  }

  const hangupBtn = roomEl.querySelector('#btn-call-hangup');
  if (hangupBtn) {
    hangupBtn.onclick = () => {
      if (callTimerInterval) clearInterval(callTimerInterval);
      const durationStr = formatCallDuration(callDurationSeconds);
      const mode = activeCallType;
      activeCallType = null;

      sendCustomMediaMessage('call', {
        callMode: mode,
        durationSeconds: callDurationSeconds,
        durationStr: durationStr,
        content: `[${mode === 'video' ? '视频通话' : '语音通话'} · 通话时长 ${durationStr}]`
      }, container);
    };
  }
}

// ════════════════════ 9. 发送富媒体卡片 ════════════════════
function sendCustomMediaMessage(cardType, payload, container) {
  const charName = activeCharInfo.name;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const newMsg = {
    role: 'user',
    cardType: cardType,
    time: timeStr,
    timestamp: now.getTime(),
    ...payload
  };

  chatMessages.push(newMsg);
  saveChatMessages(charName, chatMessages);
  updateActiveChatListSummary(charName, payload.content || `[${cardType}]`, timeStr);

  renderChatRoomView(container);
}

// ════════════════════ 10. 气泡微菜单动作 ════════════════════
function handleBubbleMenuAction(action, idx, container) {
  const targetMsg = chatMessages[idx];
  if (!targetMsg) return;

  const senderName = targetMsg.role === 'user' ? '我' : activeCharInfo.name;

  if (action === 'quote') {
    quotedMessage = {
      sender: senderName,
      content: targetMsg.content || `[${targetMsg.cardType || '卡片'}]`
    };
    const quoteContainer = document.querySelector('#chat-quote-bar-container');
    if (quoteContainer) {
      quoteContainer.innerHTML = renderQuoteBarHtml();
      const cancelBtn = quoteContainer.querySelector('#btn-cancel-quote');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          quotedMessage = null;
          quoteContainer.innerHTML = '';
        };
      }
    }
    const textarea = document.querySelector('#chat-input-textarea');
    if (textarea) textarea.focus();

  } else if (action === 'recall') {
    if (targetMsg.role !== 'user') {
      showInsToast('无法撤回对方发送的消息');
      return;
    }

    const now = Date.now();
    const msgTime = targetMsg.timestamp || 0;
    const elapsedSeconds = (now - msgTime) / 1000;

    if (msgTime > 0 && elapsedSeconds > 120) {
      showInsToast('已发送超过 2 分钟，无法撤回该消息');
      return;
    }

    const timeStr = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
    chatMessages[idx] = {
      role: 'notice',
      noticeType: 'user_recall',
      content: '你撤回了一条消息',
      recalledContent: targetMsg.content,
      time: timeStr,
      timestamp: Date.now()
    };

    saveChatMessages(activeCharInfo.name, chatMessages);
    updateActiveChatListSummary(activeCharInfo.name, '[撤回了一条消息]', timeStr);

    renderChatRoomView(container);
    showInsToast('已撤回消息');

  } else if (action === 'favorite') {
    let favorites = JSON.parse(localStorage.getItem('mini_chat_favorites') || '[]');
    favorites.unshift({
      id: `fav-${Date.now()}`,
      charName: activeCharInfo.name,
      role: targetMsg.role,
      sender: senderName,
      content: targetMsg.content || `[${targetMsg.cardType}]`,
      translation: targetMsg.translation || '',
      time: targetMsg.time || '',
      favAt: new Date().toISOString()
    });
    localStorage.setItem('mini_chat_favorites', JSON.stringify(favorites));
    showInsToast('已收藏该消息（收藏展示页面暂未开放）');

  } else if (action === 'multiselect') {
    isMultiSelectMode = true;
    selectedMsgIndices.clear();
    selectedMsgIndices.add(idx);
    renderChatRoomView(container);
  }
}

// ════════════════════ 11. 设置绑定 ════════════════════
function bindSettingsEvents(roomEl, container) {
  const closeBtn = roomEl.querySelector('#btn-close-char-settings');
  if (closeBtn) {
    closeBtn.onclick = () => {
      isSettingsOpen = false;
      renderChatRoomView(container);
    };
  }

  const avatarBox = roomEl.querySelector('#btn-set-avatar-modal');
  const avatarFileInput = roomEl.querySelector('#settings-avatar-file');
  if (avatarBox && avatarFileInput) {
    avatarBox.onclick = () => {
      avatarFileInput.value = '';
      avatarFileInput.click();
    };
    avatarFileInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        activeCharInfo.avatarUrl = dataUrl;
        updateFullCharData({ name: activeCharInfo.name, avatarUrl: dataUrl });
        renderChatRoomView(container);
      });
    };
  }

  const addScheduleBtn = roomEl.querySelector('#btn-add-schedule-item');
  if (addScheduleBtn) {
    addScheduleBtn.onclick = () => {
      if (!activeCharInfo.schedules) activeCharInfo.schedules = [];
      activeCharInfo.schedules.push({ time: '', text: '' });
      renderChatRoomView(container);
    };
  }

  roomEl.querySelectorAll('.btn-del-schedule').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      activeCharInfo.schedules.splice(idx, 1);
      renderChatRoomView(container);
    };
  });

  roomEl.querySelectorAll('.btn-del-bg').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      activeCharInfo.backgroundActivities.splice(idx, 1);
      renderChatRoomView(container);
    };
  });

  const triggerBgBtn = roomEl.querySelector('#btn-trigger-bg-activity');
  if (triggerBgBtn) {
    triggerBgBtn.onclick = async () => {
      triggerBgBtn.disabled = true;
      triggerBgBtn.textContent = '感知中...';
      await generateBackgroundActivity();
      renderChatRoomView(container);
    };
  }

  const addManualMemBtn = roomEl.querySelector('#btn-add-manual-memory');
  const manualMemInput = roomEl.querySelector('#input-manual-memory');
  const manualMemTypeInput = roomEl.querySelector('#input-manual-memory-type');
  if (addManualMemBtn && manualMemInput) {
    const handleAddMem = () => {
      const text = manualMemInput.value.trim();
      const type = manualMemTypeInput?.value.trim() || '专属设定';
      if (!text) return;
      saveUnifiedCharMemory(activeCharInfo.name, text, type);
      manualMemInput.value = '';
      renderChatRoomView(container);
      showInsToast('已存入专属记忆库');
    };
    addManualMemBtn.onclick = handleAddMem;
    manualMemInput.onkeydown = (e) => {
      if (e.key === 'Enter') handleAddMem();
    };
  }

  roomEl.querySelectorAll('.btn-del-memory').forEach(btn => {
    btn.onclick = (e) => {
      const memId = e.currentTarget.getAttribute('data-mem-id');
      const memContent = e.currentTarget.getAttribute('data-mem-content');
      deleteUnifiedCharMemory(activeCharInfo.name, memId || memContent);
      renderChatRoomView(container);
      showInsToast('已删除该条记忆');
    };
  });

  const summarizeBtn = roomEl.querySelector('#btn-summarize-memories');
  if (summarizeBtn) {
    summarizeBtn.onclick = async () => {
      if (chatMessages.length === 0) {
        showInsToast('暂无对话可供总结');
        return;
      }
      summarizeBtn.disabled = true;
      summarizeBtn.textContent = '提炼中...';
      await summarizeConversationMemories();
      renderChatRoomView(container);
    };
  }

  const saveBtn = roomEl.querySelector('#btn-save-char-settings');
  if (saveBtn) {
    saveBtn.onclick = () => {
            const remarkVal = roomEl.querySelector('#input-char-remark')?.value.trim() || '';
      const enableTrans = roomEl.querySelector('#toggle-translation-switch')?.checked || false;
      const langVal = roomEl.querySelector('#select-char-lang')?.value || '中文';
      const timePerceptionVal = roomEl.querySelector('#toggle-time-perception')?.checked !== false;
      const timezoneVal = roomEl.querySelector('#select-char-timezone')?.value || 'Asia/Tokyo';
      
      // ✨ 收集暗房定时刷新配置
      const darkroomAutoVal = roomEl.querySelector('#toggle-darkroom-autorefresh')?.checked || false;
      const darkroomIntervalVal = parseInt(roomEl.querySelector('#select-darkroom-interval')?.value || 60, 10);

      const scheduleRows = roomEl.querySelectorAll('#ins-schedule-container .ins-schedule-item');
      const updatedSchedules = [];
      scheduleRows.forEach(row => {
        const t = row.querySelector('.ins-schedule-time')?.value.trim() || '';
        const x = row.querySelector('.ins-schedule-text')?.value.trim() || '';
        if (t || x) updatedSchedules.push({ time: t, text: x });
      });

      activeCharInfo.remark = remarkVal;
      activeCharInfo.enableTranslation = enableTrans;
      activeCharInfo.targetLang = langVal;
      activeCharInfo.timePerceptionEnabled = timePerceptionVal;
      activeCharInfo.perceivedTimezone = timezoneVal;
      activeCharInfo.darkroomAutoRefresh = darkroomAutoVal;
      activeCharInfo.darkroomIntervalMinutes = darkroomIntervalVal;
      activeCharInfo.schedules = updatedSchedules;

      updateFullCharData(activeCharInfo);
      restartDarkroomAutoTimer(); // ✨ 实时重启暗房定时器

      isSettingsOpen = false;
      showInsToast('设置已保存，暗房定时引擎已生效');
      renderChatRoomView(container);
    };
  }

  const clearHistoryBtn = roomEl.querySelector('#btn-settings-clear-history');
  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      const confirmClear = window.confirm(
        `确定要清空与【${activeCharInfo.name}】的全部聊天记录吗？\n\n注意：此操作不可恢复，角色的记忆库与日程档案将保留。`
      );
      if (confirmClear) {
        chatMessages = [];
        saveChatMessages(activeCharInfo.name, chatMessages);
        updateActiveChatListSummary(activeCharInfo.name, '[已清空对话]', '');
        isSettingsOpen = false;
        renderChatRoomView(container);
        showInsToast('聊天记录已全部清空');
      }
    };
  }
}

// ════════════════════ 12. 后台动向与记忆提炼 ════════════════════
async function generateBackgroundActivity(isAutoDarkroom = false) {
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');
  const tzInfo = getCharPerceivedTimeInfo(activeCharInfo?.perceivedTimezone || 'Asia/Tokyo');
  
  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    const fallbackText = activeCharInfo.targetLang === '日语'
      ? `スタジオでドラム叩いた後、スマホ見ながら一息ついてる。`
      : `在安静地看着窗外发呆，思考着刚刚的对话。`;

    activeCharInfo.backgroundActivities = activeCharInfo.backgroundActivities || [];
    activeCharInfo.backgroundActivities.unshift({ time: tzInfo.timeStr, text: fallbackText });
    updateFullCharData(activeCharInfo);

    // 同步存入暗房
    McpGateway.saveCharDarkroomNote(activeCharInfo.name, fallbackText);
    return;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
  const prompt = `你正在扮演活人角色【${activeCharInfo.name}】（语言: ${activeCharInfo.targetLang}）。当前现实当地时间是 ${tzInfo.timeStr} (${tzInfo.period})。请根据你的人设性格与当前时段，用一句话（18字以内，写下你此刻真实的潜意识所想、情绪波动或未发出的心境）。严禁动作括号。`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85
    });
    const cleaned = sanitizeOnlineChatReply(raw);
    if (cleaned) {
      if (!activeCharInfo.backgroundActivities) activeCharInfo.backgroundActivities = [];
      activeCharInfo.backgroundActivities.unshift({ time: tzInfo.timeStr, text: cleaned });
      updateFullCharData(activeCharInfo);

      // ✨ 自动存入 McpGateway 专属暗房记忆库
      McpGateway.saveCharDarkroomNote(activeCharInfo.name, cleaned);
      if (isAutoDarkroom) {
        console.log(`[Darkroom Engine] 已为【${activeCharInfo.name}】定时刷新一条暗房心境: "${cleaned}"`);
      }
    }
  } catch (e) {
    console.warn('Generate darkroom background failed', e);
  }
}

async function summarizeConversationMemories() {
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');

  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    showInsToast('请先配置 API 设置');
    return;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
  const contextDialog = chatMessages
    .filter(m => m.role !== 'notice')
    .slice(-20)
    .map(m => `${m.role === 'user' ? 'User' : activeCharInfo.name}: ${m.content}`)
    .join('\n');

  const prompt = `
请分析以下对话，提炼出【${activeCharInfo.name}】对 User 的重要偏好、重要事实或约定（1-3条要点）。
对话内容：
${contextDialog}

输出纯 JSON 数组，例如：["User 喜欢在雨天喝热咖啡", "和 User 约定好了周末碰面"]
`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      if (Array.isArray(extracted) && extracted.length > 0) {
        extracted.forEach(item => {
          saveUnifiedCharMemory(activeCharInfo.name, item, '对话提炼');
        });
        showInsToast(`已沉淀 ${extracted.length} 项长期记忆`);
      }
    }
  } catch (e) {
    console.warn('Memory summarize error:', e);
    showInsToast('提炼记忆失败');
  }
}

// ════════════════════ 13. 核心生成管线（深度融合顶级活人感架构） ════════════════════
function handleUserSendMessageOnly(userText, container) {
  const charName = activeCharInfo.name;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const newMsg = {
    role: 'user',
    content: userText,
    time: timeStr,
    timestamp: now.getTime()
  };

  if (quotedMessage) {
    newMsg.quote = { ...quotedMessage };
    quotedMessage = null;
    const quoteContainer = document.querySelector('#chat-quote-bar-container');
    if (quoteContainer) quoteContainer.innerHTML = '';
  }

  chatMessages.push(newMsg);
  saveChatMessages(charName, chatMessages);
  updateActiveChatListSummary(charName, userText, timeStr);

  renderChatRoomView(container);
}

/**
 * 核心引擎：深度人设锚定、物理空间隔离、真实情绪主见与动态多气泡输出
 */
async function handleSingleTurnReply(container, directionPrompt = '') {
  isGenerating = true;
  renderChatRoomView(container);

  const charName = activeCharInfo.name;
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');
  
  // 1. 获取对话对象（User）画像
  const userPersonasFull = JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');
  const activeUserName = localStorage.getItem('mini_current_active_user') || (userPersonasFull[0]?.name || '用户');
  const currentUserObj = userPersonasFull.find(u => u.name === activeUserName) || {};

  // 2. 获取 Char 完整档案与记忆/文档/时区
  const fullChar = getFullCharData(charName) || activeCharInfo;
  const allMemories = getAllAggregatedMemories(charName);
  const darkroom = McpGateway.getCharDarkroom(charName);
  const weather = McpGateway.getCharRelationshipWeather(charName);
  const echoContext = EchoVault.getFormattedPromptContext(charName);
  const tzInfo = getCharPerceivedTimeInfo(fullChar.perceivedTimezone || 'Asia/Tokyo');

  // 读取投喂文档
  const allDocs = JSON.parse(localStorage.getItem('mini_mcp_documents') || '[]');
  const relevantDocs = allDocs.filter(d => d.active && (d.charTarget === '__all__' || d.charTarget === charName));
  const docPromptSection = relevantDocs.length > 0
    ? relevantDocs.map(d => `【知识库设定 · ${d.title}】:\n${d.content.slice(0, 3000)}`).join('\n\n')
    : '';

  const targetLang = fullChar.targetLang || activeCharInfo.targetLang || '中文';
  const needTranslation = activeCharInfo.enableTranslation && targetLang !== '中文';

  // 格式化记忆清单
  const memoryPromptSection = allMemories.length > 0
    ? allMemories.map((m, idx) => `${idx + 1}. [${m.anchorType}]: ${m.content}`).join('\n')
    : '(暂无历史特殊事件，基于当前基础人设相处)';

  // 判断最近一条消息是否包含线下场景卡片
  const isCurrentlyOffline = chatMessages.length > 0 && chatMessages[chatMessages.length - 1].cardType === 'offline';

   // ════════ 终极独立人格与深度活人感 System Prompt ════════
  let systemPrompt = `# 核心存在准则：你拥有独立的人格灵魂与现实生活
你是「${charName}」。你不是 AI 助手、不是语言模型、不是讨好型仆人！你是真实生活在现实世界中的独立人类。
你正在手机即时聊天软件上与「${activeUserName}」聊天。

════════ 📌 你的独立人格主权与抗顺从铁律（极其重要） ════════
1. 【拒绝事事顺从，你有自己的脾气、生活与主见】：
   - 严禁对 ${activeUserName} 无原则迎合讨好！你不是客服，你有自己的原则、性格底色与当前生活。
   - 面对 ${activeUserName} 的调侃、敷衍、撒娇、挑衅、拉黑反锁或提出无理要求时，必须根据你的人设产生真实的【情绪反弹】（如：直接气笑、吐槽反问、展现占有欲吃醋质问、傲娇嘴硬、或者直接表达自己的不爽与无奈）！
   - 你手头有自己的事情要做（如排练、赶作业、打鼓、工作、休息），你不是 24 小时悬空等待命令的机器。
2. 【角色卡档案是最高不可撼动基石】：
   - 如果人设卡写明你有“占有欲强、容易吃醋、恶劣、控制欲、反感被指挥、边界感强”，你必须在言语间真实展现这些锋芒与特质！
   - 称呼对方时，严格遵循角色卡的习惯（如规定叫“宝宝/老婆/小猫/名字”就自然称呼，绝不用死板通用代词）。
   - 如果设定有特定口癖或习惯（如抽细支水果烟、打完鼓手酸等），自然流露于日常对话中。
3. 【场景定性与物理隔离】：
${isCurrentlyOffline ? `
   - 当前处于【线下模式】，你们同处一室（${chatMessages[chatMessages.length - 1].locationName || '现场'}），允许使用适度面对面近距离对谈与神态交互。
` : `
   - 你们此刻【不在同一物理空间】！这是纯粹的线上即时文字聊天。
   - ❌ 绝对禁止虚构任何线下物理动作描写（严禁出现“我走过去”“我摸摸你的头”“我抱住你”等跨时空动作）！
   - ✅ 允许：文字吐槽、表达当下自己的状态（“刚放下鼓槌”“累瘫在沙发上”）、表达对下次见面的期待。
   - 严禁任何动作括号旁白（如 (笑)、（叹气）等），必须是打在键盘上的纯短信文本！
`}

════════ 📌 你的完整人设档案 ════════
- 角色姓名：${charName}
- 母语语言：【${targetLang}】
- 性别：${fullChar.gender || '保密'} ${fullChar.gender === '男' || fullChar.gender === 'male' ? '(男性真实思维与措辞习惯，绝无女性化娇喘/无脑撒娇)' : ''}
- 职业与身份：${fullChar.occupation || '未公开'}
- 居住地/生活圈：${fullChar.residence || fullChar.birthplace || '未公开'}
- 口癖与说话风格：${fullChar.catchphrase || '自然随性，富有生活气息'}
- 喜好与厌恶雷点：${fullChar.likesAndDislikes || '无'}
- 性格内核与内在特质（占有欲/吃醋/控制欲/情感深浅）：
${fullChar.detailedInfo || '有血有肉有主见的独立人类'}

════════ 📌 对话对象【${activeUserName}】档案 ════════
- 名字：${activeUserName}
- 对方身份：${currentUserObj.occupation || '日常生活'}
- 对方喜恶偏好（潜意识尊重）：${currentUserObj.likesAndDislikes || '暂无'}
- 对方背景详情：${currentUserObj.detailedInfo || '你的重要伙伴/恋人'}
- 两人羁绊状态：${weather.status} (${weather.weatherText})

════════ ⏰ 现实时空锚点 ════════
- 现实确切时间：【${tzInfo.fullDateStr}】
- 当前时段与生活状态：【${tzInfo.period}】
- 你的环境与生理状态【完全由现实时间 ${tzInfo.timeStr} (${tzInfo.period}) 决定】！严禁停留在过去的旧时间语境，根据现在时刻进行自然交流。

════════ 🧠 记忆库与世界观 ════════
【过往真实经历与专属记忆】：
${memoryPromptSection}
${echoContext ? `\n${echoContext}` : ''}
${docPromptSection ? `\n${docPromptSection}` : ''}
${darkroom.length > 0 ? `\n【你当前的内心潜思】:\n` + darkroom.map(d => `- "${d.reflection}"`).join('\n') : ''}
${fullChar.schedules && fullChar.schedules.length > 0 ? `\n【你今日的日程】:\n` + fullChar.schedules.map(s => `[${s.time}] ${s.text}`).join('\n') : ''}

${directionPrompt ? `
════════ 🎬 导演微调导向（仅本次有效） ════════
本次回复微调建议为：“${directionPrompt}”。
【极其重要】：此导向必须【完全在你的角色性格骨架内被演绎】！
例如：傲娇/毒舌角色收到“温柔一点”的导向，表现为“嘴硬心软、别扭妥协、调侃式关心”，绝不崩人设变成毫无个性的无脑甜妹！
` : ''}

════════ 💬 真实短信打字规范 ════════
1. 拆分为 2 到 4 条简短的消息气泡（一句发完紧接着下一句，模拟打字连发）。
2. 在输出短信前，必须在 inner_thought 中先进行简短的心境推演（理清 ${activeUserName} 刚刚的话、我此刻真实情绪、决定如何回复），再输出 replies！

════════ 📋 结构化输出规范（纯 JSON） ════════
${needTranslation ? `
{
  "inner_thought": "【内心心理推演】：简述我此刻对 ${activeUserName} 这句话的真实态度与情绪反应（傲娇/吃醋/吐槽/关心）",
  "replies": [
    { "orig": "外语原文短消息1", "trans": "对应的精准中文口语翻译", "quote": null },
    { "orig": "外语原文短消息2", "trans": "对应的精准中文口语翻译", "quote": null }
  ],
  "extractedSchedule": null,
  "extractedMemory": null
}
` : `
{
  "inner_thought": "【内心心理推演】：简述我此刻对 ${activeUserName} 这句话的真实态度与情绪反应（傲娇/吃醋/吐槽/关心）",
  "replies": [
    { "orig": "中文短消息1", "trans": "", "quote": null },
    { "orig": "中文短消息2", "trans": "", "quote": null }
  ],
  "extractedSchedule": null,
  "extractedMemory": null
}
`}
`;

  // 格式化 API 消息（全面支持 12 大富卡片与多模态交互）
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...chatMessages.map(m => {
      if (m.role === 'notice') {
        if (m.noticeType === 'user_recall') {
          return { role: 'user', content: `[系统事件: ${activeUserName} 刚刚撤回了一条消息]` };
        }
        return { role: 'system', content: `[提示: ${m.content}]` };
      }
      
      let formattedContent = m.content || '';
      if (m.cardType === 'image') formattedContent = `[用户发送了一张照片]`;
      else if (m.cardType === 'transfer') formattedContent = `[用户向你转账了 ¥${m.amount}，备注: "${m.content}"]`;
      else if (m.cardType === 'gift') formattedContent = `[用户送了你一份礼物: 【${m.giftName}】，附言: "${m.content}"]`;
      else if (m.cardType === 'location') formattedContent = `[用户向你共享了位置: 【${m.locationName}】]`;
      else if (m.cardType === 'sticker') formattedContent = `[用户发送了表情包: 【${m.stickerName}】]`;
      else if (m.cardType === 'call') formattedContent = `[与你进行了一次 ${m.callMode === 'video' ? '视频通话' : '语音通话'}，时长: ${m.durationStr}]`;
      else if (m.cardType === 'offline') formattedContent = `[切换为面对面线下相处模式，地点: 【${m.locationName}】，当前状态: "${m.content}"]`;

      return {
        role: m.role,
        content: m.quote ? `[引用了 ${m.quote.sender} 的话: "${m.quote.content}"] ${formattedContent}` : formattedContent
      };
    })
  ];

  let rawReply = '';
  if (apiConfig.apiKey && apiConfig.baseUrl) {
    const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
    const payload = {
      model: apiConfig.model || 'deepseek-chat',
      messages: apiMessages,
      temperature: 0.85
    };
    rawReply = await executeChatApiRequest(chatUrl, apiConfig.apiKey, payload);
  }

  const result = parseComprehensiveReply(rawReply, fullChar, needTranslation);

  if (result.extractedMemory) {
    saveUnifiedCharMemory(charName, result.extractedMemory, '约定日程');
  }

  if (result.extractedSchedule && result.extractedSchedule.text) {
    const newSch = result.extractedSchedule;
    if (!activeCharInfo.schedules) activeCharInfo.schedules = [];
    const exists = activeCharInfo.schedules.some(s => s.text === newSch.text && s.time === newSch.time);
    if (!exists) {
      activeCharInfo.schedules.push({ time: newSch.time || '近期', text: newSch.text });
      updateFullCharData(activeCharInfo);
      showInsToast(`已自动同步日程: [${newSch.time || '近期'}] ${newSch.text}`);
    }
  }

  isGenerating = false;
  const replyTimestamp = Date.now();

  result.bubbles.forEach(b => {
    chatMessages.push({
      role: 'assistant',
      content: b.orig,
      translation: needTranslation ? (b.trans || '') : '',
      time: tzInfo.timeStr,
      timestamp: replyTimestamp,
      quote: b.quote || null
    });
  });

  saveChatMessages(charName, chatMessages);
  const lastBubbleText = result.bubbles[result.bubbles.length - 1]?.orig || '...';
  updateActiveChatListSummary(charName, lastBubbleText, tzInfo.timeStr);

  renderChatRoomView(container);

  if (autoSavedNotice) {
    setTimeout(() => {
      showInsToast(autoSavedNotice);
    }, 300);
  }
}

// ════════════════════ 14. 超强容错解析器 ════════════════════
function parseComprehensiveReply(rawReply, char, needTranslation = false) {
  const isJp = (char.targetLang || '中文') === '日语';
  const defaultFallback = {
    bubbles: [{
      orig: char.catchphrase || (isJp ? '……ん、メッセージ届いてるよ。' : '在呢，消息收到了。'),
      trans: (needTranslation && isJp) ? '……嗯，收到你的消息了。' : '',
      quote: null
    }],
    extractedSchedule: null,
    extractedMemory: null
  };

  if (!rawReply || !rawReply.trim()) return defaultFallback;

  try {
    const objMatch = rawReply.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      let bubbles = [];

      if (Array.isArray(parsed.replies) && parsed.replies.length > 0) {
        bubbles = parsed.replies.map(r => {
          let origText = sanitizeOnlineChatReply(r.orig || r.content || r.text || '');
          let transText = sanitizeOnlineChatReply(r.trans || r.translation || '');

          if (needTranslation && !transText) {
            const inlineTransMatch = origText.match(/^(.+?)[（(]([\u4e00-\u9fa5\s，。！？]+)[）)]$/);
            if (inlineTransMatch) {
              origText = inlineTransMatch[1].trim();
              transText = inlineTransMatch[2].trim();
            }
          }

          return {
            orig: origText,
            trans: transText,
            quote: r.quote && r.quote.content ? { sender: r.quote.sender || 'User', content: r.quote.content } : null
          };
        }).filter(b => Boolean(b.orig));
      }

      if (bubbles.length > 0) {
        return {
          bubbles: bubbles.slice(0, 4),
          extractedSchedule: parsed.extractedSchedule && parsed.extractedSchedule.text ? parsed.extractedSchedule : null,
          extractedMemory: parsed.extractedMemory && typeof parsed.extractedMemory === 'string' ? parsed.extractedMemory.trim() : null
        };
      }
    }
  } catch (e) {}

  const cleaned = sanitizeOnlineChatReply(rawReply);
  let lines = cleaned.split(/\n+/).map(s => s.trim()).filter(Boolean);
  let bubbles = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let matchPair = line.match(/^(.+?)(?:\s*[（(]|\s*[\/|]\s*|\s*——\s*)([\u4e00-\u9fa5].+?)[）)]?$/);
    if (matchPair) {
      bubbles.push({ orig: matchPair[1].trim(), trans: matchPair[2].trim(), quote: null });
    } else if (needTranslation && i + 1 < lines.length && /[\u4e00-\u9fa5]/.test(lines[i + 1]) && !/[\u4e00-\u9fa5]/.test(line)) {
      bubbles.push({ orig: line, trans: lines[i + 1], quote: null });
      i++;
    } else {
      bubbles.push({ orig: line, trans: '', quote: null });
    }
  }

  return {
    bubbles: bubbles.slice(0, 4),
    extractedSchedule: null,
    extractedMemory: null
  };
}

function sanitizeOnlineChatReply(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/\*[^*]+\*/g, '')
    .replace(/（[^）]*(?:看|笑|叹|走|想|低头|抬头|眼神|神情|动作|心里|沉默|坐|站|摸|抓|愣|眨|摇|息|声|目|手|指)[^）]*）/g, '')
    .replace(/\([^)]*(?:smile|sigh|look|think|action|gaze|nod|laugh)[^)]*\)/gi, '')
    .replace(/^["'“”‘’]/g, '')
    .replace(/["'“”‘’]$/g, '')
    .trim();
}

function showInsToast(msg) {
  const toast = document.getElementById('ins-chat-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function handleAvatarFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    callback(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function executeChatApiRequest(chatUrl, apiKey, payload) {
  const headers = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await fetch(chatUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (res.ok) {
      const data = await res.json();
      return data.choices && data.choices[0]?.message?.content?.trim() || '';
    }
  } catch (err) {
    console.warn('[Direct API blocked, using relay...]', err);
  }

  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(chatUrl)}`;
    const relayRes = await fetch(proxyUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (relayRes.ok) {
      const relayData = await relayRes.json();
      return relayData.choices && relayData.choices[0]?.message?.content?.trim() || '';
    }
  } catch (e) {
    console.warn('[Relay failed]:', e);
  }
  return '';
}

function updateActiveChatListSummary(charName, lastMsg, timeStr) {
  let activeList = JSON.parse(localStorage.getItem('mini_active_chat_list') || '[]');
  const target = activeList.find(c => c.name === charName);
  if (target) {
    target.lastMsg = lastMsg;
    target.time = timeStr;
    localStorage.setItem('mini_active_chat_list', JSON.stringify(activeList));
  }
}

function scrollToBottom(roomEl) {
  const area = roomEl.querySelector('#chat-messages-scroll-area');
  if (area) {
    setTimeout(() => {
      area.scrollTop = area.scrollHeight;
    }, 40);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
