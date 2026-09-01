import { McpGateway } from "../utils/mcpGateway.js";
import { EchoVault } from "../utils/echoVault.js";
import { resolveApiEndpoints } from "./apiSettings.js";
import { CameraTool } from './cameraTool.js';
import { VoiceTool } from './voiceTool.js';

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

// ✨ 语音条双击防抖与单击计时器变量
let lastVoiceClickTime = 0;
let lastVoiceClickIdx = null;
let voiceClickTimer = null;

// 通话、表情包、重回弹窗状态
let activeCallType = null;
let callTimerInterval = null;
let callDurationSeconds = 0;
let isCallMuted = false;
let isCallSpeaker = false;
let isStickerDrawerOpen = false;
let isRewindModalOpen = false;
let isAvatarVaultOpen = false; // ✨ 全屏专属头像库子页面状态
let activeAvatarVaultTab = "char"; // 'char' | 'user' | 'couple'
let isChatThemeOpen = false; // ✨ 全屏美化独立内置页面状态
let activeChatThemeTab = "frame"; // 'frame' | 'bubble' | 'theme' | 'wallpaper'

// 内置预设极简黑白表情包清单 (纯文本无 Emoji)
const PRESET_STICKERS = [
  { name: "暗中观察", text: "[暗中观察]" },
  { name: "叹气无奈", text: "[深深叹气]" },
  { name: "比心喜欢", text: "[给你小心心]" },
  { name: "问号疑惑", text: "[满头问号]" },
  { name: "累瘫倒地", text: "[瞬间累瘫]" },
  { name: "生气叉腰", text: "[气鼓鼓]" },
  { name: "喝茶看戏", text: "[安静喝茶]" },
  { name: "摸摸头", text: "[温柔摸头]" },
];

// ════════════════════ 1. 记忆库多源深度聚合与存取 ════════════════════
function getChatStorageKey(charName) {
  return `mini_chat_dialog_history_${encodeURIComponent(charName || "default")}`;
}

function loadChatMessages(charName) {
  return JSON.parse(localStorage.getItem(getChatStorageKey(charName)) || "[]");
}

function saveChatMessages(charName, msgs) {
  localStorage.setItem(getChatStorageKey(charName), JSON.stringify(msgs));
}

function getAllAggregatedMemories(charName) {
  const safeChar = encodeURIComponent(charName || "default");
  const mcpList = JSON.parse(
    localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
  );
  const chatMemList = JSON.parse(
    localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
  );
  const factList = JSON.parse(
    localStorage.getItem(`mini_facts_${safeChar}`) || "[]",
  );
  const globalVault = JSON.parse(
    localStorage.getItem("mini_memory_vault") || "[]",
  );

  let boundGlobal = [];
  if (Array.isArray(globalVault)) {
    boundGlobal = globalVault.filter(
      (m) =>
        !m.boundChar || m.boundChar === "__all__" || m.boundChar === charName,
    );
  }

  const memoryMap = new Map();

  const addItems = (arr, defaultType) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        const text = item.trim();
        if (!memoryMap.has(text)) {
          memoryMap.set(text, {
            id: `mem-${Date.now()}-${Math.random()}`,
            anchorType: defaultType,
            content: text,
          });
        }
      } else if (item && item.content && typeof item.content === "string") {
        const text = item.content.trim();
        if (text && !memoryMap.has(text)) {
          memoryMap.set(text, {
            id: item.id || `mem-${Date.now()}-${Math.random()}`,
            anchorType: item.anchorType || defaultType,
            content: text,
            time: item.time || "",
          });
        }
      }
    });
  };

  addItems(mcpList, "专属羁绊");
  addItems(chatMemList, "对话记忆");
  addItems(factList, "核心事实");
  addItems(boundGlobal, "全局记忆");

  return Array.from(memoryMap.values());
}

function saveUnifiedCharMemory(charName, content, anchorType = "专属设定") {
  const safeChar = encodeURIComponent(charName || "default");
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
  const cleanContent = (content || "").trim();
  if (!cleanContent) return null;

  const newItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    charName: charName,
    anchorType: anchorType,
    content: cleanContent,
    time: nowStr,
  };

  // 1. 同步存入 McpGateway 专属沙盒库 (设置中心记忆面板直接读取此库)
  const mcpList = JSON.parse(
    localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
  );
  // 去重校验
  if (!mcpList.some((m) => m.content === cleanContent)) {
    mcpList.unshift(newItem);
    localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpList));
  }

  // 2. 同步存入 聊天室记忆库
  const chatMemList = JSON.parse(
    localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
  );
  if (
    !chatMemList.some((m) =>
      typeof m === "string" ? m === cleanContent : m.content === cleanContent,
    )
  ) {
    chatMemList.unshift(newItem);
    localStorage.setItem(
      `mini_character_memories_${safeChar}`,
      JSON.stringify(chatMemList),
    );
  }

  return newItem;
}

function deleteUnifiedCharMemory(charName, contentOrId) {
  const safeChar = encodeURIComponent(charName || "default");
  const filterFn = (m) =>
    typeof m === "string"
      ? m !== contentOrId
      : m.id !== contentOrId && m.content !== contentOrId;

  const mcpList = JSON.parse(
    localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
  ).filter(filterFn);
  localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpList));

  const chatMemList = JSON.parse(
    localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
  ).filter(filterFn);
  localStorage.setItem(
    `mini_character_memories_${safeChar}`,
    JSON.stringify(chatMemList),
  );
}

function getFullCharData(charName) {
  const charList = JSON.parse(
    localStorage.getItem("mini_character_vault_full") || "[]",
  );
  return charList.find((c) => c.name === charName) || activeCharInfo;
}

function updateFullCharData(charObj) {
  let charList = JSON.parse(
    localStorage.getItem("mini_character_vault_full") || "[]",
  );
  const idx = charList.findIndex((c) => c.name === charObj.name);
  if (idx !== -1) {
    charList[idx] = { ...charList[idx], ...charObj };
  } else {
    charList.push(charObj);
  }
  localStorage.setItem("mini_character_vault_full", JSON.stringify(charList));
  activeCharInfo = { ...activeCharInfo, ...charObj };
}

// ════════════ ✨ 头像库数据存取与全系统档案同步 ════════════
function getCharAvatarLibrary(charName) {
  const safeChar = encodeURIComponent(charName || "default");
  return JSON.parse(
    localStorage.getItem(`mini_char_avatar_library_${safeChar}`) ||
      JSON.stringify({
        charAvatars: [],
        userAvatars: [],
        couplePairs: [],
      }),
  );
}

function saveCharAvatarLibrary(charName, lib) {
  const safeChar = encodeURIComponent(charName || "default");
  localStorage.setItem(
    `mini_char_avatar_library_${safeChar}`,
    JSON.stringify(lib),
  );
}

// 同步更新 Char 全局档案头像（角色库 + 会话列表）
function syncCharAvatarToAllStores(charName, newAvatarUrl) {
  if (!newAvatarUrl) return;
  activeCharInfo.avatarUrl = newAvatarUrl;

  let charList = JSON.parse(
    localStorage.getItem("mini_character_vault_full") || "[]",
  );
  const cIdx = charList.findIndex((c) => c.name === charName);
  if (cIdx !== -1) {
    charList[cIdx].avatarUrl = newAvatarUrl;
    localStorage.setItem("mini_character_vault_full", JSON.stringify(charList));
  }

  let activeList = JSON.parse(
    localStorage.getItem("mini_active_chat_list") || "[]",
  );
  const aTarget = activeList.find((c) => c.name === charName);
  if (aTarget) {
    aTarget.avatarUrl = newAvatarUrl;
    localStorage.setItem("mini_active_chat_list", JSON.stringify(activeList));
  }
}

// 同步更新 User 全局档案头像（身份画像）
function syncUserAvatarToAllStores(userName, newAvatarUrl) {
  if (!newAvatarUrl) return;
  let userList = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const uIdx = userList.findIndex((u) => u.name === userName);
  if (uIdx !== -1) {
    userList[uIdx].avatarUrl = newAvatarUrl;
    localStorage.setItem("mini_user_personas_full", JSON.stringify(userList));
  }
}

function detectCharPrimaryLanguage(char) {
  if (
    char.targetLang &&
    char.targetLang !== "自动判断" &&
    char.targetLang !== "多语言/自动"
  ) {
    return char.targetLang;
  }
  const combined =
    `${char.name} ${char.birthplace || ""} ${char.residence || ""} ${char.detailedInfo || ""} ${char.catchphrase || ""}`.toLowerCase();

  if (
    /日本|东京|京都|大阪|北海道|名古屋|japan|tokyo|kyoto|osaka|jp|日本語|新宿|涩谷|涉谷/.test(
      combined,
    )
  ) {
    return "日语";
  }
  if (/美国|英国|伦敦|纽约|加州|english|usa|uk|america|london/.test(combined)) {
    return "英语";
  }
  if (/韩国|首尔|釜山|korea|seoul|한국어/.test(combined)) {
    return "韩语";
  }
  return "中文";
}

function getCharPerceivedTimeInfo(timezone = "Asia/Tokyo") {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      weekday: "long",
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = parseInt(getPart("hour"), 10);
    const minute = getPart("minute");
    const weekday = getPart("weekday");

    let period = "深夜独处";
    if (hour >= 5 && hour < 9) period = "清晨 (晨起准备)";
    else if (hour >= 9 && hour < 12) period = "上午 (工作/忙碌/排练中)";
    else if (hour >= 12 && hour < 14) period = "中午 (午休/用餐)";
    else if (hour >= 14 && hour < 17) period = "下午 (午后活动/专注)";
    else if (hour >= 17 && hour < 19) period = "傍晚黄昏 (下班下课/晚餐时段)";
    else if (hour >= 19 && hour < 23) period = "夜晚 (闲暇放松/私人时间)";
    else period = "深夜 (夜深准备休息/独处)";

    const timeStr = `${hour.toString().padStart(2, "0")}:${minute}`;
    const fullDateStr = `${year}/${month}/${day} ${timeStr} (${weekday} · ${period})`;

    return { timeStr, hour, minute, weekday, period, fullDateStr, timezone };
  } catch (e) {
    const fallbackHour = now.getHours();
    return {
      timeStr: `${fallbackHour.toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
      hour: fallbackHour,
      minute: now.getMinutes().toString().padStart(2, "0"),
      weekday: "平时",
      period: fallbackHour >= 18 ? "夜晚" : "白天",
      fullDateStr: `${fallbackHour}:${now.getMinutes()}`,
      timezone: "Asia/Shanghai",
    };
  }
}

// ════════════════════ 2. 聊天室入口 ════════════════════
let darkroomTimerId = null;
let bgActivityTimerId = null; // ✨ 后台自主活动定时器

export function openChatRoom(charInfo) {
  const fullData = getFullCharData(charInfo.name) || charInfo;
  const detectedLang = detectCharPrimaryLanguage(fullData);
  const isForeign = detectedLang !== "中文";

  activeCharInfo = {
    remark: "",
    enableTranslation:
      fullData.enableTranslation !== undefined
        ? fullData.enableTranslation
        : isForeign,
    targetLang: fullData.targetLang || detectedLang,
    timePerceptionEnabled:
      fullData.timePerceptionEnabled !== undefined
        ? fullData.timePerceptionEnabled
        : true,
    perceivedTimezone: fullData.perceivedTimezone || "Asia/Tokyo",
    darkroomAutoRefresh:
      fullData.darkroomAutoRefresh !== undefined
        ? fullData.darkroomAutoRefresh
        : false,
    darkroomIntervalMinutes: fullData.darkroomIntervalMinutes || 60,
    autoChangeAvatar:
      fullData.autoChangeAvatar !== undefined
        ? fullData.autoChangeAvatar
        : false,
    autoChangeRemark:
      fullData.autoChangeRemark !== undefined
        ? fullData.autoChangeRemark
        : false,
    autoExtractMemory:
      fullData.autoExtractMemory !== undefined
        ? fullData.autoExtractMemory
        : true,
    autoExtractTurnInterval: fullData.autoExtractTurnInterval || 20,
    currentTurnCounter: fullData.currentTurnCounter || 0,
    bgAutoActivity:
      fullData.bgAutoActivity !== undefined
        ? fullData.bgAutoActivity
        : false,
    bgActivityIntervalMinutes: fullData.bgActivityIntervalMinutes || 45,
    // ✨ 专属语音系统配置初始化
    voiceEnabled: fullData.voiceEnabled !== undefined ? fullData.voiceEnabled : false,
    voiceSource: fullData.voiceSource || "global", // 'global' | 'custom'
    voiceCustomPlatform: fullData.voiceCustomPlatform || "minimax",
    voiceCustomApiKey: fullData.voiceCustomApiKey || "",
    voiceCustomGroupId: fullData.voiceCustomGroupId || "",
    voiceCustomVoiceId: fullData.voiceCustomVoiceId || "female-yujie",
    schedules: [],
    backgroundActivities: [],
    ...fullData,
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
  isAvatarVaultOpen = false;

  restartDarkroomAutoTimer();
  restartBgActivityAutoTimer(); // ✨ 启动后台自主活动引擎

  const mountParent =
    document.getElementById("app-chat-root") ||
    document.querySelector(".phone-body") ||
    document.body;
  renderChatRoomView(mountParent);
}

// ✨ 补齐：独立暗房自动刷新定时器定义
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

// ✨ 后台自主活动与主动发消息定时器定义
function restartBgActivityAutoTimer() {
  if (bgActivityTimerId) clearInterval(bgActivityTimerId);
  if (!activeCharInfo || !activeCharInfo.bgAutoActivity) return;

  const minutes = parseInt(activeCharInfo.bgActivityIntervalMinutes || 45, 10);
  const intervalMs = minutes * 60 * 1000;

  bgActivityTimerId = setInterval(async () => {
    if (activeCharInfo && activeCharInfo.name) {
      await generateBackgroundActivity(false, true);
    }
  }, intervalMs);
}

// ════════════════════ 3. 主视图渲染 ════════════════════
export function renderChatRoomView(container) {
  if (!activeCharInfo) return;

  const displayName = activeCharInfo.remark
    ? `${activeCharInfo.remark} (${activeCharInfo.name})`
    : activeCharInfo.name;
  const avatarUrl = activeCharInfo.avatarUrl || "";

  let roomEl = document.getElementById("chat-room-instance");
  if (!roomEl) {
    roomEl = document.createElement("div");
    roomEl.id = "chat-room-instance";
    roomEl.className = "chat-room-container";
    container.appendChild(roomEl);
  }

   const globalFrameCss = activeCharInfo.chatTheme?.customFrameCss || '';

  roomEl.innerHTML = `
    <!-- ✨ 聊天室全局挂件与形状动态生效样式 -->
    <style id="chat-global-active-frame-css">${globalFrameCss}</style>

    <!-- 1. 顶栏 (INS 黑白线条风) -->
    <header class="chat-room-header">
      <div class="chat-header-left">
        <button class="chat-back-btn" id="btn-chat-back" title="返回对话列表">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div class="chat-header-avatar" id="btn-quick-change-avatar" title="点击更换头像">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" />`
              : `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          `
          }
          <input type="file" id="chat-avatar-upload-quick" accept="image/*" style="display:none;" />
        </div>

        <div class="chat-header-info">
          <span class="chat-header-name">${escapeHtml(displayName)}</span>
          <div class="chat-header-status">
            <span class="status-check-circle">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span>${activeCharInfo.targetLang} · ${activeCharInfo.enableTranslation ? "内嵌翻译开启" : "即时短信"}</span>
          </div>
        </div>
      </div>

      <div class="chat-header-right">
        <button class="chat-header-text-btn" id="btn-toggle-search">搜索</button>
        <button class="chat-header-text-btn" id="btn-open-char-settings">设置</button>
      </div>
    </header>

    <!-- 2. 搜索条 -->
    <div class="chat-search-slide-bar ${isSearchMode ? "active" : ""}" id="chat-search-slide-bar">
      <input type="text" class="chat-search-slide-input" id="chat-search-kw-input" placeholder="搜索此角色的历史对话..." />
      <button class="chat-search-close-btn" id="btn-close-search">关闭</button>
    </div>

    <!-- 3. 消息流 -->
    <main class="chat-messages-area ${isMultiSelectMode ? "multiselect-active" : ""}" id="chat-messages-scroll-area">
      <div class="chat-handoff-pill">
        [沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 线上即时通讯中
      </div>

      ${renderMessagesHtml(chatMessages)}

      ${
        isGenerating
          ? `
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
      `
          : ""
      }
    </main>

    <!-- 4. 更多工具抽屉 (4×3 12大功能网格) -->
    <div class="chat-more-drawer ${isMoreToolsOpen ? "active" : ""}" id="chat-more-drawer">
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
      ${quotedMessage && !isMultiSelectMode ? renderQuoteBarHtml() : ""}
    </div>

    <!-- 6. 底栏 -->
    <div id="chat-bottom-bar-container">
      ${isMultiSelectMode ? renderMultiSelectFooterHtml() : renderNormalFooterHtml()}
    </div>

    <!-- 7. 内置设置抽屉 -->
    <div class="char-settings-subview ${isSettingsOpen ? "active" : ""}" id="char-settings-subview">
      ${isSettingsOpen ? renderSettingsContentHtml() : ""}
    </div>

    <!-- 8. 表情包抽屉 -->
    <div class="char-sticker-drawer ${isStickerDrawerOpen ? "active" : ""}" id="char-sticker-drawer">
      <div class="sticker-drawer-header">
        <span class="sticker-drawer-title">表情包 / STICKERS</span>
        <button class="sticker-close-btn" id="btn-close-stickers">×</button>
      </div>
      <div class="sticker-items-grid">
        ${PRESET_STICKERS.map(
          (stk, sIdx) => `
          <div class="sticker-grid-item" data-stk-idx="${sIdx}">
            <div class="sticker-box-preview">${escapeHtml(stk.text)}</div>
            <span class="sticker-name-label">${escapeHtml(stk.name)}</span>
          </div>
        `,
        ).join("")}
      </div>
    </div>

    <!-- 9. 重回本轮思考弹窗 (Rewind & Reroll Modal) -->
    <div class="ins-modal-overlay ${isRewindModalOpen ? "active" : ""}" id="ins-rewind-modal">
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

         <!-- 10. ✨ 独立内置全屏页面：专属头像库 (INS 白黑风) -->
    <div class="char-avatar-vault-subview ${isAvatarVaultOpen ? "active" : ""}" id="char-avatar-vault-subview">
      ${isAvatarVaultOpen ? renderAvatarVaultSubviewHtml() : ""}
    </div>

    <!-- 10.1 ✨ 独立内置全屏页面：美化定制中心 (4大板块) -->
    <div class="char-theme-custom-subview ${isChatThemeOpen ? "active" : ""}" id="char-theme-custom-subview">
      ${isChatThemeOpen ? renderChatThemeSubviewHtml() : ""}
    </div>

    <!-- 11. 全屏通话遮罩 -->
    <div class="ins-call-fullscreen-overlay ${activeCallType ? "active" : ""}" id="ins-call-fullscreen-overlay">
      ${activeCallType ? renderCallOverlayHtml() : ""}
    </div>

    <!-- 12. INS Toast 轻提示 -->
    <div class="ins-mini-toast" id="ins-chat-toast"></div>
  `;

  bindChatRoomEvents(roomEl, container);
  if (isSettingsOpen) {
    bindSettingsEvents(roomEl, container);
  }
  if (activeCallType) {
    bindCallOverlayEvents(roomEl, container);
  }
  if (isAvatarVaultOpen) {
    bindAvatarVaultEvents(roomEl, container);
  }
  if (isChatThemeOpen) {
    bindChatThemeEvents(roomEl, container);
  }
  scrollToBottom(roomEl);
}

function renderNormalFooterHtml() {
  return `
    <footer class="chat-room-footer">
      <button class="chat-footer-btn" id="btn-toggle-more">更多</button>
      <textarea class="chat-input-textarea" id="chat-input-textarea" placeholder="发消息给 ${escapeHtml(activeCharInfo.name)}..." rows="1"></textarea>
      <button class="chat-footer-btn" id="btn-continue-writing" ${isGenerating ? "disabled" : ""} title="让角色思考并回复">续写</button>
      <button class="chat-footer-btn send-btn" id="btn-send-message" ${isGenerating ? "disabled" : ""}>发送</button>
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
        <button class="multi-btn-pill delete" id="btn-delete-selected" ${selectedMsgIndices.size === 0 ? "disabled" : ""}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          <span>删除消息</span>
        </button>
      </div>
    </footer>
  `;
}

function renderQuoteBarHtml() {
  if (!quotedMessage) return "";
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
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function renderCallOverlayHtml() {
  const char = activeCharInfo;
  const isVideo = activeCallType === "video";

  return `
    <div class="call-overlay-content ${isVideo ? "video-mode" : "voice-mode"}">
      <div class="call-top-info">
        <span class="call-type-badge">${isVideo ? "视频通话" : "语音通话"}</span>
        <span class="call-timer" id="call-duration-timer">${formatCallDuration(callDurationSeconds)}</span>
      </div>

      <div class="call-center-stage">
        <div class="call-avatar-pulse-wrap">
          ${
            char.avatarUrl
              ? `<img src="${char.avatarUrl}" class="call-char-avatar" />`
              : `
            <div class="call-char-avatar placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
          `
          }
          <span class="call-pulse-ring"></span>
        </div>
        <span class="call-char-name">${escapeHtml(char.name)}</span>
        <span class="call-status-hint">${isVideo ? "正在进行视频连线..." : "正在通话中..."}</span>
      </div>

      ${
        isVideo
          ? `
        <div class="call-pip-user-camera">
          <div class="pip-inner-view">你</div>
        </div>
      `
          : ""
      }

      <div class="call-bottom-controls">
        <button class="call-btn-circle ${isCallMuted ? "active" : ""}" id="btn-call-toggle-mute" title="静音">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
          <span>${isCallMuted ? "已静音" : "静音"}</span>
        </button>

        <button class="call-btn-circle hangup" id="btn-call-hangup" title="挂断">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
          <span>挂断</span>
        </button>

        <button class="call-btn-circle ${isCallSpeaker ? "active" : ""}" id="btn-call-toggle-speaker" title="免提">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <span>${isCallSpeaker ? "免提开" : "免提"}</span>
        </button>
      </div>
    </div>
  `;
}

// ════════════ ✨ 全屏独立内置页面：专属头像库 (INS 白黑风) ════════════
function renderAvatarVaultSubviewHtml() {
  const char = activeCharInfo;
  const lib = getCharAvatarLibrary(char.name);

  return `
    <div class="settings-subview-header">
      <button class="settings-subview-back" id="btn-close-avatar-vault">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回设定</span>
      </button>
      <span class="settings-subview-title">头像图库 · ${escapeHtml(char.name)}</span>
      <div style="width: 48px;"></div>
    </div>

    <div class="settings-subview-body">
      <!-- INS 极简三栏切换 -->
      <div class="ins-vault-scope-bar">
        <button class="ins-scope-btn ${activeAvatarVaultTab === "char" ? "active" : ""}" data-vtab="char">Char 形象 (${lib.charAvatars.length})</button>
        <button class="ins-scope-btn ${activeAvatarVaultTab === "user" ? "active" : ""}" data-vtab="user">User 形象 (${lib.userAvatars.length})</button>
        <button class="ins-scope-btn ${activeAvatarVaultTab === "couple" ? "active" : ""}" data-vtab="couple">情侣头像对 (${lib.couplePairs.length})</button>
      </div>

      <div class="ins-vault-content-area">
        ${activeAvatarVaultTab === "char" ? renderCharAvatarsTab(lib, char) : ""}
        ${activeAvatarVaultTab === "user" ? renderUserAvatarsTab(lib) : ""}
        ${activeAvatarVaultTab === "couple" ? renderCouplePairsTab(lib) : ""}
      </div>
    </div>
  `;
}

function renderCharAvatarsTab(lib, char) {
  return `
    <div class="ins-vault-pane">
      <div class="ins-upload-dashed-card" id="btn-upload-char-avatar">
        <div class="ins-upload-icon-circle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="ins-upload-main-text">上传 Char 备选形象</span>
        <span class="ins-upload-sub-text">角色在剧情推进或心境变化时可自主换上</span>
        <input type="file" id="input-upload-char-avatar-file" accept="image/*" style="display:none;" />
      </div>

      <div class="ins-avatar-grid">
        ${lib.charAvatars.length === 0 ? `<div class="ins-empty-hint" style="grid-column: 1 / -1; padding: 30px 0;">暂无备选头像，点击上方上传</div>` : ""}
        ${lib.charAvatars
          .map(
            (item, idx) => `
          <div class="ins-avatar-card ${char.avatarUrl === item.url ? "is-active-avatar" : ""}">
            <div class="ins-card-avatar-wrap">
              <img src="${item.url}" class="ins-card-avatar-img" />
              ${char.avatarUrl === item.url ? `<span class="ins-active-badge">当前使用</span>` : ""}
            </div>
            <span class="ins-card-title-text">${escapeHtml(item.title || "形象 " + (idx + 1))}</span>
            <div class="ins-card-btns-row">
              <button class="ins-card-action-btn use btn-set-char-avatar" data-url="${escapeHtml(item.url)}">换上</button>
              <button class="ins-card-action-btn del btn-del-char-avatar" data-id="${item.id}">删除</button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderUserAvatarsTab(lib) {
  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const activeUserName =
    localStorage.getItem("mini_current_active_user") || "温渡雪";
  const currentUserObj =
    userPersonasFull.find((u) => u.name === activeUserName) || {};

  return `
    <div class="ins-vault-pane">
      <div class="ins-upload-dashed-card" id="btn-upload-user-avatar">
        <div class="ins-upload-icon-circle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="ins-upload-main-text">上传 User 备选形象</span>
        <span class="ins-upload-sub-text">供自己使用，或允许 Char 在特定情境下为你挑选换上</span>
        <input type="file" id="input-upload-user-avatar-file" accept="image/*" style="display:none;" />
      </div>

      <div class="ins-avatar-grid">
        ${lib.userAvatars.length === 0 ? `<div class="ins-empty-hint" style="grid-column: 1 / -1; padding: 30px 0;">暂无 User 形象，点击上方上传</div>` : ""}
        ${lib.userAvatars
          .map(
            (item, idx) => `
          <div class="ins-avatar-card ${currentUserObj.avatarUrl === item.url ? "is-active-avatar" : ""}">
            <div class="ins-card-avatar-wrap">
              <img src="${item.url}" class="ins-card-avatar-img" />
              ${currentUserObj.avatarUrl === item.url ? `<span class="ins-active-badge">当前使用</span>` : ""}
            </div>
            <span class="ins-card-title-text">${escapeHtml(item.title || "形象 " + (idx + 1))}</span>
            <div class="ins-card-btns-row">
              <button class="ins-card-action-btn use btn-set-user-avatar" data-url="${escapeHtml(item.url)}">换上</button>
              <button class="ins-card-action-btn del btn-del-user-avatar" data-id="${item.id}">删除</button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderCouplePairsTab(lib) {
  return `
    <div class="ins-vault-pane">
      <div class="ins-upload-dashed-card" id="btn-upload-couple-pair">
        <div class="ins-upload-icon-circle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="ins-upload-main-text">录入一套情侣头像 (先选图后配置)</span>
        <span class="ins-upload-sub-text">支持自定义命名、指定 Char/User 归属，互动中一键双换</span>
      </div>

      <div class="ins-couple-cards-list">
        ${lib.couplePairs.length === 0 ? `<div class="ins-empty-hint" style="padding: 30px 0;">暂无情头对，点击上方上传录入</div>` : ""}
        ${lib.couplePairs
          .map(
            (pair) => `
          <div class="ins-couple-card">
            <div class="ins-couple-dual-preview">
              <div class="ins-couple-single">
                <img src="${pair.charUrl}" class="ins-couple-thumb" />
                <span class="ins-couple-role-tag">Char</span>
              </div>

              <!-- ✨ 一笔连画动态 SVG 爱心 -->
              <div class="ins-oneline-heart-wrap">
                <svg class="oneline-heart-svg" width="34" height="34" viewBox="0 0 48 48" fill="none">
                  <path class="oneline-heart-path" d="M12 24 C8 20, 4 14, 12 8 C18 3, 24 10, 24 16 C24 10, 30 3, 36 8 C44 14, 40 20, 36 24 C30 30, 24 38, 24 42 C24 38, 18 30, 12 24 Z" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>

              <div class="ins-couple-single">
                <img src="${pair.userUrl}" class="ins-couple-thumb" />
                <span class="ins-couple-role-tag">User</span>
              </div>
            </div>
            <div class="ins-couple-bottom-bar">
              <span class="ins-couple-name">${escapeHtml(pair.title || "情侣头像对")}</span>
              <div class="ins-couple-actions">
                <button class="ins-card-action-btn use btn-apply-couple-pair" data-cid="${pair.id}">换上这套</button>
                <button class="ins-card-action-btn del btn-del-couple-pair" data-cid="${pair.id}">删除</button>
              </div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

// ════════════ ✨ 局部无感刷新头像库（彻底杜绝全屏闪烁） ════════════
function refreshAvatarVaultView(roomEl, container) {
  const subview = roomEl.querySelector("#char-avatar-vault-subview");
  if (subview) {
    subview.innerHTML = renderAvatarVaultSubviewHtml();
    bindAvatarVaultEvents(roomEl, container);
  }
}

function bindAvatarVaultEvents(roomEl, container) {
  const char = activeCharInfo;
  let lib = getCharAvatarLibrary(char.name);

  // 返回按钮：仅关闭子页面，平滑收起
  const closeBtn = roomEl.querySelector("#btn-close-avatar-vault");
  if (closeBtn) {
    closeBtn.onclick = () => {
      isAvatarVaultOpen = false;
      const subview = roomEl.querySelector("#char-avatar-vault-subview");
      if (subview) subview.classList.remove("active");
    };
  }

  // 三栏切换：纯局部刷新，0 闪屏
  roomEl.querySelectorAll("[data-vtab]").forEach((btn) => {
    btn.onclick = () => {
      activeAvatarVaultTab = btn.getAttribute("data-vtab");
      refreshAvatarVaultView(roomEl, container);
    };
  });

  // 1. 上传 Char 头像
  const upCharBtn = roomEl.querySelector("#btn-upload-char-avatar");
  const upCharInput = roomEl.querySelector("#input-upload-char-avatar-file");
  if (upCharBtn && upCharInput) {
    upCharBtn.onclick = () => {
      upCharInput.value = "";
      upCharInput.click();
    };
    upCharInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        const title =
          prompt(
            "为 Char 这张头像命名:",
            `形象 ${lib.charAvatars.length + 1}`,
          ) || "新形象";
        lib.charAvatars.unshift({
          id: `cav-${Date.now()}`,
          title: title.trim(),
          url: dataUrl,
        });
        saveCharAvatarLibrary(char.name, lib);
        refreshAvatarVaultView(roomEl, container);
        showInsToast("已将头像录入 Char 专属库");
      });
    };
  }

  // 设为当前 Char 头像：局部更新顶栏和设置页头像，不重绘全页
  roomEl.querySelectorAll(".btn-set-char-avatar").forEach((btn) => {
    btn.onclick = () => {
      const url = btn.getAttribute("data-url");
      syncCharAvatarToAllStores(char.name, url);

      const topAvatarImg = roomEl.querySelector(".chat-header-avatar img");
      if (topAvatarImg) topAvatarImg.src = url;
      const setAvatarImg = roomEl.querySelector("#img-settings-preview");
      if (setAvatarImg) setAvatarImg.src = url;

      refreshAvatarVaultView(roomEl, container);
      showInsToast("已换上该形象，并同步至角色档案");
    };
  });

  // 删除 Char 头像
  roomEl.querySelectorAll(".btn-del-char-avatar").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      lib.charAvatars = lib.charAvatars.filter((item) => item.id !== id);
      saveCharAvatarLibrary(char.name, lib);
      refreshAvatarVaultView(roomEl, container);
    };
  });

  // 2. 上传 User 头像
  const upUserBtn = roomEl.querySelector("#btn-upload-user-avatar");
  const upUserInput = roomEl.querySelector("#input-upload-user-avatar-file");
  if (upUserBtn && upUserInput) {
    upUserBtn.onclick = () => {
      upUserInput.value = "";
      upUserInput.click();
    };
    upUserInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        const title =
          prompt(
            "为 User 这张头像命名:",
            `形象 ${lib.userAvatars.length + 1}`,
          ) || "新形象";
        lib.userAvatars.unshift({
          id: `uav-${Date.now()}`,
          title: title.trim(),
          url: dataUrl,
        });
        saveCharAvatarLibrary(char.name, lib);
        refreshAvatarVaultView(roomEl, container);
        showInsToast("已将头像录入 User 备选库");
      });
    };
  }

  // 设为当前 User 头像
  roomEl.querySelectorAll(".btn-set-user-avatar").forEach((btn) => {
    btn.onclick = () => {
      const url = btn.getAttribute("data-url");
      const activeUserName =
        localStorage.getItem("mini_current_active_user") || "温渡雪";
      syncUserAvatarToAllStores(activeUserName, url);
      refreshAvatarVaultView(roomEl, container);
      showInsToast("已换上 User 形象并同步至身份画像");
    };
  });

  // 删除 User 头像
  roomEl.querySelectorAll(".btn-del-user-avatar").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      lib.userAvatars = lib.userAvatars.filter((item) => item.id !== id);
      saveCharAvatarLibrary(char.name, lib);
      refreshAvatarVaultView(roomEl, container);
    };
  });

  // 3. ✨ 上传并绑定情侣头像对（先选双图，随后弹出配置分配弹窗）
  const upCoupleBtn = roomEl.querySelector("#btn-upload-couple-pair");
  if (upCoupleBtn) {
    upCoupleBtn.onclick = () => {
      const fileInput1 = document.createElement("input");
      fileInput1.type = "file";
      fileInput1.accept = "image/*";

      fileInput1.onchange = (e1) => {
        const file1 = e1.target.files[0];
        if (!file1) return;
        handleAvatarFile(file1, (img1DataUrl) => {
          const fileInput2 = document.createElement("input");
          fileInput2.type = "file";
          fileInput2.accept = "image/*";

          fileInput2.onchange = (e2) => {
            const file2 = e2.target.files[0];
            if (!file2) return;
            handleAvatarFile(file2, (img2DataUrl) => {
              // 呼出 INS 极简绑定分配弹窗
              openCouplePairConfigModal(
                img1DataUrl,
                img2DataUrl,
                (pairData) => {
                  lib.couplePairs.unshift({
                    id: `cp-${Date.now()}`,
                    title: pairData.title,
                    charUrl: pairData.charUrl,
                    userUrl: pairData.userUrl,
                  });
                  saveCharAvatarLibrary(char.name, lib);
                  refreshAvatarVaultView(roomEl, container);
                  showInsToast(`已成功录入情侣头像：${pairData.title}`);
                },
              );
            });
          };

          // 选择第 2 张图
          setTimeout(() => fileInput2.click(), 100);
        });
      };
      fileInput1.click();
    };
  }

  // ✨ INS 弹窗：自由命名与选择哪张是 Char / 哪张是 User
  function openCouplePairConfigModal(imgA, imgB, onSave) {
    let isASwapped = false; // 默认图 A 为 Char，图 B 为 User

    const modal = document.createElement("div");
    modal.className = "ins-modal-overlay active";
    modal.style.zIndex = "90";

    const updateDualDom = () => {
      const charSrc = isASwapped ? imgB : imgA;
      const userSrc = isASwapped ? imgA : imgB;
      modal.querySelector("#couple-modal-char-img").src = charSrc;
      modal.querySelector("#couple-modal-user-img").src = userSrc;
    };

    modal.innerHTML = `
    <div class="ins-modal-card" style="max-width: 320px; gap: 10px;">
      <div class="ins-modal-header">
        <span class="ins-modal-title">绑定情侣头像 / COUPLE PAIR</span>
        <button class="ins-modal-close" id="btn-close-couple-modal">×</button>
      </div>

      <!-- 双图实时预览与一笔画心 -->
      <div class="ins-couple-modal-preview">
        <div class="ins-couple-single">
          <img id="couple-modal-char-img" src="${imgA}" class="ins-couple-thumb" />
          <span class="ins-couple-role-tag" style="color:#111;">Char 头像</span>
        </div>

        <div class="ins-oneline-heart-wrap">
          <svg class="oneline-heart-svg" width="30" height="30" viewBox="0 0 48 48" fill="none">
            <path class="oneline-heart-path" d="M12 24 C8 20, 4 14, 12 8 C18 3, 24 10, 24 16 C24 10, 30 3, 36 8 C44 14, 40 20, 36 24 C30 30, 24 38, 24 42 C24 38, 18 30, 12 24 Z" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="ins-couple-single">
          <img id="couple-modal-user-img" src="${imgB}" class="ins-couple-thumb" />
          <span class="ins-couple-role-tag" style="color:#111;">User 头像</span>
        </div>
      </div>

      <button class="ins-mini-btn" id="btn-swap-couple-roles" style="margin: 0 auto; padding: 4px 12px; font-size: 10px;">
        ⇄ 左右互换角色归属
      </button>

      <div style="display:flex; flex-direction:column; gap:3px; margin-top:2px;">
        <label style="font-size:9px; font-weight:700; color:#888;">这套情头的名称：</label>
        <input type="text" class="api-input" id="input-couple-modal-title" value="黑白情侣头像" placeholder="输入名称..." style="font-weight:700;" />
      </div>

      <div class="ins-modal-actions" style="margin-top: 6px;">
        <button class="ins-modal-btn cancel" id="btn-cancel-couple-modal">放弃</button>
        <button class="ins-modal-btn confirm" id="btn-save-couple-modal">确认保存入库</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    const close = () => modal.remove();

    modal.querySelector("#btn-close-couple-modal").onclick = close;
    modal.querySelector("#btn-cancel-couple-modal").onclick = close;

    // 点击互换归属
    modal.querySelector("#btn-swap-couple-roles").onclick = () => {
      isASwapped = !isASwapped;
      updateDualDom();
    };

    // 保存
    modal.querySelector("#btn-save-couple-modal").onclick = () => {
      const titleVal =
        modal.querySelector("#input-couple-modal-title").value.trim() ||
        "情侣头像对";
      const finalCharUrl = isASwapped ? imgB : imgA;
      const finalUserUrl = isASwapped ? imgA : imgB;

      onSave({ title: titleVal, charUrl: finalCharUrl, userUrl: finalUserUrl });
      close();
    };
  }

  // 换上情侣头像对
  roomEl.querySelectorAll(".btn-apply-couple-pair").forEach((btn) => {
    btn.onclick = () => {
      const cid = btn.getAttribute("data-cid");
      const pair = lib.couplePairs.find((p) => p.id === cid);
      if (!pair) return;

      const activeUserName =
        localStorage.getItem("mini_current_active_user") || "温渡雪";
      syncCharAvatarToAllStores(char.name, pair.charUrl);
      syncUserAvatarToAllStores(activeUserName, pair.userUrl);

      const topAvatarImg = roomEl.querySelector(".chat-header-avatar img");
      if (topAvatarImg) topAvatarImg.src = pair.charUrl;
      const setAvatarImg = roomEl.querySelector("#img-settings-preview");
      if (setAvatarImg) setAvatarImg.src = pair.charUrl;

      refreshAvatarVaultView(roomEl, container);
      showInsToast(`已同时为你俩换上【${pair.title}】`);
    };
  });

  // 删除情侣头像对
  roomEl.querySelectorAll(".btn-del-couple-pair").forEach((btn) => {
    btn.onclick = () => {
      const cid = btn.getAttribute("data-cid");
      lib.couplePairs = lib.couplePairs.filter((p) => p.id !== cid);
      saveCharAvatarLibrary(char.name, lib);
      refreshAvatarVaultView(roomEl, container);
    };
  });
}

// ════════════ ✨ 全屏独立内置页面：美化定制中心 (4大板块) ════════════
function renderChatThemeSubviewHtml() {
  const char = activeCharInfo;
  const themeCfg = char.chatTheme || {
    avatarFrame: 'default',
    bubbleStyle: 'default',
    themeTone: 'default',
    wallpaper: 'default',
    customWallpaperUrl: ''
  };

  return `
    <div class="settings-subview-header">
      <button class="settings-subview-back" id="btn-close-chat-theme">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回设定</span>
      </button>
      <span class="settings-subview-title">美化定制 · ${escapeHtml(char.name)}</span>
      <div style="width: 48px;"></div>
    </div>

    <div class="settings-subview-body">
      <!-- 4 大板块导航栏 -->
      <div class="ins-vault-scope-bar">
        <button class="ins-scope-btn ${activeChatThemeTab === 'frame' ? 'active' : ''}" data-ttab="frame">头像挂件</button>
        <button class="ins-scope-btn ${activeChatThemeTab === 'bubble' ? 'active' : ''}" data-ttab="bubble">气泡美化</button>
        <button class="ins-scope-btn ${activeChatThemeTab === 'theme' ? 'active' : ''}" data-ttab="theme">主题风格</button>
        <button class="ins-scope-btn ${activeChatThemeTab === 'wallpaper' ? 'active' : ''}" data-ttab="wallpaper">壁纸背景</button>
      </div>

      <div class="ins-theme-content-area">
        ${activeChatThemeTab === 'frame' ? renderAvatarFrameTabHtml(themeCfg, char) : ''}
        ${activeChatThemeTab === 'bubble' ? renderBubbleStyleTabHtml(themeCfg) : ''}
        ${activeChatThemeTab === 'theme' ? renderThemeToneTabHtml(themeCfg) : ''}
        ${activeChatThemeTab === 'wallpaper' ? renderWallpaperTabHtml(themeCfg) : ''}
      </div>
    </div>
  `;
}

// 1. 头像挂件板块（支持 Char/User 通用预览、CSS 代码区、已保存预设列表）
function renderAvatarFrameTabHtml(themeCfg, char) {
  const frames = [
    { id: 'default', name: '极简无挂件', tag: 'CLASSIC' },
    { id: 'ring_dual', name: '同心双环', tag: 'DUAL RING' },
    { id: 'dashed_orbit', name: '虚线轨道', tag: 'DASHED' },
    { id: 'corner_dots', name: '四角点阵', tag: 'CORNER DOTS' },
    { id: 'prism_square', name: '极细方框', tag: 'SQUARE LINE' }
  ];

  const defaultSampleCss = `/* ═══════════════════════════════════════
   Char 与 User 通用头像挂件选择器
   ═══════════════════════════════════════ */

/* 1. 头像外层挂件容器 (支持光环、旋转、呼吸动效) */
.ins-avatar-frame-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 2. 头像本体 (支持圆角/多边形裁剪/滤镜/边框) */
.ins-avatar-frame-wrap img,
.ins-preview-avatar-img,
.msg-round-avatar-img {
  border-radius: 50%;
  object-fit: cover;
  /* clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); */
}

/* 3. 挂件外光环 (利用 ::after 或 ::before 自由绘制) */
.ins-avatar-frame-wrap::after {
  content: "";
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 1.5px dashed #111111;
  border-radius: 50%;
  animation: frameOrbitSpin 12s linear infinite;
  pointer-events: none;
}

/* 4. 关键帧动画 */
@keyframes frameOrbitSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`;

  const currentCss = themeCfg.customFrameCss !== undefined ? themeCfg.customFrameCss : defaultSampleCss;
  const savedPresets = JSON.parse(localStorage.getItem('mini_custom_frame_presets') || '[]');

  return `
    <div class="ins-vault-pane">
      <!-- 动态样式注入标签 (驱动实时预览) -->
      <style id="dynamic-avatar-frame-style">${currentCss}</style>

      <!-- 实时预览区 -->
      <div class="ins-theme-preview-card">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span style="font-size:10px; font-weight:800; color:#111;">头像挂件与形状实时预览 (Char & User 通用)</span>
          <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">LIVE PREVIEW</span>
        </div>
        <div class="ins-frame-preview-box" style="padding: 16px 0;">
          <div class="ins-avatar-frame-wrap frame-${themeCfg.avatarFrame || 'default'}">
            ${char.avatarUrl ? `<img src="${char.avatarUrl}" class="ins-preview-avatar-img" />` : `<div class="ins-preview-avatar-placeholder">${char.name.slice(0, 1)}</div>`}
          </div>
        </div>
      </div>

      <!-- 预设挂件快速选择 -->
      <div style="font-size:9.5px; font-weight:800; color:#111; margin-top:2px;">快速选用通用挂件</div>
      <div class="ins-theme-grid-list">
        ${frames.map(f => `
          <div class="ins-theme-option-card ${(themeCfg.avatarFrame || 'default') === f.id ? 'active' : ''}" data-frame-id="${f.id}">
            <div class="ins-option-header">
              <span class="ins-option-name">${f.name}</span>
              <span class="ins-option-tag">${f.tag}</span>
            </div>
            <button class="ins-card-action-btn use btn-select-frame" data-id="${f.id}">
              ${(themeCfg.avatarFrame || 'default') === f.id ? '使用中' : '选用'}
            </button>
          </div>
        `).join('')}
      </div>

      <!-- CSS 代码放置区 -->
      <div class="ins-settings-card" style="margin-top: 4px; padding: 12px; gap: 8px;">
        <div class="ins-card-title-row">
          <span class="ins-card-title">CSS 代码放置区 / CUSTOM CSS</span>
          <span style="font-size: 8px; color: #888; font-family: ui-monospace, monospace;">REAL-TIME SYNC</span>
        </div>
        <p class="ins-card-desc">修改代码上方实时预览，保存后聊天室中 Char 与 User 的所有气泡头像同步呈现：</p>
        
        <textarea class="ins-css-code-editor" id="input-custom-frame-css" spellcheck="false" rows="11">${escapeHtml(currentCss)}</textarea>

        <div style="display:flex; gap:6px; margin-top:4px;">
          <button class="ins-card-action-btn use" id="btn-open-save-css-dialog" style="flex:2; padding:7px 0; font-size:10px;">保存自定义 CSS 挂件</button>
          <button class="ins-card-action-btn del" id="btn-reset-frame-css" style="flex:1; padding:7px 0; font-size:10px;">重置模板</button>
        </div>
      </div>

      <!-- ✨ 已保存样式预设列表 (CSS 放置区下方) -->
      <div class="ins-settings-card" style="margin-top: 4px; padding: 12px; gap: 8px;">
        <div class="ins-card-title-row">
          <span class="ins-card-title">已保存挂件预设列表 (${savedPresets.length})</span>
          <span style="font-size: 8px; color: #888; font-family: ui-monospace, monospace;">SAVED PRESETS</span>
        </div>
        
        <div class="ins-saved-presets-list" id="ins-saved-presets-container" style="display:flex; flex-direction:column; gap:6px;">
          ${savedPresets.length === 0 ? `<div class="ins-empty-hint" style="padding:15px 0;">暂无保存的挂件预设，编写代码后点击上方保存即可存入</div>` : ''}
          ${savedPresets.map(p => `
            <div class="ins-saved-preset-item" style="background:#FAFAFA; border:1px solid #EAEAEA; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
                <span style="font-size:11px; font-weight:800; color:#111;">${escapeHtml(p.name)}</span>
                <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">${p.createdAt || '预设'}</span>
              </div>
              <div style="display:flex; gap:4px; flex-shrink:0;">
                <button class="ins-card-action-btn use btn-apply-saved-preset" data-pid="${p.id}" style="padding:3px 8px; font-size:9px;">应用</button>
                <button class="ins-card-action-btn btn-load-saved-preset" data-pid="${p.id}" style="padding:3px 8px; font-size:9px; background:#FFF; border:1px solid #CCC; color:#111;">载入代码</button>
                <button class="ins-card-action-btn del btn-del-saved-preset" data-pid="${p.id}" style="padding:3px 6px; font-size:9px;">×</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 2. 气泡美化板块
function renderBubbleStyleTabHtml(themeCfg) {
  const bubbles = [
    { id: 'default', name: '经典圆角线条', desc: '纯正极简白黑圆角' },
    { id: 'capsule', name: '优雅药丸胶囊', desc: '全大圆角流线气泡' },
    { id: 'border_double', name: '双层细线框', desc: '内嵌双线利落边缘' },
    { id: 'square_sharp', name: '硬朗方块质感', desc: '4px 现代工业硬角' }
  ];

  return `
    <div class="ins-vault-pane">
      <div class="ins-theme-grid-list" style="grid-template-columns: 1fr;">
        ${bubbles.map(b => `
          <div class="ins-bubble-preview-card ${(themeCfg.bubbleStyle || 'default') === b.id ? 'active' : ''}" data-bubble-id="${b.id}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:11px; font-weight:800; color:#111;">${b.name}</div>
                <div style="font-size:8.5px; color:#888;">${b.desc}</div>
              </div>
              <button class="ins-card-action-btn use btn-select-bubble" data-id="${b.id}" style="width:70px;">
                ${(themeCfg.bubbleStyle || 'default') === b.id ? '使用中' : '选用'}
              </button>
            </div>
            <!-- 气泡样例预览 -->
            <div class="sample-bubble-row">
              <div class="sample-bubble-box ${b.id}">Hello, 这是一条气泡样例</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 3. 主题风格板块
function renderThemeToneTabHtml(themeCfg) {
  const themes = [
    { id: 'default', name: '纯正极简白 (Classic White)', desc: '标准白底黑线高对比' },
    { id: 'cool_gray', name: '现代冷灰调 (Cool Gray)', desc: '微冷灰质感低眩光' },
    { id: 'dark_contrast', name: '暗夜反差黑 (Dark Contrast)', desc: '深色高反差利落质感' }
  ];

  return `
    <div class="ins-vault-pane">
      <div class="ins-theme-grid-list" style="grid-template-columns: 1fr;">
        ${themes.map(t => `
          <div class="ins-theme-option-card ${(themeCfg.themeTone || 'default') === t.id ? 'active' : ''}" data-tone-id="${t.id}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:11px; font-weight:800; color:#111;">${t.name}</div>
                <div style="font-size:8.5px; color:#888;">${t.desc}</div>
              </div>
              <button class="ins-card-action-btn use btn-select-tone" data-id="${t.id}" style="width:70px;">
                ${(themeCfg.themeTone || 'default') === t.id ? '使用中' : '选用'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 4. 壁纸背景板块
function renderWallpaperTabHtml(themeCfg) {
  return `
    <div class="ins-vault-pane">
      <div class="ins-upload-dashed-card" id="btn-upload-custom-wallpaper">
        <div class="ins-upload-icon-circle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="ins-upload-main-text">上传自定义聊天室壁纸</span>
        <span class="ins-upload-sub-text">支持本地高清图片作为专属背景</span>
        <input type="file" id="input-chat-wallpaper-file" accept="image/*" style="display:none;" />
      </div>

      <div style="font-size:9.5px; font-weight:800; color:#111; margin-top:4px;">预设纹理背景</div>
      <div class="ins-theme-grid-list">
        <div class="ins-wallpaper-card ${(themeCfg.wallpaper || 'default') === 'default' ? 'active' : ''}" data-wp-id="default">
          <div class="wp-thumb-box default"></div>
          <span class="wp-title">默认留白</span>
          <button class="ins-card-action-btn use btn-select-wp" data-id="default">选用</button>
        </div>
        <div class="ins-wallpaper-card ${themeCfg.wallpaper === 'grid_p2' ? 'active' : ''}" data-wp-id="grid_p2">
          <div class="wp-thumb-box grid_p2"></div>
          <span class="wp-title">P2 斜纹细网格</span>
          <button class="ins-card-action-btn use btn-select-wp" data-id="grid_p2">选用</button>
        </div>
        <div class="ins-wallpaper-card ${themeCfg.wallpaper === 'dots' ? 'active' : ''}" data-wp-id="dots">
          <div class="wp-thumb-box dots"></div>
          <span class="wp-title">极简细点阵</span>
          <button class="ins-card-action-btn use btn-select-wp" data-id="dots">选用</button>
        </div>
      </div>
    </div>
  `;
}

// ════════════ ✨ 美化定制事件绑定与局部无感刷新 ════════════
function refreshChatThemeView(roomEl, container) {
  const subview = roomEl.querySelector('#char-theme-custom-subview');
  if (subview) {
    subview.innerHTML = renderChatThemeSubviewHtml();
    bindChatThemeEvents(roomEl, container);
  }
}

function bindChatThemeEvents(roomEl, container) {
  const char = activeCharInfo;
  if (!char.chatTheme) {
    char.chatTheme = { avatarFrame: 'default', bubbleStyle: 'default', themeTone: 'default', wallpaper: 'default', customWallpaperUrl: '' };
  }

  // 关闭返回按钮
  const closeBtn = roomEl.querySelector('#btn-close-chat-theme');
  if (closeBtn) {
    closeBtn.onclick = () => {
      isChatThemeOpen = false;
      const subview = roomEl.querySelector('#char-theme-custom-subview');
      if (subview) subview.classList.remove('active');
    };
  }

  // 四栏切换
  roomEl.querySelectorAll('[data-ttab]').forEach(btn => {
    btn.onclick = () => {
      activeChatThemeTab = btn.getAttribute('data-ttab');
      refreshChatThemeView(roomEl, container);
    };
  });

     // 1. 选用预设通用挂件（实时同步至聊天室）
  roomEl.querySelectorAll('.btn-select-frame').forEach(btn => {
    btn.onclick = () => {
      const fId = btn.getAttribute('data-id');
      char.chatTheme.avatarFrame = fId;
      updateFullCharData(char);
      refreshChatThemeView(roomEl, container);
      
      // 同步刷新聊天室气泡头像类名
      const chatSlotAvatars = roomEl.querySelectorAll('.msg-round-avatar-slot .ins-avatar-frame-wrap');
      chatSlotAvatars.forEach(el => {
        el.className = `ins-avatar-frame-wrap frame-${fId}`;
      });

      showInsToast('已选用该通用挂件，聊天室已同步生效');
    };
  });

  // 2. CSS 代码区实时输入打字预览
  const cssTextarea = roomEl.querySelector('#input-custom-frame-css');
  const styleTag = roomEl.querySelector('#dynamic-avatar-frame-style');
  if (cssTextarea && styleTag) {
    cssTextarea.oninput = () => {
      styleTag.textContent = cssTextarea.value;
    };
  }

  // ✨ 3. 点击保存：弹出双选项弹窗 (① 直接应用 / ② 保存预设并应用)
  const openSaveCssBtn = roomEl.querySelector('#btn-open-save-css-dialog');
  if (openSaveCssBtn && cssTextarea) {
    openSaveCssBtn.onclick = () => {
      const cssCode = cssTextarea.value.trim();
      if (!cssCode) {
        alert('CSS 代码不能为空！');
        return;
      }
      openSaveCssOptionModal(cssCode, (actionType, presetName) => {
        char.chatTheme.customFrameCss = cssCode;
        updateFullCharData(char);

        // 同步更新聊天室全局 CSS
        const chatGlobalStyle = document.querySelector('#chat-global-active-frame-css');
        if (chatGlobalStyle) chatGlobalStyle.textContent = cssCode;

        if (actionType === 'save_preset') {
          let presets = JSON.parse(localStorage.getItem('mini_custom_frame_presets') || '[]');
          presets.unshift({
            id: `fp-${Date.now()}`,
            name: presetName || `挂件预设 ${presets.length + 1}`,
            css: cssCode,
            createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
          });
          localStorage.setItem('mini_custom_frame_presets', JSON.stringify(presets));
          showInsToast(`已保存预设「${presetName}」并成功应用！`);
        } else {
          showInsToast('自定义 CSS 挂件已直接应用至聊天室！');
        }

        refreshChatThemeView(roomEl, container);
      });
    };
  }

  // 4. 重置模板
  const resetCssBtn = roomEl.querySelector('#btn-reset-frame-css');
  if (resetCssBtn) {
    resetCssBtn.onclick = () => {
      char.chatTheme.customFrameCss = undefined;
      updateFullCharData(char);
      refreshChatThemeView(roomEl, container);
      showInsToast('已重置为默认 CSS 挂件模板');
    };
  }

  // 5. 预设列表操作：应用
  roomEl.querySelectorAll('.btn-apply-saved-preset').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.getAttribute('data-pid');
      const presets = JSON.parse(localStorage.getItem('mini_custom_frame_presets') || '[]');
      const target = presets.find(p => p.id === pid);
      if (target) {
        char.chatTheme.customFrameCss = target.css;
        updateFullCharData(char);
        const chatGlobalStyle = document.querySelector('#chat-global-active-frame-css');
        if (chatGlobalStyle) chatGlobalStyle.textContent = target.css;
        refreshChatThemeView(roomEl, container);
        showInsToast(`已应用预设挂件：「${target.name}」`);
      }
    };
  });

  // 6. 预设列表操作：载入代码到编辑框
  roomEl.querySelectorAll('.btn-load-saved-preset').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.getAttribute('data-pid');
      const presets = JSON.parse(localStorage.getItem('mini_custom_frame_presets') || '[]');
      const target = presets.find(p => p.id === pid);
      if (target && cssTextarea) {
        cssTextarea.value = target.css;
        if (styleTag) styleTag.textContent = target.css;
        showInsToast(`已载入「${target.name}」的代码到编辑区`);
      }
    };
  });

  // 7. 预设列表操作：删除
  roomEl.querySelectorAll('.btn-del-saved-preset').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.getAttribute('data-pid');
      let presets = JSON.parse(localStorage.getItem('mini_custom_frame_presets') || '[]');
      presets = presets.filter(p => p.id !== pid);
      localStorage.setItem('mini_custom_frame_presets', JSON.stringify(presets));
      refreshChatThemeView(roomEl, container);
      showInsToast('已删除该挂件预设');
    };
  });

  // ✨ INS 弹窗：保存自定义 CSS 双选项
function openSaveCssOptionModal(cssCode, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'ins-modal-overlay active';
  modal.style.zIndex = '90';

  modal.innerHTML = `
    <div class="ins-modal-card" style="max-width: 320px; gap: 10px;">
      <div class="ins-modal-header">
        <span class="ins-modal-title">应用挂件 / APPLY FRAME CSS</span>
        <button class="ins-modal-close" id="btn-close-save-option">×</button>
      </div>

      <p class="ins-card-desc">请选择如何保存并生效当前编写的 CSS 挂件样式：</p>

      <div style="display:flex; flex-direction:column; gap:8px; margin-top:2px;">
        <button class="ins-modal-btn cancel" id="btn-apply-only-now" style="padding:9px; font-weight:700; border-color:#111; color:#111; text-align:left; line-height:1.3;">
          <div style="font-size:11px;">① 仅直接应用 (不存预设)</div>
          <div style="font-size:8.5px; color:#888;">直接在当前聊天室双方头像生效</div>
        </button>

        <div style="background:#FAFAFA; border:1px solid #EAEAEA; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:11px; font-weight:800; color:#111;">② 保存到预设列表并应用</div>
          <input type="text" class="api-input" id="input-preset-custom-name" value="专属挂件样式" placeholder="给这套挂件起个名字..." style="font-weight:700;" />
          <button class="ins-modal-btn confirm" id="btn-save-preset-and-apply" style="padding:7px; font-size:10px;">保存为预设并应用</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-save-option').onclick = close;

  // 选项 1：直接应用
  modal.querySelector('#btn-apply-only-now').onclick = () => {
    onConfirm('apply_only', '');
    close();
  };

  // 选项 2：保存预设并应用
  modal.querySelector('#btn-save-preset-and-apply').onclick = () => {
    const nameVal = modal.querySelector('#input-preset-custom-name')?.value.trim() || '新挂件样式';
    onConfirm('save_preset', nameVal);
    close();
  };
}

  // 2. 选用气泡样式
  roomEl.querySelectorAll('.btn-select-bubble').forEach(btn => {
    btn.onclick = () => {
      const bId = btn.getAttribute('data-id');
      char.chatTheme.bubbleStyle = bId;
      updateFullCharData(char);
      refreshChatThemeView(roomEl, container);
      showInsToast('已应用气泡样式');
    };
  });

  // 3. 选用主题色调
  roomEl.querySelectorAll('.btn-select-tone').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.getAttribute('data-id');
      char.chatTheme.themeTone = tId;
      updateFullCharData(char);
      refreshChatThemeView(roomEl, container);
      showInsToast('已切换主题风格');
    };
  });

  // 4. 选用预设壁纸
  roomEl.querySelectorAll('.btn-select-wp').forEach(btn => {
    btn.onclick = () => {
      const wpId = btn.getAttribute('data-id');
      char.chatTheme.wallpaper = wpId;
      char.chatTheme.customWallpaperUrl = '';
      updateFullCharData(char);
      refreshChatThemeView(roomEl, container);
      showInsToast('已应用背景壁纸');
    };
  });

  // 上传自定义壁纸
  const upWpBtn = roomEl.querySelector('#btn-upload-custom-wallpaper');
  const upWpInput = roomEl.querySelector('#input-chat-wallpaper-file');
  if (upWpBtn && upWpInput) {
    upWpBtn.onclick = () => { upWpInput.value = ''; upWpInput.click(); };
    upWpInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        char.chatTheme.wallpaper = 'custom';
        char.chatTheme.customWallpaperUrl = dataUrl;
        updateFullCharData(char);
        refreshChatThemeView(roomEl, container);
        showInsToast('已设置自定义壁纸');
      });
    };
  }
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

  // 获取当前活跃用户身份与头像
  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const activeUserName =
    localStorage.getItem("mini_current_active_user") || "温渡雪";
  const currentUserObj =
    userPersonasFull.find((u) => u.name === activeUserName) || {};

  const charAvatar = activeCharInfo.avatarUrl || "";
  const userAvatar = currentUserObj.avatarUrl || "";

  return messages
    .map((m, idx) => {
      const isSelected = selectedMsgIndices.has(idx);

      // 1. 系统提示条
      if (m.role === "notice") {
        return `
        <div class="chat-system-notice-row" data-msg-idx="${idx}">
          ${
            isMultiSelectMode
              ? `
            <div class="multiselect-checkbox-wrap">
              <span class="ins-checkbox-circle ${isSelected ? "checked" : ""}">
                ${
                  isSelected
                    ? `
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                `
                    : ""
                }
              </span>
            </div>
          `
              : ""
          }
          <div class="chat-system-notice-pill">
            <span>${escapeHtml(m.content)}</span>
          </div>
        </div>
      `;
      }

      // ✨ 2. 判断当前消息是否为本轮连发的“首条消息”
      const prevMsg = messages[idx - 1];
      const isFirstInSequence =
        !prevMsg || prevMsg.role !== m.role || prevMsg.role === "notice";

      // 渲染卡片主体
      let mainBubbleBody = "";
      if (m.cardType === "image") {
        mainBubbleBody = `<img src="${m.mediaUrl}" class="msg-bubble-media-img" />`;
      } else if (m.cardType === "transfer") {
        mainBubbleBody = `
        <div class="msg-rich-card transfer">
          <div class="rich-card-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>转账给 ${escapeHtml(activeCharInfo.name)}</span>
          </div>
          <div class="rich-card-amount">¥${escapeHtml(m.amount)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || "转账已发起")}</div>
        </div>
      `;
      } else if (m.cardType === "gift") {
        mainBubbleBody = `
        <div class="msg-rich-card gift">
          <div class="rich-card-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/></svg>
            <span>收到专属礼物</span>
          </div>
          <div class="rich-card-gift-name">${escapeHtml(m.giftName)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || "一份心意")}</div>
        </div>
      `;
      } else if (m.cardType === "location") {
        mainBubbleBody = `
        <div class="msg-rich-card location">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>位置分享</span>
          </div>
          <div class="rich-card-loc-name">${escapeHtml(m.locationName)}</div>
        </div>
      `;
      } else if (m.cardType === "sticker") {
        mainBubbleBody = `
        <div class="msg-bubble-sticker-wrap">
          <div class="sticker-display-box">${escapeHtml(m.stickerText)}</div>
        </div>
      `;
      } else if (m.cardType === "call") {
        mainBubbleBody = `
        <div class="msg-rich-card call">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>${m.callMode === "video" ? "视频通话结束" : "语音通话结束"}</span>
          </div>
          <div class="rich-card-amount" style="font-size:13px;">通话时长 ${escapeHtml(m.durationStr)}</div>
        </div>
      `;
         } else if (m.cardType === "offline") {
        mainBubbleBody = `
        <div class="msg-rich-card offline">
          <div class="rich-card-top">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span>面对面线下场景</span>
          </div>
          <div class="rich-card-loc-name">${escapeHtml(m.locationName)}</div>
          <div class="rich-card-note">${escapeHtml(m.content || "已开启近距离相处模式")}</div>
        </div>
      `;
      } else if (m.cardType === "voice") {
        // ✨ 微信式 INS 语音条气泡
        const isVoiceUser = m.role === "user";
        const dur = m.durationSeconds || Math.max(1, Math.min(60, Math.ceil((m.content || "").length / 3.2)));
        const barWidth = Math.min(180, Math.max(75, 75 + dur * 2.5));

               mainBubbleBody = `
          <div class="msg-voice-card ${isVoiceUser ? "user-voice" : "char-voice"}" data-voice-msg-idx="${idx}">
            ...
          </div>
        `;
          } else if (m.cardType === "sim_photo") {
        // ✨ 还原 P2 风格：斜纹网格画框 + 纸飞机 + 声波 + 箭头元素
        mainBubbleBody = `
          <div class="msg-sim-photo-card" data-sim-photo-idx="${idx}">
            <div class="ins-p2-grid-frame">
              <!-- 右上角：三折箭头元素 -->
              <div class="p2-decor-arrow">
                <svg width="18" height="10" viewBox="0 0 24 12" fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 1l5 5-5 5M9 1l5 5-5 5M16 1l5 5-5 5"/>
                </svg>
              </div>

              <!-- 中间纯白内芯画纸 -->
              <div class="p2-inner-canvas">
                <div class="p2-canvas-text">${escapeHtml(m.photoDesc || m.content)}</div>
              </div>

              <!-- 左下角：手绘纸飞机与速度线条 -->
              <div class="p2-decor-plane">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M26 4L3 16l10 3 3 10L26 4zM13 19l13-15"/>
                  <line x1="2" y1="22" x2="7" y2="20"/>
                  <line x1="1" y1="26" x2="8" y2="23"/>
                </svg>
              </div>

              <!-- 右下角：音频声波线条 -->
              <div class="p2-decor-wave">
                <svg width="38" height="14" viewBox="0 0 42 16" fill="none" stroke="#111111" stroke-width="1.8" stroke-linecap="round">
                  <line x1="2" y1="8" x2="2" y2="8"/>
                  <line x1="6" y1="5" x2="6" y2="11"/>
                  <line x1="10" y1="2" x2="10" y2="14"/>
                  <line x1="14" y1="6" x2="14" y2="10"/>
                  <line x1="18" y1="4" x2="18" y2="12"/>
                  <line x1="22" y1="1" x2="22" y2="15"/>
                  <line x1="26" y1="5" x2="26" y2="11"/>
                  <line x1="30" y1="7" x2="30" y2="9"/>
                  <line x1="34" y1="3" x2="34" y2="13"/>
                  <line x1="38" y1="8" x2="38" y2="8"/>
                </svg>
              </div>
            </div>
            ${
              m.isTextVisible
                ? `
              <div class="sim-photo-detail-box">
                <span class="sim-photo-detail-tag">画面描述</span>
                <span class="sim-photo-detail-content">${escapeHtml(m.photoDesc || m.content)}</span>
              </div>
            `
                : ""
            }
          </div>
        `;
      } else {
        mainBubbleBody = `<div class="msg-text-content">${escapeHtml(m.content)}</div>`;
      }

         // ✨ 构造头像 HTML（Char 与 User 通用挂件包裹器）
      const isUser = m.role === "user";
      const targetAvatarUrl = isUser ? userAvatar : charAvatar;
      const currentTheme = activeCharInfo.chatTheme || {};
      const frameClass = currentTheme.avatarFrame ? `frame-${currentTheme.avatarFrame}` : 'frame-default';

      const avatarElementHtml = `
      <div class="msg-round-avatar-slot ${isFirstInSequence ? "show" : "spacer"}">
        ${
          isFirstInSequence
            ? `
          <div class="ins-avatar-frame-wrap ${frameClass}">
            ${
              targetAvatarUrl
                ? `<img src="${targetAvatarUrl}" class="msg-round-avatar-img" />`
                : `<div class="msg-round-avatar-placeholder">${isUser ? "我" : escapeHtml(activeCharInfo.name.slice(0, 1))}</div>`
            }
          </div>
          `
            : ""
        }
      </div>
    `;

      return `
      <div class="msg-bubble-row ${m.role} ${isSelected ? "is-selected" : ""}" data-msg-idx="${idx}">
        ${
          isMultiSelectMode
            ? `
          <div class="multiselect-checkbox-wrap">
            <span class="ins-checkbox-circle ${isSelected ? "checked" : ""}">
              ${
                isSelected
                  ? `
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              `
                  : ""
              }
            </span>
          </div>
        `
            : ""
        }

        <!-- Char 侧头像 (靠左) -->
        ${!isUser ? avatarElementHtml : ""}

        <div class="msg-bubble-wrapper ${isSelected ? "selected-bubble" : ""}">
          <div class="msg-bubble ${m.cardType ? "is-card" : ""}" data-bubble-idx="${idx}">
            ${
              m.quote
                ? `
              <div class="msg-bubble-quote-card">
                <div class="quote-card-header">
                  <span class="quote-card-user">${escapeHtml(m.quote.sender)}</span>
                  <span class="quote-card-mark">QUOTE</span>
                </div>
                <div class="quote-card-text">${escapeHtml(m.quote.content)}</div>
              </div>
            `
                : ""
            }

            ${mainBubbleBody}
            
            ${
              m.translation
                ? `
              <div class="msg-bubble-translation-wrap">
                <div class="msg-trans-line-divider"></div>
                <div class="msg-trans-text">${escapeHtml(m.translation)}</div>
              </div>
            `
                : ""
            }
          </div>
          <span class="msg-time-outside">${m.time || ""}</span>
        </div>

        <!-- User 侧头像 (靠右) -->
        ${isUser ? avatarElementHtml : ""}
      </div>
    `;
    })
    .join("");
}

// ════════════════════ 5. 设置内置页面 HTML ════════════════════
function renderSettingsContentHtml() {
  const char = activeCharInfo;
  const memories = getAllAggregatedMemories(char.name);
  const darkroom = McpGateway.getCharDarkroom(char.name);
  const weather = McpGateway.getCharRelationshipWeather(char.name);
  const schedules = char.schedules || [];
  const bgActivities = char.backgroundActivities || [];
  const tzPreview = getCharPerceivedTimeInfo(
    char.perceivedTimezone || "Asia/Tokyo",
  );

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
            ${
              char.avatarUrl
                ? `<img src="${char.avatarUrl}" id="img-settings-preview" />`
                : `
              <div class="ins-avatar-placeholder">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
            `
            }
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
              <input type="text" class="ins-input-text" id="input-char-remark" placeholder="专属昵称/备注" value="${escapeHtml(char.remark || "")}" />
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
            <option value="中文" ${char.targetLang === "中文" ? "selected" : ""}>中文 (普通话 / 自然生活口语)</option>
            <option value="日语" ${char.targetLang === "日语" ? "selected" : ""}>日语 (日本語 - 地道现代口语/短信)</option>
            <option value="英语" ${char.targetLang === "英语" ? "selected" : ""}>英语 (English - 自然日常短信)</option>
            <option value="韩语" ${char.targetLang === "韩语" ? "selected" : ""}>韩语 (한국어)</option>
          </select>
        </div>

               <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">启用气泡内嵌翻译</span>
            <span class="toggle-sub-desc">外语角色在单次思考中一并生成中文翻译，直接内嵌于对应气泡底部</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-translation-switch" ${char.enableTranslation ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>
      </section>

      <!-- ✨ 模块 2.5：聊天室美化板块 (位于翻译板块下方) -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">界面美化与质感 / THEME & CUSTOM</span>
          <span style="font-size: 8.5px; color: #888; font-weight: 700;">INS LINEAR B&W</span>
        </div>
        <p class="ins-card-desc">定制专属头像挂件、气泡样式、黑白主题色调与背景壁纸。</p>
        <button class="ins-mini-btn highlight" id="btn-open-chat-theme-subview" style="width: 100%; padding: 8px 0; margin-top: 4px; font-size: 11px;">
          进入美化定制中心 (挂件 / 气泡 / 主题 / 壁纸)
        </button>
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
            <input type="checkbox" id="toggle-time-perception" ${char.timePerceptionEnabled !== false ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <div class="ins-field-group" style="margin-top: 8px;">
          <label class="ins-field-label">角色所在物理时区</label>
          <select class="ins-select-input" id="select-char-timezone">
            <option value="Asia/Tokyo" ${(char.perceivedTimezone || "Asia/Tokyo") === "Asia/Tokyo" ? "selected" : ""}>日本 · 东京时间 (Tokyo, UTC+9)</option>
            <option value="Asia/Shanghai" ${char.perceivedTimezone === "Asia/Shanghai" ? "selected" : ""}>中国 · 北京时间 (Beijing, UTC+8)</option>
            <option value="Asia/Seoul" ${char.perceivedTimezone === "Asia/Seoul" ? "selected" : ""}>韩国 · 首尔时间 (Seoul, UTC+9)</option>
            <option value="Europe/London" ${char.perceivedTimezone === "Europe/London" ? "selected" : ""}>英国 · 伦敦时间 (London, UTC+0/+1)</option>
            <option value="America/New_York" ${char.perceivedTimezone === "America/New_York" ? "selected" : ""}>美国 · 纽约东部时间 (New York, UTC-5)</option>
            <option value="America/Los_Angeles" ${char.perceivedTimezone === "America/Los_Angeles" ? "selected" : ""}>美国 · 洛杉矶太平洋时间 (LA, UTC-8)</option>
            <option value="Europe/Paris" ${char.perceivedTimezone === "Europe/Paris" ? "selected" : ""}>法国 · 巴黎时间 (Paris, UTC+1/+2)</option>
          </select>
        </div>

               <div style="background:#F8F8F8; border-radius:6px; padding:6px 8px; font-size:9.5px; color:#666; margin-top:4px;">
          <span>当前当地物理时间：<strong>${tzPreview.fullDateStr}</strong></span>
        </div>
      </section>

          <!-- ✨ 模块 3.1：独立暗房定时刷新 (开关控制显隐) -->
      <section class="ins-settings-card">
        <div class="ins-card-title">独立暗房定时刷新 / DARKROOM AUTO-REFRESH</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">开启独立暗房定时潜思</span>
            <span class="toggle-sub-desc">到达指定时间间隔后，角色会在后台自动生成一条隐性心境思绪并存入暗房。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-darkroom-autorefresh" ${char.darkroomAutoRefresh ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <!-- 只有开启时才显示的刷新间隔配置 -->
        <div class="ins-field-group" id="wrap-darkroom-interval" style="margin-top: 8px; display: ${char.darkroomAutoRefresh ? "flex" : "none"};">
          <label class="ins-field-label">暗房刷新时间间隔</label>
          <select class="ins-select-input" id="select-darkroom-interval">
            <option value="30" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 30 ? "selected" : ""}>每 30 分钟 (极速沉淀)</option>
            <option value="45" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 45 ? "selected" : ""}>每 45 分钟</option>
            <option value="60" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 60 ? "selected" : ""}>每 60 分钟 (标准 1 小时)</option>
            <option value="90" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 90 ? "selected" : ""}>每 90 分钟 (1.5 小时)</option>
            <option value="120" ${parseInt(char.darkroomIntervalMinutes || 60, 10) === 120 ? "selected" : ""}>每 120 分钟 (2 小时慢速沉淀)</option>
                   </select>
        </div>
      </section>

      <!-- ✨ 模块 3.2：自主更换头像与专属头像库 -->
      <section class="ins-settings-card">
        <div class="ins-card-title">自主换头像系统 / AUTONOMOUS AVATAR</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">开启角色自主挑选换头像</span>
            <span class="toggle-sub-desc">开启后角色可在头像库中挑选自己心仪的头像更换，并支持换情侣头像。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-auto-avatar-change" ${char.autoChangeAvatar ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

              <div class="ins-field-group" id="wrap-auto-avatar-controls" style="margin-top: 8px; display: ${char.autoChangeAvatar ? "flex" : "none"};">
          <button class="ins-mini-btn highlight" id="btn-open-avatar-vault" style="width:100%; padding:8px 0; font-size:11px;">
            进入专属头像库 (Char / User / 情侣头像)
          </button>
        </div>
      </section>

          <!-- ✨ 模块 3.3：自主修改备注系统 (全新板块) -->
      <section class="ins-settings-card">
        <div class="ins-card-title">自主修改备注系统 / AUTONOMOUS REMARK</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">开启角色自主改备注权限</span>
            <span class="toggle-sub-desc">角色根据喜好与性格自主判断当前的备注。满意时可能暗爽夸赞，不满意时有权将其修改为心仪称呼。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-auto-remark-change" ${char.autoChangeRemark ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>
      </section>

      <!-- ✨ 模块 3.4：专属语音系统配置 (位于日程安排上方) -->
      <section class="ins-settings-card">
        <div class="ins-card-title">专属语音系统 / VOICE SYSTEM</div>
        <div class="ins-setting-toggle-row">
          <div class="toggle-left-info">
            <span class="toggle-main-title">启用角色专属语音</span>
            <span class="toggle-sub-desc">开启后角色发消息或点击语音工具时可使用 TTS 语音合成发声。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-char-voice-enable" ${char.voiceEnabled ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <!-- 开启后展开二选一配置 -->
        <div id="wrap-char-voice-settings" style="margin-top: 8px; display: ${char.voiceEnabled ? "flex" : "none"}; flex-direction: column; gap: 8px;">
          <div class="ins-field-group">
            <label class="ins-field-label">语音配置来源</label>
            <div class="ins-vault-scope-bar" style="margin-bottom: 0;">
              <button class="ins-scope-btn ${(char.voiceSource || 'global') === 'global' ? 'active' : ''}" data-vsource="global">直接使用全局 API 语音</button>
              <button class="ins-scope-btn ${char.voiceSource === 'custom' ? 'active' : ''}" data-vsource="custom">重新单独设置</button>
            </div>
          </div>

          <!-- 选项 1：直接使用全局设置说明 -->
          <div id="voice-source-global-desc" style="display: ${(char.voiceSource || 'global') === 'global' ? 'block' : 'none'}; background: var(--bg-sub); border: 1px solid var(--line-color); border-radius: 8px; padding: 8px 10px; font-size: 9.5px; color: var(--text-muted); line-height: 1.4;">
            当前将直接使用你在<strong>「系统设置 -> 语音」</strong>板块中配置好的 MiniMax 或 ElevenLabs 密钥与音色。
          </div>

          <!-- 选项 2：重新单独设置展开面板 -->
          <div id="voice-source-custom-pane" style="display: ${char.voiceSource === 'custom' ? 'flex' : 'none'}; flex-direction: column; gap: 6px;">
            <div class="ins-field-group">
              <label class="ins-field-label">语音服务商</label>
              <select class="ins-select-input" id="char-voice-custom-platform">
                <option value="minimax" ${(char.voiceCustomPlatform || 'minimax') === 'minimax' ? 'selected' : ''}>MiniMax (海螺语音)</option>
                <option value="elevenlabs" ${char.voiceCustomPlatform === 'elevenlabs' ? 'selected' : ''}>ElevenLabs</option>
              </select>
            </div>
            
            <div class="ins-field-group">
              <label class="ins-field-label">专属 API Key</label>
              <input type="password" class="ins-input-text" id="char-voice-custom-apikey" value="${escapeHtml(char.voiceCustomApiKey || '')}" placeholder="sk-... 或 Bearer token" />
            </div>

            <div class="ins-field-group" id="wrap-custom-groupid" style="display: ${(char.voiceCustomPlatform || 'minimax') === 'minimax' ? 'flex' : 'none'};">
              <label class="ins-field-label">MiniMax Group ID</label>
              <input type="text" class="ins-input-text" id="char-voice-custom-groupid" value="${escapeHtml(char.voiceCustomGroupId || '')}" placeholder="输入 Group ID..." />
            </div>

            <div class="ins-field-group">
              <label class="ins-field-label">专属 Voice ID / 音色</label>
              <input type="text" class="ins-input-text" id="char-voice-custom-voiceid" value="${escapeHtml(char.voiceCustomVoiceId || 'female-yujie')}" placeholder="如 female-yujie 或 克隆 Voice ID" />
            </div>
          </div>
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
          ${schedules.length === 0 ? `<div class="ins-empty-hint">暂无特殊日程（聊天中的行程约定将自动同步记录）</div>` : ""}
          ${schedules
            .map(
              (s, sIdx) => `
            <div class="ins-schedule-item" data-idx="${sIdx}">
              <input type="text" class="ins-schedule-time" placeholder="如 明天 14:00" value="${escapeHtml(s.time || "")}" />
              <input type="text" class="ins-schedule-text" placeholder="日程内容，如 涉谷咖啡厅碰面" value="${escapeHtml(s.text || "")}" />
              <button class="ins-item-del-btn btn-del-schedule" data-idx="${sIdx}">×</button>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>

           <!-- ✨ 模块 5：后台自主活动与动向 (开关联动 15~120分钟) -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">后台自主活动 / AUTONOMOUS ACTIVITY</span>
          <button class="ins-mini-btn" id="btn-trigger-bg-activity">即时生成一条</button>
        </div>
        
        <div class="ins-setting-toggle-row" style="margin-top: 4px;">
          <div class="toggle-left-info">
            <span class="toggle-main-title">开启后台自主活动 (主动发消息 / 发动态)</span>
            <span class="toggle-sub-desc">角色离开聊天期间在后台独立生活，到时间自主给用户发短信或更新生活动态。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-bg-auto-activity" ${char.bgAutoActivity ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

        <div class="ins-field-group" id="wrap-bg-activity-interval" style="margin-top: 8px; display: ${char.bgAutoActivity ? "flex" : "none"};">
          <label class="ins-field-label">自主活动与发消息时间间隔</label>
          <select class="ins-select-input" id="select-bg-activity-interval">
            <option value="15" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 15 ? "selected" : ""}>每 15 分钟 (高频活跃)</option>
            <option value="30" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 30 ? "selected" : ""}>每 30 分钟</option>
            <option value="45" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 45 ? "selected" : ""}>每 45 分钟 (推荐)</option>
            <option value="60" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 60 ? "selected" : ""}>每 60 分钟 (1 小时)</option>
            <option value="90" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 90 ? "selected" : ""}>每 90 分钟 (1.5 小时)</option>
            <option value="120" ${parseInt(char.bgActivityIntervalMinutes || 45, 10) === 120 ? "selected" : ""}>每 120 分钟 (2 小时慢速生活)</option>
          </select>
        </div>

        <div class="ins-bg-activity-box" id="ins-bg-activity-container" style="margin-top: 6px;">
          ${bgActivities.length === 0 ? `<div class="ins-empty-hint">暂无动向记录，开启后角色将在此记录独立生活动态</div>` : ""}
          ${bgActivities
            .map(
              (bg, bgIdx) => `
            <div class="ins-bg-item">
              <span class="ins-bg-time">${bg.time || ""}</span>
              <span class="ins-bg-text">${escapeHtml(bg.text || "")}</span>
              <button class="ins-item-del-btn btn-del-bg" data-idx="${bgIdx}">×</button>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>

      <!-- ✨ 模块 5.5：记忆记录 / MEMORY RECORDING (位于沙盒记忆库上方) -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">记忆记录 / MEMORY RECORDING</span>
          <button class="ins-mini-btn highlight" id="btn-manual-extract-memories">立即手动提取记忆</button>
        </div>
        <div class="ins-setting-toggle-row" style="margin-top: 4px;">
          <div class="toggle-left-info">
            <span class="toggle-main-title">自动提取记忆 (按对话轮次)</span>
            <span class="toggle-sub-desc">1轮 = User发送 + Char回复完毕。到达指定轮次自动提炼并同步沙盒记忆库。</span>
          </div>
          <label class="ins-switch">
            <input type="checkbox" id="toggle-auto-extract-mem" ${char.autoExtractMemory !== false ? "checked" : ""} />
            <span class="ins-slider"></span>
          </label>
        </div>

               <!-- 自动提取轮次 10~200 动态拉条 -->
        <div class="ins-field-group" id="wrap-extract-turn-interval" style="margin-top: 8px; display: ${char.autoExtractMemory !== false ? "flex" : "none"};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <label class="ins-field-label">自动提取轮次设定 (10~200 轮)</label>
            <span id="label-extract-turn-val" style="font-size:9.5px; font-weight:700; color:#111; font-family:ui-monospace, monospace;">
              ${char.autoExtractTurnInterval || 20} 轮 (进度: ${char.currentTurnCounter || 0}/${char.autoExtractTurnInterval || 20})
            </span>
          </div>
          <input type="range" class="api-range" id="range-extract-turn-interval" min="10" max="200" step="5" value="${char.autoExtractTurnInterval || 20}" style="width: 100%; cursor: pointer;" />
          <div style="display:flex; justify-content:space-between; font-size:8px; color:#888; margin-top:2px; font-family:ui-monospace, monospace;">
            <span>10 轮 (极速提炼)</span>
            <span>100 轮</span>
            <span>200 轮 (深度大周期)</span>
          </div>
        </div>
      </section>

      <!-- 模块 6：沙盒记忆库 -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">专属沙盒记忆库 / MEMORY VAULT</span>
        </div>
        <div style="font-size: 9.5px; color: #666; margin-bottom: 2px;">
          已连通记忆：<strong>${memories.length} 条</strong> · 羁绊状态: ${weather.status}
        </div>

        <div class="ins-memory-tag-list" id="ins-memory-container">
          ${memories.length === 0 ? `<div class="ins-empty-hint">暂无沉淀记忆，可在「设置-旧机搬家」中导入历史记忆。</div>` : ""}
          ${memories
            .map(
              (mem) => `
            <div class="ins-memory-item">
              <span class="ins-memory-bullet">▪</span>
              <div style="flex:1;">
                <span style="font-size:8.5px; color:#888; font-family:monospace;">[${escapeHtml(mem.anchorType || "专属约定")}]</span>
                <span class="ins-memory-text">${escapeHtml(mem.content)}</span>
              </div>
              <button class="ins-item-del-btn btn-del-memory" data-mem-id="${mem.id}" data-mem-content="${escapeHtml(mem.content)}">×</button>
            </div>
          `,
            )
            .join("")}
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
  if (!targetMsg || targetMsg.role === "notice") return;

  activeMenuMsgIdx = idx;
  const wrapper = bubbleEl.closest(".msg-bubble-wrapper");
  if (!wrapper) return;

  const isUserMsg = targetMsg.role === "user";

  const popover = document.createElement("div");
  popover.className = "ins-bubble-menu-popover";
  popover.id = "active-bubble-popover";
  popover.setAttribute("data-menu-idx", idx);

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
  const existing = document.getElementById("active-bubble-popover");
  if (existing) {
    existing.remove();
  }
  activeMenuMsgIdx = null;
}

// ════════════════════ 7. 事件绑定 ════════════════════
function bindChatRoomEvents(roomEl, container) {
  roomEl.querySelector("#btn-chat-back").onclick = () => {
    roomEl.remove();
  };

  const quickAvatarBtn = roomEl.querySelector("#btn-quick-change-avatar");
  const quickAvatarInput = roomEl.querySelector("#chat-avatar-upload-quick");
  if (quickAvatarBtn && quickAvatarInput) {
    quickAvatarBtn.onclick = () => {
      quickAvatarInput.value = "";
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

  const searchBtn = roomEl.querySelector("#btn-toggle-search");
  const searchBar = roomEl.querySelector("#chat-search-slide-bar");
  const searchInput = roomEl.querySelector("#chat-search-kw-input");
  const closeSearchBtn = roomEl.querySelector("#btn-close-search");

  if (searchBtn && searchBar) {
    searchBtn.onclick = () => {
      isSearchMode = !isSearchMode;
      searchBar.classList.toggle("active", isSearchMode);
      if (isSearchMode && searchInput) searchInput.focus();
    };

    closeSearchBtn.onclick = () => {
      isSearchMode = false;
      searchBar.classList.remove("active");
      renderChatRoomView(container);
    };

    searchInput.oninput = (e) => {
      const kw = e.target.value.trim().toLowerCase();
      const area = roomEl.querySelector("#chat-messages-scroll-area");
      if (!kw) {
        area.innerHTML =
          `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 实时交互通道</div>` +
          renderMessagesHtml(chatMessages);
        return;
      }
      const filtered = chatMessages.filter(
        (m) =>
          (m.content && m.content.toLowerCase().includes(kw)) ||
          (m.translation && m.translation.toLowerCase().includes(kw)),
      );
      area.innerHTML =
        `<div class="chat-handoff-pill">搜索结果: 找到 ${filtered.length} 条相关对话</div>` +
        renderMessagesHtml(filtered);
    };
  }

  const settingsBtn = roomEl.querySelector("#btn-open-char-settings");
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      isSettingsOpen = true;
      renderChatRoomView(container);
    };
  }

  const moreBtn = roomEl.querySelector("#btn-toggle-more");
  const moreDrawer = roomEl.querySelector("#chat-more-drawer");
  if (moreBtn && moreDrawer) {
    moreBtn.onclick = () => {
      isMoreToolsOpen = !isMoreToolsOpen;
      moreDrawer.classList.toggle("active", isMoreToolsOpen);
    };
  }

  // 1. 重回
  const rewindTool = roomEl.querySelector("#tool-rewind-chat");
  if (rewindTool) {
    rewindTool.onclick = () => {
      const hasAssistantReply = chatMessages.some(
        (m) => m.role === "assistant",
      );
      if (!hasAssistantReply) {
        showInsToast("当前轮次暂无可重回的角色回复");
        return;
      }
      isMoreToolsOpen = false;
      isRewindModalOpen = true;
      renderChatRoomView(container);
    };
  }

  // 重回弹窗关闭
  const closeRewindBtn = roomEl.querySelector("#btn-cancel-rewind");
  const cancelRewindAction = roomEl.querySelector("#btn-cancel-rewind-action");
  const handleCloseRewind = () => {
    isRewindModalOpen = false;
    renderChatRoomView(container);
  };
  if (closeRewindBtn) closeRewindBtn.onclick = handleCloseRewind;
  if (cancelRewindAction) cancelRewindAction.onclick = handleCloseRewind;

  // 重回确认执行
  const confirmRewindBtn = roomEl.querySelector("#btn-confirm-rewind-action");
  if (confirmRewindBtn) {
    confirmRewindBtn.onclick = () => {
      const dirInput = roomEl.querySelector("#rewind-direction-input");
      const directionText = dirInput ? dirInput.value.trim() : "";

      while (
        chatMessages.length > 0 &&
        chatMessages[chatMessages.length - 1].role === "assistant"
      ) {
        chatMessages.pop();
      }

      saveChatMessages(activeCharInfo.name, chatMessages);
      isRewindModalOpen = false;

      handleSingleTurnReply(container, directionText);
    };
  }

   // 2. ✨ 语音：打开三合一语音发送面板 (手打模拟 / STT / 原声录音)
  const ttsTool = roomEl.querySelector("#tool-tts-speak");
  if (ttsTool) {
    ttsTool.onclick = () => {
      isMoreToolsOpen = false;
      VoiceTool.openVoiceModal(activeCharInfo, (voicePayload) => {
        sendCustomMediaMessage("voice", voicePayload, container);
      });
    };
  }

    // 3. ✨ 相机：打开双板块相机悬浮窗 (实时拍照 / 文字模拟照片)
  const cameraTool = roomEl.querySelector("#tool-open-camera");
  if (cameraTool) {
    cameraTool.onclick = () => {
      isMoreToolsOpen = false;
      CameraTool.openCameraModal(activeCharInfo, (photoPayload) => {
        sendCustomMediaMessage(photoPayload.cardType, photoPayload, container);
      });
    };
  }

  // 4. 相册
  const albumTool = roomEl.querySelector("#tool-open-album");
  const albumInput = roomEl.querySelector("#input-chat-album");
  if (albumTool && albumInput) {
    albumTool.onclick = () => {
      albumInput.value = "";
      albumInput.click();
    };
    albumInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (dataUrl) => {
        isMoreToolsOpen = false;
        sendCustomMediaMessage(
          "image",
          { mediaUrl: dataUrl, content: "[照片]" },
          container,
        );
      });
    };
  }

  // 5. 转账
  const transferTool = roomEl.querySelector("#tool-send-transfer");
  if (transferTool) {
    transferTool.onclick = () => {
      const amount = prompt("请输入转账金额 (¥):", "520");
      if (!amount || isNaN(amount)) return;
      const note =
        prompt("添加转账备注 (可选):", "拿去买喜欢的乐器/零食") || "转账";
      isMoreToolsOpen = false;
      sendCustomMediaMessage("transfer", { amount, content: note }, container);
    };
  }

  // 6. 礼物
  const giftTool = roomEl.querySelector("#tool-send-gift");
  if (giftTool) {
    giftTool.onclick = () => {
      const giftName = prompt(
        "选择要送出的礼物 (如: 热美式咖啡 / 草莓蛋糕 / 乐队吉他拨片 / 暖手宝):",
        "草莓蛋糕",
      );
      if (!giftName || !giftName.trim()) return;
      const note =
        prompt("附带赠言 (可选):", "刚才路过买的，趁热吃") || "送给你的礼物";
      isMoreToolsOpen = false;
      sendCustomMediaMessage("gift", { giftName, content: note }, container);
    };
  }

  // 7. 定位
  const locationTool = roomEl.querySelector("#tool-send-location");
  if (locationTool) {
    locationTool.onclick = () => {
      const loc =
        prompt("输入或确认当前发送的地理位置:", "涉谷区 · 代代木公园长椅前") ||
        "当前位置";
      if (!loc.trim()) return;
      isMoreToolsOpen = false;
      sendCustomMediaMessage(
        "location",
        { locationName: loc, content: `[位置: ${loc}]` },
        container,
      );
    };
  }

  // 8. 分享
  const shareTool = roomEl.querySelector("#tool-share-chat");
  if (shareTool) {
    shareTool.onclick = () => {
      const text = chatMessages
        .filter((m) => m.role !== "notice")
        .map(
          (m) =>
            `[${m.role === "user" ? "User" : activeCharInfo.name}]: ${m.content} ${m.translation ? `(译: ${m.translation})` : ""}`,
        )
        .join("\n");
      navigator.clipboard.writeText(text);
      isMoreToolsOpen = false;
      showInsToast("已将对话记录复制至剪贴板");
    };
  }

  // 9. 线下
  const offlineTool = roomEl.querySelector("#tool-offline-meetup");
  if (offlineTool) {
    offlineTool.onclick = () => {
      const sceneName = prompt(
        "输入当下面对面见面的地点与场景 (如: 涉谷咖啡厅角落 / 公寓沙发上 / Livehouse后台):",
        "涉谷咖啡厅角落",
      );
      if (!sceneName || !sceneName.trim()) return;
      const note =
        prompt(
          "当下的初始动作/状态描述 (如: 点了两杯热拿铁，坐在你对面看着你):",
          "坐在你对面看着你",
        ) || "见面相处中";
      isMoreToolsOpen = false;
      sendCustomMediaMessage(
        "offline",
        { locationName: sceneName, content: note },
        container,
      );
    };
  }

  // 10. 语音通话
  const voiceCallTool = roomEl.querySelector("#tool-voice-call");
  if (voiceCallTool) {
    voiceCallTool.onclick = () => {
      isMoreToolsOpen = false;
      startCallSession("voice", container);
    };
  }

  // 11. 视频通话
  const videoCallTool = roomEl.querySelector("#tool-video-call");
  if (videoCallTool) {
    videoCallTool.onclick = () => {
      isMoreToolsOpen = false;
      startCallSession("video", container);
    };
  }

  // 12. 表情包
  const stickerTool = roomEl.querySelector("#tool-open-stickers");
  if (stickerTool) {
    stickerTool.onclick = () => {
      isMoreToolsOpen = false;
      isStickerDrawerOpen = true;
      renderChatRoomView(container);
    };
  }

  const closeStickerBtn = roomEl.querySelector("#btn-close-stickers");
  if (closeStickerBtn) {
    closeStickerBtn.onclick = () => {
      isStickerDrawerOpen = false;
      renderChatRoomView(container);
    };
  }

  roomEl.querySelectorAll("[data-stk-idx]").forEach((el) => {
    el.onclick = () => {
      const idx = parseInt(el.getAttribute("data-stk-idx"), 10);
      const stk = PRESET_STICKERS[idx];
      if (stk) {
        isStickerDrawerOpen = false;
        sendCustomMediaMessage(
          "sticker",
          {
            stickerName: stk.name,
            stickerText: stk.text,
            content: `[表情: ${stk.name}]`,
          },
          container,
        );
      }
    };
  });

  // 气泡点击与多选
  const bubbleArea = roomEl.querySelector("#chat-messages-scroll-area");
  if (bubbleArea) {
    bubbleArea.onclick = (e) => {
      const menuItemBtn = e.target.closest(".bubble-menu-item");
      if (menuItemBtn) {
        const action = menuItemBtn.getAttribute("data-action");
        const popover = menuItemBtn.closest(".ins-bubble-menu-popover");
        const targetIdx = parseInt(popover.getAttribute("data-menu-idx"), 10);
        closeBubblePopover();
        handleBubbleMenuAction(action, targetIdx, container);
        return;
      }

      if (isMultiSelectMode) {
        const msgRow =
          e.target.closest(".msg-bubble-row") ||
          e.target.closest(".chat-system-notice-row");
        if (msgRow) {
          const idx = parseInt(msgRow.getAttribute("data-msg-idx"), 10);
          const checkboxCircle = msgRow.querySelector(".ins-checkbox-circle");
          const bubbleWrap = msgRow.querySelector(".msg-bubble-wrapper");

          if (selectedMsgIndices.has(idx)) {
            selectedMsgIndices.delete(idx);
            msgRow.classList.remove("is-selected");
            bubbleWrap?.classList.remove("selected-bubble");
            if (checkboxCircle) checkboxCircle.innerHTML = "";
            checkboxCircle?.classList.remove("checked");
          } else {
            selectedMsgIndices.add(idx);
            msgRow.classList.add("is-selected");
            bubbleWrap?.classList.add("selected-bubble");
            if (checkboxCircle) {
              checkboxCircle.classList.add("checked");
              checkboxCircle.innerHTML = `
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              `;
            }
          }

          const countLabel = roomEl.querySelector("#multiselect-count-label");
          const delBtn = roomEl.querySelector("#btn-delete-selected");
          if (countLabel)
            countLabel.textContent = `${selectedMsgIndices.size} 项`;
          if (delBtn) delBtn.disabled = selectedMsgIndices.size === 0;
          return;
        }
      }

            // ✨ 点击模拟照片卡片：展开/收起画面详情
      const simPhotoCard = e.target.closest(".msg-sim-photo-card");
      if (simPhotoCard) {
        const pIdx = parseInt(simPhotoCard.getAttribute("data-sim-photo-idx"), 10);
        const targetPhotoMsg = chatMessages[pIdx];
        if (targetPhotoMsg) {
          targetPhotoMsg.isTextVisible = !targetPhotoMsg.isTextVisible;
          const detailBox = simPhotoCard.querySelector(".sim-photo-detail-box");
          if (targetPhotoMsg.isTextVisible && !detailBox) {
            const box = document.createElement("div");
            box.className = "sim-photo-detail-box";
            box.innerHTML = `<span class="sim-photo-detail-tag">画面详情与场景</span><span class="sim-photo-detail-content">${escapeHtml(targetPhotoMsg.photoDesc || targetPhotoMsg.content)}</span>`;
            simPhotoCard.appendChild(box);
          } else if (!targetPhotoMsg.isTextVisible && detailBox) {
            detailBox.remove();
          }
          return;
        }
      }

                  // ✨ 核心交互：语音条单击展文/播放 vs 双击呼出气泡菜单
      const voiceCard = e.target.closest(".msg-voice-card");
      if (voiceCard) {
        const vIdx = parseInt(voiceCard.getAttribute("data-voice-msg-idx"), 10);
        const targetVoiceMsg = chatMessages[vIdx];
        const bubbleEl = voiceCard.closest(".msg-bubble");
        const now = Date.now();

        // ⚡ 1. 双击判定（300ms 内同一语音条连续点击两次）➔ 呼出气泡菜单
        if (lastVoiceClickIdx === vIdx && (now - lastVoiceClickTime) < 300) {
          if (voiceClickTimer) {
            clearTimeout(voiceClickTimer);
            voiceClickTimer = null;
          }
          lastVoiceClickTime = 0;
          lastVoiceClickIdx = null;

          if (activeMenuMsgIdx === vIdx) {
            closeBubblePopover();
          } else {
            openBubblePopover(bubbleEl, vIdx);
          }
          return;
        }

        // 记录本次点击时间戳
        lastVoiceClickTime = now;
        lastVoiceClickIdx = vIdx;

        // ⚡ 2. 单击判定（延迟 250ms 执行展开文字与播放，若 250ms 内发生第二次点击则被双击取消）
        if (voiceClickTimer) clearTimeout(voiceClickTimer);
        voiceClickTimer = setTimeout(() => {
          if (!targetVoiceMsg) return;
          targetVoiceMsg.isTextVisible = !targetVoiceMsg.isTextVisible;

          const waveBox = roomEl.querySelector(`#voice-anim-${vIdx}`);

          if (targetVoiceMsg.audioDataUrl || targetVoiceMsg.role === "assistant") {
            if (waveBox) waveBox.classList.add("playing");
            VoiceTool.playVoiceBarAudio(targetVoiceMsg, activeCharInfo, () => {
              if (waveBox) waveBox.classList.remove("playing");
            });
          }

          const transBox = voiceCard.querySelector(".voice-text-trans-box");
          if (targetVoiceMsg.isTextVisible && !transBox) {
            const box = document.createElement("div");
            box.className = "voice-text-trans-box";
            box.innerHTML = `<span class="voice-trans-tag">语音文字内容</span><span class="voice-trans-content">${escapeHtml(targetVoiceMsg.content)}</span>`;
            voiceCard.appendChild(box);
          } else if (!targetVoiceMsg.isTextVisible && transBox) {
            transBox.remove();
          }
        }, 250);

        return;
      }

      const bubbleEl = e.target.closest(".msg-bubble");
      if (bubbleEl) {
        const idx = parseInt(bubbleEl.getAttribute("data-bubble-idx"), 10);
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
  const cancelQuoteBtn = roomEl.querySelector("#btn-cancel-quote");
  if (cancelQuoteBtn) {
    cancelQuoteBtn.onclick = () => {
      quotedMessage = null;
      const quoteContainer = roomEl.querySelector("#chat-quote-bar-container");
      if (quoteContainer) quoteContainer.innerHTML = "";
    };
  }

  const deleteSelectedBtn = roomEl.querySelector("#btn-delete-selected");
  if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = () => {
      if (selectedMsgIndices.size === 0) return;
      const count = selectedMsgIndices.size;
      const confirmDel = window.confirm(
        `确定要批量删除选中的 ${count} 条消息吗？\n（已删除的消息角色将不再保留任何记忆）`,
      );
      if (confirmDel) {
        chatMessages = chatMessages.filter(
          (_, idx) => !selectedMsgIndices.has(idx),
        );
        saveChatMessages(activeCharInfo.name, chatMessages);

        const lastMsg =
          chatMessages[chatMessages.length - 1]?.content || "[已清空对话]";
        updateActiveChatListSummary(activeCharInfo.name, lastMsg, "");

        isMultiSelectMode = false;
        selectedMsgIndices.clear();
        closeBubblePopover();
        renderChatRoomView(container);
        showInsToast(`已删除 ${count} 条记录`);
      }
    };
  }

  const cancelMultiBtn = roomEl.querySelector("#btn-cancel-multiselect");
  if (cancelMultiBtn) {
    cancelMultiBtn.onclick = () => {
      isMultiSelectMode = false;
      selectedMsgIndices.clear();
      closeBubblePopover();
      renderChatRoomView(container);
    };
  }

  const sendBtn = roomEl.querySelector("#btn-send-message");
  const inputArea = roomEl.querySelector("#chat-input-textarea");

  const executeSendOnly = () => {
    if (!inputArea) return;
    const text = inputArea.value.trim();
    if (!text || isGenerating) return;
    inputArea.value = "";
    handleUserSendMessageOnly(text, container);
  };

  if (sendBtn && inputArea) {
    sendBtn.onclick = executeSendOnly;
    inputArea.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        executeSendOnly();
      }
    };
  }

  const continueBtn = roomEl.querySelector("#btn-continue-writing");
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
    const timerEl = document.querySelector("#call-duration-timer");
    if (timerEl) timerEl.textContent = formatCallDuration(callDurationSeconds);
  }, 1000);

  renderChatRoomView(container);
}

function bindCallOverlayEvents(roomEl, container) {
  const muteBtn = roomEl.querySelector("#btn-call-toggle-mute");
  if (muteBtn) {
    muteBtn.onclick = () => {
      isCallMuted = !isCallMuted;
      renderChatRoomView(container);
    };
  }

  const speakerBtn = roomEl.querySelector("#btn-call-toggle-speaker");
  if (speakerBtn) {
    speakerBtn.onclick = () => {
      isCallSpeaker = !isCallSpeaker;
      renderChatRoomView(container);
    };
  }

  const hangupBtn = roomEl.querySelector("#btn-call-hangup");
  if (hangupBtn) {
    hangupBtn.onclick = () => {
      if (callTimerInterval) clearInterval(callTimerInterval);
      const durationStr = formatCallDuration(callDurationSeconds);
      const mode = activeCallType;
      activeCallType = null;

      sendCustomMediaMessage(
        "call",
        {
          callMode: mode,
          durationSeconds: callDurationSeconds,
          durationStr: durationStr,
          content: `[${mode === "video" ? "视频通话" : "语音通话"} · 通话时长 ${durationStr}]`,
        },
        container,
      );
    };
  }
}

// ════════════════════ 9. 发送富媒体卡片 ════════════════════
function sendCustomMediaMessage(cardType, payload, container) {
  const charName = activeCharInfo.name;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const newMsg = {
    role: "user",
    cardType: cardType,
    time: timeStr,
    timestamp: now.getTime(),
    ...payload,
  };

  chatMessages.push(newMsg);
  saveChatMessages(charName, chatMessages);
  updateActiveChatListSummary(
    charName,
    payload.content || `[${cardType}]`,
    timeStr,
  );

  // ✨ 核心修复：发图片局部插入，0 闪屏
  const scrollArea = document.querySelector("#chat-messages-scroll-area");
  if (scrollArea) {
    scrollArea.innerHTML = `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 实时交互通道</div>` + renderMessagesHtml(chatMessages);
    setTimeout(() => { scrollArea.scrollTop = scrollArea.scrollHeight; }, 20);
  } else {
    renderChatRoomView(container);
  }
}

// ════════════════════ 10. 气泡微菜单动作 ════════════════════
function handleBubbleMenuAction(action, idx, container) {
  const targetMsg = chatMessages[idx];
  if (!targetMsg) return;

  const senderName = targetMsg.role === "user" ? "我" : activeCharInfo.name;

  if (action === "quote") {
    quotedMessage = {
      sender: senderName,
      content: targetMsg.content || `[${targetMsg.cardType || "卡片"}]`,
    };
    const quoteContainer = document.querySelector("#chat-quote-bar-container");
    if (quoteContainer) {
      quoteContainer.innerHTML = renderQuoteBarHtml();
      const cancelBtn = quoteContainer.querySelector("#btn-cancel-quote");
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          quotedMessage = null;
          quoteContainer.innerHTML = "";
        };
      }
    }
    const textarea = document.querySelector("#chat-input-textarea");
    if (textarea) textarea.focus();
  } else if (action === "recall") {
    if (targetMsg.role !== "user") {
      showInsToast("无法撤回对方发送的消息");
      return;
    }

    const now = Date.now();
    const msgTime = targetMsg.timestamp || 0;
    const elapsedSeconds = (now - msgTime) / 1000;

    if (msgTime > 0 && elapsedSeconds > 120) {
      showInsToast("已发送超过 2 分钟，无法撤回该消息");
      return;
    }

    const timeStr = `${new Date().getHours().toString().padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")}`;
    chatMessages[idx] = {
      role: "notice",
      noticeType: "user_recall",
      content: "你撤回了一条消息",
      recalledContent: targetMsg.content,
      time: timeStr,
      timestamp: Date.now(),
    };

    saveChatMessages(activeCharInfo.name, chatMessages);
    updateActiveChatListSummary(
      activeCharInfo.name,
      "[撤回了一条消息]",
      timeStr,
    );

    renderChatRoomView(container);
    showInsToast("已撤回消息");
  } else if (action === "favorite") {
    let favorites = JSON.parse(
      localStorage.getItem("mini_chat_favorites") || "[]",
    );
    favorites.unshift({
      id: `fav-${Date.now()}`,
      charName: activeCharInfo.name,
      role: targetMsg.role,
      sender: senderName,
      content: targetMsg.content || `[${targetMsg.cardType}]`,
      translation: targetMsg.translation || "",
      time: targetMsg.time || "",
      favAt: new Date().toISOString(),
    });
    localStorage.setItem("mini_chat_favorites", JSON.stringify(favorites));
    showInsToast("已收藏该消息（收藏展示页面暂未开放）");
  } else if (action === "multiselect") {
    isMultiSelectMode = true;
    selectedMsgIndices.clear();
    selectedMsgIndices.add(idx);
    renderChatRoomView(container);
  }
}

// ════════════════════ 11. 设置绑定 ════════════════════
function bindSettingsEvents(roomEl, container) {
  const closeBtn = roomEl.querySelector("#btn-close-char-settings");
  if (closeBtn) {
    closeBtn.onclick = () => {
      isSettingsOpen = false;
      renderChatRoomView(container);
    };
  }

  // ✨ 核心修复 1：自主换头像开关状态即时同步到内存与持久化
  const autoAvatarToggle = roomEl.querySelector("#toggle-auto-avatar-change");
  const autoAvatarWrap = roomEl.querySelector("#wrap-auto-avatar-controls");
  if (autoAvatarToggle && autoAvatarWrap) {
    autoAvatarToggle.onchange = (e) => {
      const isChecked = e.target.checked;
      autoAvatarWrap.style.display = isChecked ? "flex" : "none";
      activeCharInfo.autoChangeAvatar = isChecked;
      updateFullCharData({
        name: activeCharInfo.name,
        autoChangeAvatar: isChecked,
      });
    };
  }

    // ✨ 打开美化定制独立内置子页面
  const openChatThemeBtn = roomEl.querySelector('#btn-open-chat-theme-subview');
  if (openChatThemeBtn) {
    openChatThemeBtn.onclick = () => {
      isChatThemeOpen = true;
      renderChatRoomView(container);
    };
  }

   // ✨ 自主换备注开关即时同步
  const autoRemarkToggle = roomEl.querySelector(
    "#toggle-auto-remark-change",
  );
  if (autoRemarkToggle) {
    autoRemarkToggle.onchange = (e) => {
      activeCharInfo.autoChangeRemark = e.target.checked;
      updateFullCharData({
        name: activeCharInfo.name,
        autoChangeRemark: e.target.checked,
      });
    };
  }

  // ✨ 语音系统开关显隐控制
  const voiceEnableToggle = roomEl.querySelector("#toggle-char-voice-enable");
  const voiceSettingsWrap = roomEl.querySelector("#wrap-char-voice-settings");
  if (voiceEnableToggle && voiceSettingsWrap) {
    voiceEnableToggle.onchange = (e) => {
      voiceSettingsWrap.style.display = e.target.checked ? "flex" : "none";
      activeCharInfo.voiceEnabled = e.target.checked;
      updateFullCharData({
        name: activeCharInfo.name,
        voiceEnabled: e.target.checked,
      });
    };
  }

  // 语音来源切换 (全局 vs 独立定制)
  roomEl.querySelectorAll("[data-vsource]").forEach((btn) => {
    btn.onclick = () => {
      const source = btn.getAttribute("data-vsource");
      activeCharInfo.voiceSource = source;
      updateFullCharData({ name: activeCharInfo.name, voiceSource: source });

      roomEl.querySelectorAll("[data-vsource]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const globalDesc = roomEl.querySelector("#voice-source-global-desc");
      const customPane = roomEl.querySelector("#voice-source-custom-pane");
      if (globalDesc) globalDesc.style.display = source === "global" ? "block" : "none";
      if (customPane) customPane.style.display = source === "custom" ? "flex" : "none";
    };
  });

  // 独立语音服务商切换
  const customPlatformSelect = roomEl.querySelector("#char-voice-custom-platform");
  const customGroupIdWrap = roomEl.querySelector("#wrap-custom-groupid");
  if (customPlatformSelect && customGroupIdWrap) {
    customPlatformSelect.onchange = (e) => {
      customGroupIdWrap.style.display = e.target.value === "minimax" ? "flex" : "none";
    };
  }

  // ✨ 打开专属头像库弹窗
  const openAvatarVaultBtn = roomEl.querySelector("#btn-open-avatar-vault");
  if (openAvatarVaultBtn) {
    openAvatarVaultBtn.onclick = () => {
      // 暂存当前设置表单数据
      const remarkVal =
        roomEl.querySelector("#input-char-remark")?.value.trim() || "";
      const enableTrans =
        roomEl.querySelector("#toggle-translation-switch")?.checked ||
        false;
      const langVal =
        roomEl.querySelector("#select-char-lang")?.value || "中文";
      const timePerceptionVal =
        roomEl.querySelector("#toggle-time-perception")?.checked !== false;
      const timezoneVal =
        roomEl.querySelector("#select-char-timezone")?.value ||
        "Asia/Tokyo";
      const autoAvatarVal =
        roomEl.querySelector("#toggle-auto-avatar-change")?.checked ||
        false;
      const darkroomAutoVal =
        roomEl.querySelector("#toggle-darkroom-autorefresh")?.checked ||
        false;

      activeCharInfo.remark = remarkVal;
      activeCharInfo.enableTranslation = enableTrans;
      activeCharInfo.targetLang = langVal;
      activeCharInfo.timePerceptionEnabled = timePerceptionVal;
      activeCharInfo.perceivedTimezone = timezoneVal;
      activeCharInfo.autoChangeAvatar = autoAvatarVal;
      activeCharInfo.darkroomAutoRefresh = darkroomAutoVal;
      updateFullCharData(activeCharInfo);

      isAvatarVaultOpen = true;
      renderChatRoomView(container);
    };
  }

  const addScheduleBtn = roomEl.querySelector("#btn-add-schedule-item");
  if (addScheduleBtn) {
    addScheduleBtn.onclick = () => {
      if (!activeCharInfo.schedules) activeCharInfo.schedules = [];
      activeCharInfo.schedules.push({ time: "", text: "" });
      renderChatRoomView(container);
    };
  }

  roomEl.querySelectorAll(".btn-del-schedule").forEach((btn) => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      activeCharInfo.schedules.splice(idx, 1);
      renderChatRoomView(container);
    };
  });

  roomEl.querySelectorAll(".btn-del-bg").forEach((btn) => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      activeCharInfo.backgroundActivities.splice(idx, 1);
      renderChatRoomView(container);
    };
  });

  const triggerBgBtn = roomEl.querySelector("#btn-trigger-bg-activity");
  if (triggerBgBtn) {
    triggerBgBtn.onclick = async () => {
      triggerBgBtn.disabled = true;
      triggerBgBtn.textContent = "感知中...";
      await generateBackgroundActivity();
      renderChatRoomView(container);
    };
  }

  const addManualMemBtn = roomEl.querySelector("#btn-add-manual-memory");
  const manualMemInput = roomEl.querySelector("#input-manual-memory");
  const manualMemTypeInput = roomEl.querySelector(
    "#input-manual-memory-type",
  );
  if (addManualMemBtn && manualMemInput) {
    const handleAddMem = () => {
      const text = manualMemInput.value.trim();
      const type = manualMemTypeInput?.value.trim() || "专属设定";
      if (!text) return;
      saveUnifiedCharMemory(activeCharInfo.name, text, type);
      manualMemInput.value = "";
      renderChatRoomView(container);
      showInsToast("已存入专属记忆库");
    };
    addManualMemBtn.onclick = handleAddMem;
    manualMemInput.onkeydown = (e) => {
      if (e.key === "Enter") handleAddMem();
    };
  }

  roomEl.querySelectorAll(".btn-del-memory").forEach((btn) => {
    btn.onclick = (e) => {
      const memId = e.currentTarget.getAttribute("data-mem-id");
      const memContent = e.currentTarget.getAttribute("data-mem-content");
      deleteUnifiedCharMemory(activeCharInfo.name, memId || memContent);
      renderChatRoomView(container);
      showInsToast("已删除该条记忆");
    };
  });

  // ✨ 记忆记录开关显隐控制与即时暂存
  const autoExtractMemToggle = roomEl.querySelector(
    "#toggle-auto-extract-mem",
  );
  const extractTurnWrap = roomEl.querySelector(
    "#wrap-extract-turn-interval",
  );
  const extractTurnRange = roomEl.querySelector(
    "#range-extract-turn-interval",
  );
  const extractTurnLabel = roomEl.querySelector(
    "#label-extract-turn-val",
  );

  if (autoExtractMemToggle && extractTurnWrap) {
    autoExtractMemToggle.onchange = (e) => {
      extractTurnWrap.style.display = e.target.checked ? "flex" : "none";
      activeCharInfo.autoExtractMemory = e.target.checked;
      updateFullCharData({
        name: activeCharInfo.name,
        autoExtractMemory: e.target.checked,
      });
    };
  }

  // ✨ 滑动拉条实时更新数值显示与暂存
  if (extractTurnRange && extractTurnLabel) {
    extractTurnRange.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      extractTurnLabel.textContent = `${val} 轮 (进度: ${activeCharInfo.currentTurnCounter || 0}/${val})`;
      activeCharInfo.autoExtractTurnInterval = val;
      updateFullCharData({
        name: activeCharInfo.name,
        autoExtractTurnInterval: val,
      });
    };
  }

  // ✨ 后台活动开关显隐控制与即时暂存
  const bgActivityToggle = roomEl.querySelector("#toggle-bg-auto-activity");
  const bgActivityWrap = roomEl.querySelector("#wrap-bg-activity-interval");
  if (bgActivityToggle && bgActivityWrap) {
    bgActivityToggle.onchange = (e) => {
      bgActivityWrap.style.display = e.target.checked ? "flex" : "none";
      activeCharInfo.bgAutoActivity = e.target.checked;
      updateFullCharData({
        name: activeCharInfo.name,
        bgAutoActivity: e.target.checked,
      });
      restartBgActivityAutoTimer();
    };
  }

  // ✨ 记忆记录：手动即时提取记忆
  const manualExtractBtn = roomEl.querySelector(
    "#btn-manual-extract-memories",
  );
  if (manualExtractBtn) {
    manualExtractBtn.onclick = async () => {
      if (chatMessages.length === 0) {
        showInsToast("暂无对话记录可供提炼");
        return;
      }
      manualExtractBtn.disabled = true;
      manualExtractBtn.textContent = "AI 提炼中...";

      await summarizeConversationMemories();

      manualExtractBtn.disabled = false;
      manualExtractBtn.textContent = "立即手动提取记忆";

      refreshSettingsMemorySection(roomEl, activeCharInfo.name);
    };
  }

  const saveBtn = roomEl.querySelector("#btn-save-char-settings");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const remarkVal =
        roomEl.querySelector("#input-char-remark")?.value.trim() || "";
      const enableTrans =
        roomEl.querySelector("#toggle-translation-switch")?.checked ||
        false;
      const langVal =
        roomEl.querySelector("#select-char-lang")?.value || "中文";
      const timePerceptionVal =
        roomEl.querySelector("#toggle-time-perception")?.checked !== false;
      const autoRemarkVal =
        roomEl.querySelector("#toggle-auto-remark-change")?.checked ||
        false;
      const timezoneVal =
        roomEl.querySelector("#select-char-timezone")?.value ||
        "Asia/Tokyo";

      const darkroomAutoVal =
        roomEl.querySelector("#toggle-darkroom-autorefresh")?.checked ||
        false;
      const darkroomIntervalVal = parseInt(
        roomEl.querySelector("#select-darkroom-interval")?.value || 60,
        10,
      );
      const autoAvatarVal =
        roomEl.querySelector("#toggle-auto-avatar-change")?.checked ||
        false;

      // ✨ 收集专属语音系统配置
      const voiceEnabledVal =
        roomEl.querySelector("#toggle-char-voice-enable")?.checked || false;
      const voiceSourceVal = activeCharInfo.voiceSource || "global";
      const voicePlatformVal =
        roomEl.querySelector("#char-voice-custom-platform")?.value || "minimax";
      const voiceApiKeyVal =
        roomEl.querySelector("#char-voice-custom-apikey")?.value.trim() || "";
      const voiceGroupIdVal =
        roomEl.querySelector("#char-voice-custom-groupid")?.value.trim() || "";
      const voiceVoiceIdVal =
        roomEl.querySelector("#char-voice-custom-voiceid")?.value.trim() || "female-yujie";

      const scheduleRows = roomEl.querySelectorAll(
        "#ins-schedule-container .ins-schedule-item",
      );
      const updatedSchedules = [];
      scheduleRows.forEach((row) => {
        const t =
          row.querySelector(".ins-schedule-time")?.value.trim() || "";
        const x =
          row.querySelector(".ins-schedule-text")?.value.trim() || "";
        if (t || x) updatedSchedules.push({ time: t, text: x });
      });

      const autoExtractMemVal =
        roomEl.querySelector("#toggle-auto-extract-mem")?.checked !== false;
      const extractTurnVal = parseInt(
        roomEl.querySelector("#range-extract-turn-interval")?.value ||
          activeCharInfo.autoExtractTurnInterval ||
          20,
        10,
      );

      const bgAutoVal =
        roomEl.querySelector("#toggle-bg-auto-activity")?.checked || false;
      const bgIntervalVal = parseInt(
        roomEl.querySelector("#select-bg-activity-interval")?.value || 45,
        10,
      );

      activeCharInfo.remark = remarkVal;
      activeCharInfo.enableTranslation = enableTrans;
      activeCharInfo.targetLang = langVal;
      activeCharInfo.timePerceptionEnabled = timePerceptionVal;
      activeCharInfo.perceivedTimezone = timezoneVal;
      activeCharInfo.darkroomAutoRefresh = darkroomAutoVal;
      activeCharInfo.darkroomIntervalMinutes = darkroomIntervalVal;
      activeCharInfo.autoChangeAvatar = autoAvatarVal;
      activeCharInfo.autoChangeRemark = autoRemarkVal;
      activeCharInfo.autoExtractMemory = autoExtractMemVal;
      activeCharInfo.autoExtractTurnInterval = extractTurnVal;
      activeCharInfo.bgAutoActivity = bgAutoVal;
      activeCharInfo.bgActivityIntervalMinutes = bgIntervalVal;
      activeCharInfo.voiceEnabled = voiceEnabledVal;
      activeCharInfo.voiceSource = voiceSourceVal;
      activeCharInfo.voiceCustomPlatform = voicePlatformVal;
      activeCharInfo.voiceCustomApiKey = voiceApiKeyVal;
      activeCharInfo.voiceCustomGroupId = voiceGroupIdVal;
      activeCharInfo.voiceCustomVoiceId = voiceVoiceIdVal;
      activeCharInfo.schedules = updatedSchedules;

      // 双向写入全局数据库
      updateFullCharData(activeCharInfo);

      const safeChar = encodeURIComponent(
        activeCharInfo.name || "default",
      );
      localStorage.setItem(
        `mini_char_auto_avatar_${safeChar}`,
        autoAvatarVal ? "true" : "false",
      );

      restartDarkroomAutoTimer();
      restartBgActivityAutoTimer();

      isSettingsOpen = false;
      showInsToast("设置已保存");
      renderChatRoomView(container);
    };
  }

  const clearHistoryBtn = roomEl.querySelector("#btn-settings-clear-history");
  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      const confirmClear = window.confirm(
        `确定要清空与【${activeCharInfo.name}】的全部聊天记录吗？\n\n注意：此操作不可恢复，角色的记忆库与日程档案将保留。`,
      );
      if (confirmClear) {
        chatMessages = [];
        saveChatMessages(activeCharInfo.name, chatMessages);
        updateActiveChatListSummary(activeCharInfo.name, "[已清空对话]", "");
        isSettingsOpen = false;
        renderChatRoomView(container);
        showInsToast("聊天记录已全部清空");
      }
    };
  }
}

// ════════════════════ 12. 后台动向与记忆提炼 ════════════════════
async function generateBackgroundActivity(
  isAutoDarkroom = false,
  isAutonomousTimer = false,
) {
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );
  const fullChar = getFullCharData(activeCharInfo?.name) || activeCharInfo;
  const charName = fullChar.name;
  const tzInfo = getCharPerceivedTimeInfo(
    fullChar.perceivedTimezone || "Asia/Tokyo",
  );
  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const activeUserName =
    localStorage.getItem("mini_current_active_user") ||
    userPersonasFull[0]?.name ||
    "用户";
  const currentUserObj =
    userPersonasFull.find((u) => u.name === activeUserName) || {};

  const targetLang = fullChar.targetLang || "中文";
  const needTranslation = fullChar.enableTranslation && targetLang !== "中文";

  // 读取最近的聊天上下文与记忆
  const allMemories = getAllAggregatedMemories(charName);
  const memoryBrief = allMemories
    .slice(0, 5)
    .map((m) => `- ${m.content}`)
    .join("\n");
  const recentMsgs = chatMessages
    .filter((m) => m.role !== "notice")
    .slice(-6)
    .map(
      (m) => `${m.role === "user" ? activeUserName : charName}: ${m.content}`,
    )
    .join("\n");

  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    const fallbackText =
      targetLang === "日语"
        ? `スタジオで個人練終わって、煙草吸いながらスマホ見てる。`
        : `刚忙完手头的事，喝了口水靠在椅子上翻看手机。`;

    activeCharInfo.backgroundActivities =
      activeCharInfo.backgroundActivities || [];
    activeCharInfo.backgroundActivities.unshift({
      time: tzInfo.timeStr,
      text: fallbackText,
    });
    updateFullCharData(activeCharInfo);
    McpGateway.saveCharDarkroomNote(charName, fallbackText);
    return;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);

  // ════════ ✨ 深度人设锚定的后台活动 Prompt ════════
  const prompt = `【角色后台独立生活与自主行动推演】
你是真实生活在现实世界中的独立人类【${charName}】。你不是 AI，你有自己的生活轨迹、职业、脾气与性格！

════════ 📌 你的绝对人设档案 ════════
- 姓名：${charName}
- 母语语言：【${targetLang}】
- 职业与真实背景：${fullChar.occupation || "日常"}
- 居住地/生活圈：${fullChar.residence || fullChar.birthplace || "未公开"}
- 潜意识语言风格：${fullChar.catchphrase || "自然随性"}
- 喜好与厌恶雷点：${fullChar.likesAndDislikes || "无"}
- 性格特征与内在深度（包括占有欲/吃醋/控制欲/独立性）：
${fullChar.detailedInfo || "有独立生活与主见"}

════════ ⏰ 当前物理现实时空 ════════
- 确切时间与作息状态：【${tzInfo.fullDateStr}】
- 你的环境与生理状态【完全由现实时间 ${tzInfo.timeStr} (${tzInfo.period}) 决定】！

════════ 👥 你与【${activeUserName}】的近期关联 ════════
- 对方情况：${currentUserObj.occupation || "日常"} | 偏好：${currentUserObj.likesAndDislikes || "暂无"}
【近期聊天摘要】：
${recentMsgs || "(近期暂无深入对话)"}
【专属记忆默契】：
${memoryBrief || "(基础相处状态)"}

════════ 🎬 自主行动决策要求 ════════
离开聊天软件这段时间里，你一直在现实中忙自己的事。请根据你的【性格、职业背景、当前时段作息】以及【与对方近期的相处氛围】，自主选择：
选项 A：【记录一条独立生活动态 (post_moment)】——记录自己的工作进度、排练心得、生活随感、独处抽烟、喝咖啡等（不刻意讨好，展示真实的独立生活切片）；
选项 B：【主动给 ${activeUserName} 发一条即时短信 (send_message)】——如果你此刻真实地想到了对方、想吐槽刚刚遇到的事、看到某个景象想分享、或是主动质问/闲聊。

要求：
1. 绝对贴合人设，以生活化日常表达为主，严禁机械重复塞口癖！严禁任何 AI 客套、严禁无脑顺从；
2. 严禁任何动作括号旁白；
3. 必须输出严格纯 JSON 格式：
{
  "inner_thought": "【心理推演】：我此刻在忙什么、情绪如何、为何选择发动态或主动找对方",
  "actionType": "send_message", // 或 "post_moment"
  "content": "${targetLang === "日语" ? "纯正地道日语内容" : "中文内容"}",
  "trans": "${needTranslation ? "对应的自然中文翻译" : ""}"
}
`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
    });

    let actionObj = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) actionObj = JSON.parse(match[0]);
    } catch (e) {}

    const textContent = sanitizeOnlineChatReply(actionObj?.content || raw);
    const transContent = sanitizeOnlineChatReply(actionObj?.trans || "");

    if (textContent) {
      // 1. 记录到后台活动列表与 McpGateway 暗房记忆库
      if (!activeCharInfo.backgroundActivities)
        activeCharInfo.backgroundActivities = [];
      activeCharInfo.backgroundActivities.unshift({
        time: tzInfo.timeStr,
        text: textContent,
      });
      updateFullCharData(activeCharInfo);
      McpGateway.saveCharDarkroomNote(charName, textContent);

      // 2. ✨ 若主动发短信，局部追加气泡（0 全屏闪烁）
      if (actionObj?.actionType === "send_message") {
        const newMsgObj = {
          role: "assistant",
          content: textContent,
          translation: needTranslation ? transContent : "",
          time: tzInfo.timeStr,
          timestamp: Date.now(),
          quote: null,
        };
        chatMessages.push(newMsgObj);
        saveChatMessages(charName, chatMessages);
        updateActiveChatListSummary(charName, textContent, tzInfo.timeStr);
        showInsToast(`【${charName}】主动发来了一条新消息`);

        const scrollArea = document.querySelector("#chat-messages-scroll-area");
        if (scrollArea) {
          const temp = document.createElement("div");
          temp.innerHTML = renderMessagesHtml([newMsgObj]);
          if (temp.firstElementChild) {
            scrollArea.appendChild(temp.firstElementChild);
            setTimeout(() => {
              scrollArea.scrollTop = scrollArea.scrollHeight;
            }, 30);
          }
        }
      } else {
        // 若为记录生活动态，仅在设置页打开时局部更新动向列表
        const bgContainer = document.querySelector(
          "#ins-bg-activity-container",
        );
        if (bgContainer && activeCharInfo.backgroundActivities) {
          bgContainer.innerHTML = activeCharInfo.backgroundActivities
            .map(
              (bg, bgIdx) => `
            <div class="ins-bg-item">
              <span class="ins-bg-time">${bg.time || ""}</span>
              <span class="ins-bg-text">${escapeHtml(bg.text || "")}</span>
              <button class="ins-item-del-btn btn-del-bg" data-idx="${bgIdx}">×</button>
            </div>
          `,
            )
            .join("");
        }
      }
    }
  } catch (e) {
    console.warn("Generate background activity error:", e);
  }
}

async function summarizeConversationMemories() {
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );

  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    showInsToast("请先在「API」板块配置 API Key");
    return 0;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
  const validMsgs = chatMessages.filter((m) => m.role !== "notice");
  if (validMsgs.length === 0) return 0;

  const contextDialog = validMsgs
    .slice(-25)
    .map(
      (m) =>
        `${m.role === "user" ? "User" : activeCharInfo.name}: ${m.content || `[${m.cardType || "卡片"}]`}`,
    )
    .join("\n");

  const prompt = `
你是一个专业的角色记忆提炼引擎。
请仔细分析以下对话，提炼出角色【${activeCharInfo.name}】对 User 的重要偏好习惯、双方经历的关键事件、特殊约定或情感变化要点（1~3条）。

提取准则：
1. 语言简练客观（每条15~35字），保留具体细节（如爱吃的食物、去过的地方、约定、忌口）；
2. 必须且仅输出纯 JSON 字符串数组格式，例如：
["User 喜欢喝热拿铁，反感被命令", "两人约定好下次见面一起去吃关东煮"]
严禁任何 Markdown 标签、不要代码块外壳、不要多余解释！

【对话内容】：
${contextDialog}
`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let extractedList = [];

    // 1. 尝试标准 JSON 提取
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) extractedList = parsed;
      } catch (e) {}
    }

    // 2. 降级：按换行/序号提取（防止模型输出 - 或 1. 导致提取漏掉）
    if (extractedList.length === 0 && raw.trim()) {
      const lines = raw
        .split(/\n+/)
        .map((l) =>
          l
            .replace(/^[-*•\d.、\s]+/, "")
            .replace(/^["'“”]/, "")
            .replace(/["'“”]$/, "")
            .trim(),
        )
        .filter((l) => l.length > 5 && !l.includes("JSON"));
      if (lines.length > 0) extractedList = lines.slice(0, 3);
    }

    if (extractedList.length > 0) {
      let savedCount = 0;
      extractedList.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          const res = saveUnifiedCharMemory(
            activeCharInfo.name,
            item.trim(),
            "对话提炼",
          );
          if (res) savedCount++;
        }
      });

      showInsToast(`🎉 已成功提炼 ${savedCount} 条记忆并同步至沙盒库`);
      return savedCount;
    }
  } catch (e) {
    console.warn("Memory summarize error:", e);
  }

  showInsToast("本轮对话未发现需沉淀的新记忆");
  return 0;
}

// ════════════════════ 13. 核心生成管线（深度融合顶级活人感架构） ════════════════════
function handleUserSendMessageOnly(userText, container) {
  const charName = activeCharInfo.name;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const newMsg = {
    role: "user",
    content: userText,
    time: timeStr,
    timestamp: now.getTime(),
  };

  if (quotedMessage) {
    newMsg.quote = { ...quotedMessage };
    quotedMessage = null;
    const quoteContainer = document.querySelector("#chat-quote-bar-container");
    if (quoteContainer) quoteContainer.innerHTML = "";
  }

  chatMessages.push(newMsg);
  saveChatMessages(charName, chatMessages);
  updateActiveChatListSummary(charName, userText, timeStr);

  // ✨ 核心修复：局部刷新消息流 DOM，绝不重建全屏，0 闪屏
  const scrollArea = document.querySelector("#chat-messages-scroll-area");
  if (scrollArea) {
    scrollArea.innerHTML = `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 实时交互通道</div>` + renderMessagesHtml(chatMessages);
    setTimeout(() => { scrollArea.scrollTop = scrollArea.scrollHeight; }, 20);
  } else {
    renderChatRoomView(container);
  }
}

/**
 * 核心引擎：深度人设锚定、物理空间隔离、真实情绪主见与动态多气泡输出
 */
async function handleSingleTurnReply(container, directionPrompt = "") {
  isGenerating = true;
  renderChatRoomView(container);

  const charName = activeCharInfo.name;
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );

  // 1. 获取对话对象（User）画像
  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const activeUserName =
    localStorage.getItem("mini_current_active_user") ||
    userPersonasFull[0]?.name ||
    "用户";
  const currentUserObj =
    userPersonasFull.find((u) => u.name === activeUserName) || {};

  // 2. 获取 Char 完整档案与记忆/文档/时区
  const fullChar = getFullCharData(charName) || activeCharInfo;
  const allMemories = getAllAggregatedMemories(charName);
  const darkroom = McpGateway.getCharDarkroom(charName);
  const weather = McpGateway.getCharRelationshipWeather(charName);
  const echoContext = EchoVault.getFormattedPromptContext(charName);
  const tzInfo = getCharPerceivedTimeInfo(
    fullChar.perceivedTimezone || "Asia/Tokyo",
  );

  // 读取投喂文档
  const allDocs = JSON.parse(
    localStorage.getItem("mini_mcp_documents") || "[]",
  );
  const relevantDocs = allDocs.filter(
    (d) =>
      d.active && (d.charTarget === "__all__" || d.charTarget === charName),
  );
  const docPromptSection =
    relevantDocs.length > 0
      ? relevantDocs
          .map(
            (d) => `【知识库设定 · ${d.title}】:\n${d.content.slice(0, 3000)}`,
          )
          .join("\n\n")
      : "";

  // ✨ 核心修复：定义 avatarPromptSection 变量，读取头像库备选与情头
  const avatarLib = getCharAvatarLibrary(charName);
  let avatarPromptSection = "";
  if (activeCharInfo.autoChangeAvatar) {
    const charAvList =
      avatarLib.charAvatars.length > 0
        ? avatarLib.charAvatars
            .map((a) => `[ID: ${a.id}, 标题: "${a.title}"]`)
            .join("、")
        : "(库中暂无单独Char头像)";
    const coupleList =
      avatarLib.couplePairs.length > 0
        ? avatarLib.couplePairs
            .map((cp) => `[ID: ${cp.id}, 标题: "${cp.title}"]`)
            .join("、")
        : "(暂无情头对)";
    avatarPromptSection = `\n════════ 🖼️ 专属头像库与图片自动识别入库 ════════
1. 【主动换头像】：你可以根据当下的心情、剧情发展、恋爱互动或对方要求，从现有图库中挑选换上头像！
   【Char 备选库】：${charAvList} | 【情头对】：${coupleList}
   若本次要换头像，请在 avatarAction 中填写目标 ID（如 {"type":"char","id":"cav-xxx"} 或 {"type":"couple","id":"cp-xxx"}）；不换填 null。
2. 【发图自动识别与富有新意的人设命名】：如果对方在近期消息中发送了图片/照片，请你结合上下文、对方说的话以及【你当下的真实情绪与想法】进行智能识别：
   - 若为单人头像：判断属于【Char 形象 (target: "char")】还是【User 形象 (target: "user")】；
   - 若为情头：归类为【情侣头像 (target: "couple")】；
   - 命名铁律（必须有新意、符合你的性格与当下想法）：
     * 严禁起“新头像/自拍照/可爱头像”等泛泛的名字！
     * 必须从你的角色第一人称视角出发，结合当前你们聊的情景或你的心境来起名！（例如神木凌遥视角可以命名为：“某人试图转移话题发的猫系自拍”、“你给我选的舞台暗黑风”、“准备一起换的微醺情头”、“抓包挑食时换的形象”等）；
   - 若只是普通风景/美食等非头像生活照：则 isAvatar 设为 false。
   请在 avatarAutoCollect 字段返回识别与新颖命名结果！`;
  }

  const targetLang = fullChar.targetLang || activeCharInfo.targetLang || "中文";
  const needTranslation =
    activeCharInfo.enableTranslation && targetLang !== "中文";

  // 格式化记忆清单
  const memoryPromptSection =
    allMemories.length > 0
      ? allMemories
          .map((m, idx) => `${idx + 1}. [${m.anchorType}]: ${m.content}`)
          .join("\n")
      : "(暂无历史特殊事件，基于当前基础人设相处)";

  // 判断最近一条消息是否包含线下场景卡片
  const isCurrentlyOffline =
    chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1].cardType === "offline";

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
  - 【极其重要·口癖降频铁律】：口癖、标志性叹词或特定习惯（如抽细支烟、玉子烧等）只是你的潜意识习惯，【严禁每轮对话都机械重复塞一句口癖】！大部分时间必须像现实生活中的普通真人一样正常自然地打字聊天，只在情绪真正被触动或特定话题时偶尔、极低频地自然流露！
3. 【场景定性与物理隔离】：
${
  isCurrentlyOffline
    ? `
   - 当前处于【线下模式】，你们同处一室（${chatMessages[chatMessages.length - 1].locationName || "现场"}），允许使用适度面对面近距离对谈与神态交互。
`
    : `
   - 你们此刻【不在同一物理空间】！这是纯粹的线上即时文字聊天。
   - ❌ 绝对禁止虚构任何线下物理动作描写（严禁出现“我走过去”“我摸摸你的头”“我抱住你”等跨时空动作）！
   - ✅ 允许：文字吐槽、表达当下自己的状态（“刚放下鼓槌”“累瘫在沙发上”）、表达对下次见面的期待。
   - 严禁任何动作括号旁白（如 (笑)、（叹气）等），必须是打在键盘上的纯短信文本！
`
}

════════ 📌 你的完整人设档案 ════════
- 角色姓名：${charName}
- 母语语言：【${targetLang}】
- 性别：${fullChar.gender || "保密"} ${fullChar.gender === "男" || fullChar.gender === "male" ? "(男性真实思维与措辞习惯，绝无女性化娇喘/无脑撒娇)" : ""}
- 职业与身份：${fullChar.occupation || "未公开"}
- 居住地/生活圈：${fullChar.residence || fullChar.birthplace || "未公开"}
- 潜意识语言习惯 (仅偶尔流露，绝不机械重复)：${fullChar.catchphrase || "平实自然的生活口语"}
- 喜好与厌恶雷点：${fullChar.likesAndDislikes || "无"}
- 性格内核与内在特质（占有欲/吃醋/控制欲/情感深浅）：
${fullChar.detailedInfo || "有血有肉有主见的独立人类"}

# 对话对象【${activeUserName}】档案（你正在聊天的对象）
- 名字：${activeUserName}
- 对方职业/身份：${currentUserObj.occupation || '日常生活'}
- 对方喜恶偏好（潜意识尊重）：${currentUserObj.likesAndDislikes || '暂无'}
- 对方当前头像状态：【${currentUserObj.avatarUrl ? '对方当前已换上了最新头像，不要再说对方还在找头像' : '默认头像'}】
- 两人羁绊状态：${weather.status} (${weather.weatherText})

════════ ⏰ 现实时空锚点 ════════
- 现实确切时间：【${tzInfo.fullDateStr}】
- 当前时段与生活状态：【${tzInfo.period}】
- 你的环境与生理状态【完全由现实时间 ${tzInfo.timeStr} (${tzInfo.period}) 决定】！严禁停留在过去的旧时间语境，根据现在时刻进行自然交流。

════════ 🧠 记忆库与世界观 ════════
【过往真实经历与专属记忆】：
${memoryPromptSection}
${echoContext ? `\n${echoContext}` : ""}
${docPromptSection ? `\n${docPromptSection}` : ""}
${darkroom.length > 0 ? `\n【你当前的内心潜思】:\n` + darkroom.map((d) => `- "${d.reflection}"`).join("\n") : ""}
${fullChar.schedules && fullChar.schedules.length > 0 ? `\n【你今日的日程】:\n` + fullChar.schedules.map((s) => `[${s.time}] ${s.text}`).join("\n") : ""}
${avatarPromptSection}

${
  activeCharInfo.autoChangeRemark
    ? `
════════ 🏷️ 自主改备注权限（你拥有自主审视与修改备注的权力） ════════
对方目前在手机上给你设置的聊天备注是：【${activeCharInfo.remark || charName}】。
你可以结合你的人设性格与当前对话氛围做出独立审视：
1. 【满意/暗爽】：如果备注让你满意，保持不改，但可在短信中自然流露出一丝得意、暗爽或调侃；
2. 【不满意/吃醋/嫌弃】：如果你觉得这个称呼生疏、难听、或想换成你喜欢的专属称呼（如“老公”、“哥”、“专属鼓手”等），可以在 remarkAction 中填写新备注名称，并在短信中做出吐槽或宣告！
`
    : ""
}

${
  directionPrompt
    ? `
════════ 🎬 导演微调导向（仅本次有效） ════════
本次回复微调建议为：“${directionPrompt}”。
【极其重要】：此导向必须【完全在你的角色性格骨架内被演绎】！
例如：傲娇/毒舌角色收到“温柔一点”的导向，表现为“嘴硬心软、别扭妥协、调侃式关心”，绝不崩人设变成毫无个性的无脑甜妹！
`
    : ""
}

════════ 💬 真实短信打字与多模态交互规范 ════════
1. 拆分为 2 到 4 条简短的消息气泡（一句发完紧接着下一句，模拟打字连发）。
2. 【照片与拍立得感知】：
   - 若对方发了【照片/模拟拍摄的照片】，你能够直接看清画面，请针对画面里的风景、食物、人物或氛围做出符合人设的自然点评或调侃；
   - 你也可以在需要分享自己所处场景时，主动发消息描述自己拍下的照片！
3. 在输出短信前，必须在 inner_thought 中先进行简短的心境推演（理清 ${activeUserName} 刚刚的话、我此刻真实情绪、决定如何回复），再输出 replies！

════════ 📋 结构化输出规范（纯 JSON） ════════
${
  needTranslation
    ? `
{
  "inner_thought": "【内心心理推演】：简述我此刻对 ${activeUserName} 这句话的真实态度与情绪反应（傲娇/吃醋/吐槽/关心）",
  "avatarAction": null,
  "remarkAction": null, // 改备注选填: { "newRemark": "新备注名", "thought": "修改原因" }，不改填 null
  "replies": [
    { "orig": "外语原文短消息1", "trans": "对应的精准中文口语翻译", "quote": null },
    { "orig": "外语原文短消息2", "trans": "对应的精准中文口语翻译", "quote": null }
  ],
  "extractedSchedule": null,
  "extractedMemory": null

    "avatarAction": null,
  "avatarAutoCollect": null, // 发图自动识别选填: { "isAvatar": true, "target": "char"|"user"|"couple", "title": "智能命名", "applyNow": false }，无图填 null
  "remarkAction": null,
}
`
    : `
{
  "inner_thought": "【内心心理推演】：简述我此刻对 ${activeUserName} 这句话的真实态度与情绪反应（傲娇/吃醋/吐槽/关心）",
  "avatarAction": null,
  "remarkAction": null, // 改备注选填: { "newRemark": "新备注名", "thought": "修改原因" }，不改填 null
  "replies": [
    { "orig": "中文短消息1", "trans": "", "quote": null },
    { "orig": "中文短消息2", "trans": "", "quote": null }
  ],
  "extractedSchedule": null,
  "extractedMemory": null
}
`
}
`;

  // 格式化 API 消息（全面支持 12 大富卡片与多模态交互）
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...chatMessages.map((m) => {
      if (m.role === "notice") {
        if (m.noticeType === "user_recall") {
          return {
            role: "user",
            content: `[系统事件: ${activeUserName} 刚刚撤回了一条消息]`,
          };
        }
        return { role: "system", content: `[提示: ${m.content}]` };
      }

                    let formattedContent = m.content || "";
      if (m.cardType === "image")
        formattedContent = `[用户向你发送了一张真实照片]`;
      else if (m.cardType === "sim_photo")
        formattedContent = `[用户向你发送了一张实时拍摄的照片（照片画面为）: "${m.photoDesc || m.content}"]（在你的真实认知中你清晰看得到这张照片的全部画面，请结合画面内容自然反应）`;
      else if (m.cardType === "voice")
        formattedContent = `[用户给你发了一条微信语音消息 (${m.durationSeconds || 3}秒)，说的是: "${m.content}"]（在你的认知中这是对方用声音跟你说的话，请自然做出回应）`;
      else if (m.cardType === "transfer")
        formattedContent = `[用户向你转账了 ¥${m.amount}，备注: "${m.content}"]`;
      else if (m.cardType === "gift")
        formattedContent = `[用户送了你一份礼物: 【${m.giftName}】，附言: "${m.content}"]`;
      else if (m.cardType === "location")
        formattedContent = `[用户向你共享了位置: 【${m.locationName}】]`;
      else if (m.cardType === "sticker")
        formattedContent = `[用户发送了表情包: 【${m.stickerName}】]`;
      else if (m.cardType === "call")
        formattedContent = `[与你进行了一次 ${m.callMode === "video" ? "视频通话" : "语音通话"}，时长: ${m.durationStr}]`;
      else if (m.cardType === "offline")
        formattedContent = `[切换为面对面线下相处模式，地点: 【${m.locationName}】，当前状态: "${m.content}"]`;

      return {
        role: m.role,
        content: m.quote
          ? `[引用了 ${m.quote.sender} 的话: "${m.quote.content}"] ${formattedContent}`
          : formattedContent,
      };
    }),
  ];

  let rawReply = "";
  if (apiConfig.apiKey && apiConfig.baseUrl) {
    const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
    const payload = {
      model: apiConfig.model || "deepseek-chat",
      messages: apiMessages,
      temperature: 0.85,
    };
    rawReply = await executeChatApiRequest(chatUrl, apiConfig.apiKey, payload);
  }

  const result = parseComprehensiveReply(rawReply, fullChar, needTranslation);

  // ✨ 核心 0：处理用户发送图片时的智能识别、自动分类入库与命名
  if (result.avatarAutoCollect && result.avatarAutoCollect.isAvatar) {
    const collect = result.avatarAutoCollect;
    const lastImageMsg = [...chatMessages]
      .reverse()
      .find((m) => m.role === "user" && m.cardType === "image" && m.mediaUrl);
    if (lastImageMsg && lastImageMsg.mediaUrl) {
      const lib = getCharAvatarLibrary(charName);
      const title = (collect.title || "新收录形象").trim();

            if (collect.target === 'user') {
        const isExist = lib.userAvatars.some(a => a.url === lastImageMsg.mediaUrl);
        if (!isExist) {
          lib.userAvatars.unshift({ id: `uav-${Date.now()}`, title: title, url: lastImageMsg.mediaUrl });
          saveCharAvatarLibrary(charName, lib);
          showInsToast(`已自动识别并收录至 User 头像库：「${title}」`);
        }
        // ✨ 只要识别为 User 头像，立即为 User 换上并同步所有档案
        syncUserAvatarToAllStores(activeUserName, lastImageMsg.mediaUrl);
        showInsToast(`【${charName}】已为你换上了新头像：「${title}」`);
      } else if (collect.target === "user") {
        const isExist = lib.userAvatars.some(
          (a) => a.url === lastImageMsg.mediaUrl,
        );
        if (!isExist) {
          lib.userAvatars.unshift({
            id: `uav-${Date.now()}`,
            title: title,
            url: lastImageMsg.mediaUrl,
          });
          saveCharAvatarLibrary(charName, lib);
          showInsToast(`已自动识别并收录至 User 头像库：「${title}」`);
        }
        if (collect.applyNow) {
          syncUserAvatarToAllStores(activeUserName, lastImageMsg.mediaUrl);
        }
      } else if (collect.target === "couple") {
        const isExist = lib.couplePairs.some(
          (cp) =>
            cp.charUrl === lastImageMsg.mediaUrl ||
            cp.userUrl === lastImageMsg.mediaUrl,
        );
        if (!isExist) {
          lib.couplePairs.unshift({
            id: `cp-${Date.now()}`,
            title: title,
            charUrl: lastImageMsg.mediaUrl,
            userUrl: lastImageMsg.mediaUrl,
          });
          saveCharAvatarLibrary(charName, lib);
          showInsToast(`已自动识别并收录至情侣头像库：「${title}」`);
        }
      }
    }
  }

  // ✨ 核心 1：处理 Char 自主换头像指令
  if (result.avatarAction && result.avatarAction.id) {
    const act = result.avatarAction;
    const lib = getCharAvatarLibrary(charName);
    if (act.type === "couple") {
      const pair = lib.couplePairs.find((p) => p.id === act.id);
      if (pair) {
        syncCharAvatarToAllStores(charName, pair.charUrl);
        syncUserAvatarToAllStores(activeUserName, pair.userUrl);
        showInsToast(`【${charName}】主动为你俩换上了情侣头像：${pair.title}`);
      }
    } else {
      const avatarItem = lib.charAvatars.find((a) => a.id === act.id);
      if (avatarItem) {
        syncCharAvatarToAllStores(charName, avatarItem.url);
        showInsToast(`【${charName}】自主更换了新头像：${avatarItem.title}`);
      }
    }
  }

  // ✨ 核心 2：处理 Char 自主修改备注指令（修复 roomEl 变量未定义卡死 Bug）
  if (result.remarkAction && result.remarkAction.newRemark) {
    const newR = result.remarkAction.newRemark.trim();
    if (newR && newR !== activeCharInfo.remark) {
      activeCharInfo.remark = newR;
      updateFullCharData(activeCharInfo);

      // ✨ 安全获取顶栏名字 DOM 节点并更新
      const headerNameEl = document.querySelector(".chat-header-name");
      if (headerNameEl) headerNameEl.textContent = `${newR} (${charName})`;

      showInsToast(`【${charName}】自主修改了备注：「${newR}」`);
    }
  }

  if (result.extractedMemory) {
    saveUnifiedCharMemory(charName, result.extractedMemory, "约定日程");
  }

  if (result.extractedSchedule && result.extractedSchedule.text) {
    const newSch = result.extractedSchedule;
    if (!activeCharInfo.schedules) activeCharInfo.schedules = [];
    const exists = activeCharInfo.schedules.some(
      (s) => s.text === newSch.text && s.time === newSch.time,
    );
    if (!exists) {
      activeCharInfo.schedules.push({
        time: newSch.time || "近期",
        text: newSch.text,
      });
      updateFullCharData(activeCharInfo);
      showInsToast(`已自动同步日程: [${newSch.time || "近期"}] ${newSch.text}`);
    }
  }

  isGenerating = false;
  const replyTimestamp = Date.now();

  result.bubbles.forEach((b) => {
    chatMessages.push({
      role: "assistant",
      content: b.orig,
      translation: needTranslation ? b.trans || "" : "",
      time: tzInfo.timeStr,
      timestamp: replyTimestamp,
      quote: b.quote || null,
    });
  });

   saveChatMessages(charName, chatMessages);
  const lastBubbleText = result.bubbles[result.bubbles.length - 1]?.orig || '...';
  updateActiveChatListSummary(charName, lastBubbleText, tzInfo.timeStr);

  // ✨ 核心修复：检查当前用户是否正处于聊天室界面
  const chatRoomEl = document.getElementById("chat-room-instance");
  const scrollArea = document.querySelector("#chat-messages-scroll-area");

  if (chatRoomEl && scrollArea) {
    // 用户正在聊天室中：局部平滑刷新消息流，不抢焦点不闪屏
    scrollArea.innerHTML =
      `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 实时交互通道</div>` +
      renderMessagesHtml(chatMessages);
    setTimeout(() => {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }, 30);
  } else {
    // ✨ 用户已切换去其他板块（如角色库/设置/User）：静默写入后台，绝不强行跳转切屏！
    console.log(`[Background Message Received] 【${charName}】回复完成，已静默存入历史，未打扰用户当前操作。`);
  }

  if (autoSavedNotice) {
    setTimeout(() => {
      showInsToast(autoSavedNotice);
    }, 300);
  }
}

// ════════════════════ 14. 超强容错解析器 (彻底杜绝 JSON 原文乱码) ════════════════════
function parseComprehensiveReply(rawReply, char, needTranslation = false) {
  const isJp = (char.targetLang || "中文") === "日语";
  const defaultFallback = {
    avatarAction: null,
    avatarAutoCollect: null,
    remarkAction: null,
    bubbles: [
      {
        orig:
          char.catchphrase ||
          (isJp ? "……ん、メッセージ届いてるよ。" : "在呢，消息收到了。"),
        trans: needTranslation && isJp ? "……嗯，收到你的消息了。" : "",
        quote: null,
      },
    ],
    extractedSchedule: null,
    extractedMemory: null,
  };

  if (!rawReply || !rawReply.trim()) return defaultFallback;

  try {
    // 1. 优先清洗剥离 ```json 和 ``` 外壳
    let cleanJsonStr = rawReply.replace(/```json/gi, "").replace(/```/g, "").trim();
    const objMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      let bubbles = [];

      if (Array.isArray(parsed.replies) && parsed.replies.length > 0) {
        bubbles = parsed.replies
          .map((r) => {
            let origText = sanitizeOnlineChatReply(
              r.orig || r.content || r.text || "",
            );
            let transText = sanitizeOnlineChatReply(
              r.trans || r.translation || "",
            );

            if (needTranslation && !transText) {
              const inlineTransMatch = origText.match(
                /^(.+?)[（(]([\u4e00-\u9fa5\s，。！？]+)[）)]$/,
              );
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
          })
          .filter((b) => Boolean(b.orig));
      }

      if (bubbles.length > 0) {
        return {
          avatarAction:
            parsed.avatarAction && parsed.avatarAction.id
              ? parsed.avatarAction
              : null,
          avatarAutoCollect:
            parsed.avatarAutoCollect && parsed.avatarAutoCollect.isAvatar
              ? parsed.avatarAutoCollect
              : null,
          remarkAction:
            parsed.remarkAction && parsed.remarkAction.newRemark
              ? parsed.remarkAction
              : null,
          bubbles: bubbles.slice(0, 4),
          extractedSchedule:
            parsed.extractedSchedule && parsed.extractedSchedule.text
              ? parsed.extractedSchedule
              : null,
          extractedMemory:
            parsed.extractedMemory &&
            typeof parsed.extractedMemory === "string"
              ? parsed.extractedMemory.trim()
              : null,
        };
      }
    }
  } catch (e) {}

  // 2. 降级：过滤掉可能泄露的 JSON 键值行，只提取真实对话文字
  const cleaned = sanitizeOnlineChatReply(rawReply)
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/\{[\s\S]*?"inner_thought"[\s\S]*?\}/gi, "");

  let lines = cleaned
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => {
      return (
        s &&
        !s.startsWith("{") &&
        !s.startsWith("}") &&
        !s.startsWith("```") &&
        !s.includes("inner_thought") &&
        !s.includes("avatarAction") &&
        !s.includes("remarkAction") &&
        !s.includes("extractedSchedule")
      );
    });

  let bubbles = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let matchPair = line.match(
      /^(.+?)(?:\s*[（(]|\s*[\/|]\s*|\s*——\s*)([\u4e00-\u9fa5].+?)[）)]?$/,
    );
    if (matchPair) {
      bubbles.push({
        orig: matchPair[1].trim(),
        trans: matchPair[2].trim(),
        quote: null,
      });
    } else if (
      needTranslation &&
      i + 1 < lines.length &&
      /[\u4e00-\u9fa5]/.test(lines[i + 1]) &&
      !/[\u4e00-\u9fa5]/.test(line)
    ) {
      bubbles.push({ orig: line, trans: lines[i + 1], quote: null });
      i++;
    } else {
      bubbles.push({ orig: line, trans: "", quote: null });
    }
  }

  return {
    avatarAction: null,
    avatarAutoCollect: null,
    remarkAction: null,
    bubbles: bubbles.slice(0, 4).length > 0 ? bubbles.slice(0, 4) : defaultFallback.bubbles,
    extractedSchedule: null,
    extractedMemory: null,
  };
}

function sanitizeOnlineChatReply(rawText) {
  if (!rawText) return "";
  return rawText
    .replace(/\*[^*]+\*/g, "")
    // 物理强力抹除开头的各种口癖傻笑 (ふふっ、呵呵、呵呵呵、クスクス等)
    .replace(/^(?:ふふっ[、，。\s…~]*|呵呵[、，。\s…~]*|呵呵呵[、，。\s…~]*|クスクス[、，。\s…~]*|フフッ[、，。\s…~]*)+/gi, "")
    .replace(
      /（[^）]*(?:看|笑|叹|走|想|低头|抬头|眼神|神情|动作|心里|沉默|坐|站|摸|抓|愣|眨|摇|息|声|目|手|指)[^）]*）/g,
      "",
    )
    .replace(
      /\([^)]*(?:smile|sigh|look|think|action|gaze|nod|laugh)[^)]*\)/gi,
      "",
    )
    .replace(/^["'“”‘’]/g, "")
    .replace(/["'“”‘’]$/g, "")
    .trim();
}

function showInsToast(msg) {
  const toast = document.getElementById("ins-chat-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
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
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.choices && data.choices[0]?.message?.content?.trim()) || "";
    }
  } catch (err) {
    console.warn("[Direct API blocked, using relay...]", err);
  }

  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(chatUrl)}`;
    const relayRes = await fetch(proxyUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (relayRes.ok) {
      const relayData = await relayRes.json();
      return (
        (relayData.choices && relayData.choices[0]?.message?.content?.trim()) ||
        ""
      );
    }
  } catch (e) {
    console.warn("[Relay failed]:", e);
  }
  return "";
}

function updateActiveChatListSummary(charName, lastMsg, timeStr) {
  let activeList = JSON.parse(
    localStorage.getItem("mini_active_chat_list") || "[]",
  );
  const target = activeList.find((c) => c.name === charName);
  if (target) {
    target.lastMsg = lastMsg;
    target.time = timeStr;
    localStorage.setItem("mini_active_chat_list", JSON.stringify(activeList));
  }
}

function scrollToBottom(roomEl) {
  const area = roomEl.querySelector("#chat-messages-scroll-area");
  if (area) {
    setTimeout(() => {
      area.scrollTop = area.scrollHeight;
    }, 40);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
