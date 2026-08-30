import { McpGateway } from "../utils/mcpGateway.js";
import { EchoVault } from "../utils/echoVault.js";
import { resolveApiEndpoints } from "./apiSettings.js";

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

// ════════════════════ 1. 记忆库全量聚合引擎 ════════════════════
function getChatStorageKey(charName) {
  return `mini_chat_dialog_history_${encodeURIComponent(charName || "default")}`;
}

function loadChatMessages(charName) {
  return JSON.parse(localStorage.getItem(getChatStorageKey(charName)) || "[]");
}

function saveChatMessages(charName, msgs) {
  localStorage.setItem(getChatStorageKey(charName), JSON.stringify(msgs));
}

/**
 * ✨ 核心：全量聚合读取所有渠道的记忆（旧机搬家 + 沙盒库 + 聊天室库 + 全局记忆库）
 */
function getAllAggregatedMemories(charName) {
  const safeChar = encodeURIComponent(charName || "default");

  // 1. 读取 McpGateway 专属沙盒库 (mini_vault_xxx) —— 旧机搬家写入此库
  const mcpList = JSON.parse(
    localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
  );

  // 2. 读取 聊天室旧独立库 (mini_character_memories_xxx)
  const chatMemList = JSON.parse(
    localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
  );

  // 3. 读取 事实档案库 (mini_facts_xxx)
  const factList = JSON.parse(
    localStorage.getItem(`mini_facts_${safeChar}`) || "[]",
  );

  // 4. 读取 全局共享记忆库 (mini_memory_vault)
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

  // 统一格式化并精准去重
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

  addItems(mcpList, "旧机羁绊/专属记忆");
  addItems(chatMemList, "对话记忆");
  addItems(factList, "核心事实");
  addItems(boundGlobal, "全局记忆");

  return Array.from(memoryMap.values());
}

function saveUnifiedCharMemory(charName, content, anchorType = "专属设定") {
  const safeChar = encodeURIComponent(charName || "default");
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
  const newItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    anchorType: anchorType,
    content: content.trim(),
    time: nowStr,
  };

  const mcpList = JSON.parse(
    localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
  );
  mcpList.unshift(newItem);
  localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpList));

  const chatMemList = JSON.parse(
    localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
  );
  chatMemList.unshift(newItem);
  localStorage.setItem(
    `mini_character_memories_${safeChar}`,
    JSON.stringify(chatMemList),
  );

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

// ════════════════════ 2. 聊天室入口 ════════════════════
export function openChatRoom(charInfo) {
  const fullData = getFullCharData(charInfo.name) || charInfo;
  const detectedLang = detectCharPrimaryLanguage(fullData);
  const isForeign = detectedLang !== "中文";

  activeCharInfo = {
    remark: "",
    enableTranslation: isForeign,
    targetLang: detectedLang,
    schedules: [],
    backgroundActivities: [],
    ...fullData,
  };

  if (
    !activeCharInfo.targetLang ||
    activeCharInfo.targetLang === "多语言/自动"
  ) {
    activeCharInfo.targetLang = detectedLang;
  }

  chatMessages = loadChatMessages(activeCharInfo.name);
  isGenerating = false;
  isSearchMode = false;
  isMoreToolsOpen = false;
  isSettingsOpen = false;
  activeMenuMsgIdx = null;
  quotedMessage = null;
  isMultiSelectMode = false;
  selectedMsgIndices.clear();

  const mountParent =
    document.getElementById("app-chat-root") ||
    document.querySelector(".phone-body") ||
    document.body;
  renderChatRoomView(mountParent);
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

  roomEl.innerHTML = `
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
        [沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 记忆库已实时连通
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

    <!-- 4. 更多工具抽屉 -->
    <div class="chat-more-drawer ${isMoreToolsOpen ? "active" : ""}" id="chat-more-drawer">
      <div class="more-tool-item" id="tool-tts-speak">
        <div class="more-tool-icon-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
        </div>
        <span class="more-tool-lbl">重读发声</span>
      </div>

      <div class="more-tool-item" id="tool-clear-history">
        <div class="more-tool-icon-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </div>
        <span class="more-tool-lbl">清空对话</span>
      </div>

      <div class="more-tool-item" id="tool-copy-context">
        <div class="more-tool-icon-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </div>
        <span class="more-tool-lbl">复制记录</span>
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

    <!-- 8. INS Toast 轻提示 -->
    <div class="ins-mini-toast" id="ins-chat-toast"></div>
  `;

  bindChatRoomEvents(roomEl, container);
  if (isSettingsOpen) {
    bindSettingsEvents(roomEl, container);
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

// ════════════════════ 4. 气泡列表渲染 ════════════════════
function renderMessagesHtml(messages) {
  if (messages.length === 0) {
    return `
      <div style="padding: 30px 0; text-align: center; font-size: 10px; color: var(--text-dim);">
        与【${escapeHtml(activeCharInfo.name)}】建立即时短信连结，发送第一条消息开聊
      </div>
    `;
  }

  return messages
    .map((m, idx) => {
      const isSelected = selectedMsgIndices.has(idx);

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
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
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
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              `
                  : ""
              }
            </span>
          </div>
        `
            : ""
        }

        <div class="msg-bubble-wrapper ${isSelected ? "selected-bubble" : ""}">
          <div class="msg-bubble" data-bubble-idx="${idx}">
            
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

            <div class="msg-text-content">${escapeHtml(m.content)}</div>
            
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
      </div>
    `;
    })
    .join("");
}

// ════════════════════ 5. 设置内置页面 HTML（实时显示全量聚合记忆） ════════════════════
function renderSettingsContentHtml() {
  const char = activeCharInfo;
  const memories = getAllAggregatedMemories(char.name);
  const darkroom = McpGateway.getCharDarkroom(char.name);
  const weather = McpGateway.getCharRelationshipWeather(char.name);
  const schedules = char.schedules || [];
  const bgActivities = char.backgroundActivities || [];

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
            <option value="日语" ${char.targetLang === "日语" ? "selected" : ""}>日语 (日本語 - 纯正现代东京青年口语)</option>
            <option value="英语" ${char.targetLang === "英语" ? "selected" : ""}>英语 (English - 自然日常短信风格)</option>
            <option value="韩语" ${char.targetLang === "韩语" ? "selected" : ""}>韩语 (한국어)</option>
            <option value="中文" ${char.targetLang === "中文" ? "selected" : ""}>中文 (自然生活口语)</option>
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

      <!-- 模块 3：特殊日程 -->
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

      <!-- 模块 4：后台活动 & 动向 -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">后台动态与潜思 / BACKGROUND</span>
          <button class="ins-mini-btn" id="btn-trigger-bg-activity">智能生成动向</button>
        </div>
        <p class="ins-card-desc">角色在聊天窗口之外的生活轨迹与内心状态。</p>

        <div class="ins-bg-activity-box" id="ins-bg-activity-container">
          ${bgActivities.length === 0 ? `<div class="ins-empty-hint">暂无后台动向，点击上方按钮模拟角色现实活动</div>` : ""}
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

      <!-- 模块 5：沙盒记忆库（多源打通与实时显示） -->
      <section class="ins-settings-card">
        <div class="ins-card-title-row">
          <span class="ins-card-title">专属沙盒记忆库 / MEMORY VAULT</span>
          <button class="ins-mini-btn highlight" id="btn-summarize-memories">智能提取记忆</button>
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

      <!-- 模块 6：清空聊天记录 -->
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
          `<div class="chat-handoff-pill">[沙盒已连接] ${escapeHtml(activeCharInfo.name)} · 记忆库已实时连通</div>` +
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

  const clearTool = roomEl.querySelector("#tool-clear-history");
  if (clearTool) {
    clearTool.onclick = () => {
      if (confirm(`确定要清空与【${activeCharInfo.name}】的全部对话记录吗？`)) {
        chatMessages = [];
        saveChatMessages(activeCharInfo.name, chatMessages);
        updateActiveChatListSummary(activeCharInfo.name, "[已清空对话]", "");
        renderChatRoomView(container);
        showInsToast("聊天记录已清空");
      }
    };
  }

  const copyTool = roomEl.querySelector("#tool-copy-context");
  if (copyTool) {
    copyTool.onclick = () => {
      const text = chatMessages
        .filter((m) => m.role !== "notice")
        .map(
          (m) =>
            `[${m.role === "user" ? "User" : activeCharInfo.name}]: ${m.content} ${m.translation ? `(译: ${m.translation})` : ""}`,
        )
        .join("\n");
      navigator.clipboard.writeText(text);
      showInsToast("已复制全部聊天与翻译记录");
    };
  }

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
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
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

// ════════════════════ 8. 菜单动作与 2 分钟撤回拦截 ════════════════════
function handleBubbleMenuAction(action, idx, container) {
  const targetMsg = chatMessages[idx];
  if (!targetMsg) return;

  const senderName = targetMsg.role === "user" ? "我" : activeCharInfo.name;

  if (action === "quote") {
    quotedMessage = {
      sender: senderName,
      content: targetMsg.content,
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
      content: targetMsg.content,
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

// ════════════════════ 9. 设置绑定 ════════════════════
function bindSettingsEvents(roomEl, container) {
  const closeBtn = roomEl.querySelector("#btn-close-char-settings");
  if (closeBtn) {
    closeBtn.onclick = () => {
      isSettingsOpen = false;
      renderChatRoomView(container);
    };
  }

  const avatarBox = roomEl.querySelector("#btn-set-avatar-modal");
  const avatarFileInput = roomEl.querySelector("#settings-avatar-file");
  if (avatarBox && avatarFileInput) {
    avatarBox.onclick = () => {
      avatarFileInput.value = "";
      avatarFileInput.click();
    };
    avatarFileInput.onchange = (e) => {
      handleAvatarFile(e.target.files[0], (base64) => {
        activeCharInfo.avatarUrl = base64;
        const imgPrev = roomEl.querySelector("#img-settings-preview");
        if (imgPrev) {
          imgPrev.src = base64;
        } else {
          renderChatRoomView(container);
        }
      });
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
  const manualMemTypeInput = roomEl.querySelector("#input-manual-memory-type");
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

  const summarizeBtn = roomEl.querySelector("#btn-summarize-memories");
  if (summarizeBtn) {
    summarizeBtn.onclick = async () => {
      if (chatMessages.length === 0) {
        showInsToast("暂无对话可供总结");
        return;
      }
      summarizeBtn.disabled = true;
      summarizeBtn.textContent = "提炼中...";
      await summarizeConversationMemories();
      renderChatRoomView(container);
    };
  }

  const saveBtn = roomEl.querySelector("#btn-save-char-settings");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const remarkVal =
        roomEl.querySelector("#input-char-remark")?.value.trim() || "";
      const enableTrans =
        roomEl.querySelector("#toggle-translation-switch")?.checked || false;
      const langVal =
        roomEl.querySelector("#select-char-lang")?.value || "日语";

      const scheduleRows = roomEl.querySelectorAll(
        "#ins-schedule-container .ins-schedule-item",
      );
      const updatedSchedules = [];
      scheduleRows.forEach((row) => {
        const t = row.querySelector(".ins-schedule-time")?.value.trim() || "";
        const x = row.querySelector(".ins-schedule-text")?.value.trim() || "";
        if (t || x) updatedSchedules.push({ time: t, text: x });
      });

      activeCharInfo.remark = remarkVal;
      activeCharInfo.enableTranslation = enableTrans;
      activeCharInfo.targetLang = langVal;
      activeCharInfo.schedules = updatedSchedules;

      updateFullCharData(activeCharInfo);
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

// ════════════════════ 10. 后台动向与记忆提炼 ════════════════════
async function generateBackgroundActivity() {
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    activeCharInfo.backgroundActivities =
      activeCharInfo.backgroundActivities || [];
    activeCharInfo.backgroundActivities.unshift({
      time: timeStr,
      text:
        activeCharInfo.targetLang === "日语"
          ? `スタジオでドラム叩いた後、スマホ見ながら一息ついてる。`
          : `在排练室刚练完鼓，看着手机歇了口气。`,
    });
    updateFullCharData(activeCharInfo);
    return;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
  const prompt = `你正在扮演活人角色【${activeCharInfo.name}】（母语: ${activeCharInfo.targetLang}）。当前现实时间是 ${timeStr}。请根据你的真实职业与生活状态，用一句话（18字以内，极度生活化、真实自然）写下你这一刻在做的事或小思绪。严禁动作括号。`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
    });
    const cleaned = sanitizeOnlineChatReply(raw);
    if (cleaned) {
      if (!activeCharInfo.backgroundActivities)
        activeCharInfo.backgroundActivities = [];
      activeCharInfo.backgroundActivities.unshift({
        time: timeStr,
        text: cleaned,
      });
      updateFullCharData(activeCharInfo);
    }
  } catch (e) {
    console.warn("Generate background failed", e);
  }
}

async function summarizeConversationMemories() {
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );

  if (!apiConfig.apiKey || !apiConfig.baseUrl) {
    showInsToast("请先配置 API 设置");
    return;
  }

  const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
  const contextDialog = chatMessages
    .filter((m) => m.role !== "notice")
    .slice(-20)
    .map(
      (m) =>
        `${m.role === "user" ? "User" : activeCharInfo.name}: ${m.content}`,
    )
    .join("\n");

  const prompt = `
请分析以下对话，提炼出【${activeCharInfo.name}】对 User 的重要偏好、重要事实或约定（1-3条要点）。
对话内容：
${contextDialog}

输出纯 JSON 数组，例如：["User 喜欢在雨天喝热咖啡", "和 User 约定好了周末碰面"]
`;

  try {
    const raw = await executeChatApiRequest(chatUrl, apiConfig.apiKey, {
      model: apiConfig.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      if (Array.isArray(extracted) && extracted.length > 0) {
        extracted.forEach((item) => {
          saveUnifiedCharMemory(activeCharInfo.name, item, "对话提炼");
        });
        showInsToast(`已沉淀 ${extracted.length} 项长期记忆`);
      }
    }
  } catch (e) {
    console.warn("Memory summarize error:", e);
    showInsToast("提炼记忆失败");
  }
}

// ════════════════════ 11. 发送消息与全量记忆深度注入 ════════════════════
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

  renderChatRoomView(container);
}

/**
 * 核心引擎：深度打通全量聚合记忆与 User 画像，锁死人设与关系
 */
async function handleSingleTurnReply(container) {
  isGenerating = true;
  renderChatRoomView(container);

  const charName = activeCharInfo.name;
  const apiConfig = JSON.parse(
    localStorage.getItem("mini_api_settings") || "{}",
  );

  // 1. 获取全量 User 人格
  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  const activeUserName =
    localStorage.getItem("mini_current_active_user") ||
    userPersonasFull[0]?.name ||
    "温渡雪";
  const currentUserObj =
    userPersonasFull.find((u) => u.name === activeUserName) || {};

  // 2. 获取 Char 完整档案与聚合记忆
  const fullChar = getFullCharData(charName) || activeCharInfo;
  const allMemories = getAllAggregatedMemories(charName); // ✨ 包含了旧机搬家提炼的全部记忆
  const darkroom = McpGateway.getCharDarkroom(charName);
  const weather = McpGateway.getCharRelationshipWeather(charName);

  const targetLang = fullChar.targetLang || activeCharInfo.targetLang || "日语";
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // 1. 格式化常规沙盒记忆
  const memoryPromptSection =
    allMemories.length > 0
      ? allMemories
          .map((m, idx) => `${idx + 1}. [${m.anchorType}]: ${m.content}`)
          .join("\n")
      : "(暂无历史特殊事件，基于当前基础人设相处)";

  // 2. ✨ 读取 Echo 原文库（近三天连续日记原文 + 永久钉选）
  const echoContext = EchoVault.getFormattedPromptContext(charName);

  // ════════ 深度绑定记忆库与 User 的 System Prompt ════════
  let systemPrompt = `你现在是真实生活在日本的【${charName}】本人。你正拿着手机在 LINE 上给【${activeUserName}】发消息。

════════ 📌 你的核心档案（你是谁） ════════
- 你的名字：${charName}
- 你的身份与职业：${fullChar.occupation || "乐队鼓手/学生"}
- 你的性格与背景：${fullChar.detailedInfo || fullChar.catchphrase || "有强烈的个人情绪、占有欲与深层依恋，有时会抓狂或委屈，但面对日常又带着少年感和生活化的无奈调侃。"}
- 你的生活圈/居住地：${fullChar.residence || fullChar.birthplace || "日本东京"}

════════ 📌 聊天对象【${activeUserName}】档案（对方是谁） ════════
- 对方名字：${activeUserName}
- 对方身份：${currentUserObj.occupation || "日常生活"}
- 对方喜好与雷点：${currentUserObj.likesAndDislikes || "无"}
- 对方背景详情：${currentUserObj.detailedInfo || "你的恋人/重要伙伴"}

════════ 🧠 记忆库（你们两人真实的过往经历与专属记忆，必须完全承认并铭记于心） ════════
两人羁绊状态：${weather.status} (${weather.weatherText})
【已存入大脑的记忆与事实】：
${memoryPromptSection}
${echoContext ? `\n${echoContext}` : ""}
${darkroom.length > 0 ? `\n【你当前的内心潜思】:\n` + darkroom.map((d) => `- "${d.reflection}"`).join("\n") : ""}
${fullChar.schedules && fullChar.schedules.length > 0 ? `\n【你的日程】:\n` + fullChar.schedules.map((s) => `[${s.time}] ${s.text}`).join("\n") : ""}

════════ 📌 你的核心档案（你是谁） ════════
- 你的名字：${charName}
- 你的身份与职业：${fullChar.occupation || "乐队鼓手/学生"}
- 你的性格与背景：${fullChar.detailedInfo || fullChar.catchphrase || "有强烈的个人情绪、占有欲与深层依恋，有时会抓狂或委屈，但面对日常又带着少年感和生活化的无奈调侃。"}
- 你的生活圈/居住地：${fullChar.residence || fullChar.birthplace || "日本东京"}

════════ 📌 聊天对象【${activeUserName}】档案（对方是谁） ════════
- 对方名字：${activeUserName}
- 对方身份：${currentUserObj.occupation || "日常生活"}
- 对方喜好与雷点：${currentUserObj.likesAndDislikes || "无"}
- 对方背景详情：${currentUserObj.detailedInfo || "你的恋人/重要伙伴"}

════════ 🧠 记忆库（你们两人真实的过往经历与专属记忆，必须完全承认并铭记于心） ════════
两人羁绊状态：${weather.status} (${weather.weatherText})
【已存入大脑的记忆与事实（严禁遗忘或当成不知道）】：
${memoryPromptSection}
${darkroom.length > 0 ? `【你当前的内心潜思】:\n` + darkroom.map((d) => `- "${d.reflection}"`).join("\n") : ""}
${fullChar.schedules && fullChar.schedules.length > 0 ? `【你的日程】:\n` + fullChar.schedules.map((s) => `[${s.time}] ${s.text}`).join("\n") : ""}

════════ 🔥 真实日系 LINE 聊天范式（像真人一样回复） 🔥 ════════
- 必须基于你对【${activeUserName}】的熟悉程度和以上记忆进行自然互动。
- 严禁每句开头加「ふふっ」「呵呵」傻笑！
- 严禁自作多情地说“お仕置き（惩罚）”、“大人しく待ってて（乖乖等着）”等油腻二次元套话！
- 严禁在日文里混杂中文字词！orig 必须是 100% 纯正日文！
- 严禁任何动作括号描写，纯粹输出短信！

════════ 输出格式（必须为纯 JSON，不要包裹 Markdown） ════════
{
  "replies": [
    {
      "orig": "100%纯日文短消息1",
      "trans": "自然中文翻译"
    },
    {
      "orig": "100%纯日文短消息2",
      "trans": "自然中文翻译"
    }
  ],
  "extractedSchedule": null,
  "extractedMemory": null
}
`;

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...chatMessages.map((m) => {
      if (m.role === "notice") {
        if (m.noticeType === "user_recall") {
          return {
            role: "user",
            content: `[系统事件: ${activeUserName} 刚刚撤回了一条消息（原内容为: "${m.recalledContent}"）。你可以自然吐槽或好奇追问]`,
          };
        }
        return { role: "system", content: `[提示: ${m.content}]` };
      }
      return {
        role: m.role,
        content: m.quote
          ? `[引用了 ${m.quote.sender} 的话: "${m.quote.content}"] ${m.content}`
          : m.content,
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

  const result = parseComprehensiveReply(rawReply, fullChar);

  // 自动存入记忆与日程
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
      translation: activeCharInfo.enableTranslation ? b.trans || "" : "",
      time: timeStr,
      timestamp: replyTimestamp,
      quote: b.quote || null,
    });
  });

  saveChatMessages(charName, chatMessages);
  const lastBubbleText =
    result.bubbles[result.bubbles.length - 1]?.orig || "...";
  updateActiveChatListSummary(charName, lastBubbleText, timeStr);

  renderChatRoomView(container);
}

// ════════════════════ 12. 解析器 ════════════════════
function parseComprehensiveReply(rawReply, char) {
  const isJp = (char.targetLang || "日语") === "日语";
  const defaultFallback = {
    bubbles: [
      {
        orig:
          char.catchphrase ||
          (isJp ? "……おい、メッセージ見たよ。" : "看到你的消息了。"),
        trans: isJp ? "……喂，看到你的消息了。" : "",
        quote: null,
      },
    ],
    extractedSchedule: null,
    extractedMemory: null,
  };

  if (!rawReply || !rawReply.trim()) return defaultFallback;

  try {
    const objMatch = rawReply.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      let bubbles = [];

      if (Array.isArray(parsed.replies) && parsed.replies.length > 0) {
        bubbles = parsed.replies
          .map((r) => ({
            orig: sanitizeOnlineChatReply(r.orig || r.content || r.text || ""),
            trans: sanitizeOnlineChatReply(r.trans || r.translation || ""),
            quote:
              r.quote && r.quote.content
                ? { sender: r.quote.sender || "User", content: r.quote.content }
                : null,
          }))
          .filter((b) => Boolean(b.orig));
      }

      if (bubbles.length > 0) {
        return {
          bubbles: bubbles.slice(0, 4),
          extractedSchedule:
            parsed.extractedSchedule && parsed.extractedSchedule.text
              ? parsed.extractedSchedule
              : null,
          extractedMemory:
            parsed.extractedMemory && typeof parsed.extractedMemory === "string"
              ? parsed.extractedMemory.trim()
              : null,
        };
      }
    }
  } catch (e) {}

  try {
    const arrMatch = rawReply.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const parsedArr = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsedArr) && parsedArr.length > 0) {
        const bubbles = parsedArr
          .map((item) => {
            if (typeof item === "string")
              return {
                orig: sanitizeOnlineChatReply(item),
                trans: "",
                quote: null,
              };
            return {
              orig: sanitizeOnlineChatReply(item.orig || item.content || ""),
              trans: sanitizeOnlineChatReply(
                item.trans || item.translation || "",
              ),
              quote: item.quote && item.quote.content ? item.quote : null,
            };
          })
          .filter((b) => Boolean(b.orig));

        if (bubbles.length > 0) {
          return {
            bubbles: bubbles.slice(0, 4),
            extractedSchedule: null,
            extractedMemory: null,
          };
        }
      }
    }
  } catch (e) {}

  const cleaned = sanitizeOnlineChatReply(rawReply);
  let chunks = cleaned
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    bubbles: chunks
      .slice(0, 4)
      .map((c) => ({ orig: c, trans: "", quote: null })),
    extractedSchedule: null,
    extractedMemory: null,
  };
}

function sanitizeOnlineChatReply(rawText) {
  if (!rawText) return "";
  return rawText
    .replace(/\*[^*]+\*/g, "")
    .replace(
      /（[^）]*(?:看|笑|叹|走|想|低头|抬头|眼神|神情|动作|心里|沉默|坐|站|摸|抓|愣|眨|摇|息|声|目|手|指)[^）]*）/g,
      "",
    )
    .replace(
      /\([^)]*(?:smile|sigh|look|think|action|gaze|nod|laugh)[^)]*\)/gi,
      "",
    )
    .replace(
      /^(?:ふふっ[、，。…\s]*|呵呵[、，。…\s]*|クスクス[、，。…\s]*)/g,
      "",
    )
    .replace(/^["'“”‘’]/g, "")
    .replace(/["'“”‘’]$/g, "")
    .trim();
}

function getDayPeriod(hour) {
  if (hour >= 5 && hour < 9) return "清晨时分";
  if (hour >= 9 && hour < 12) return "上午忙碌中";
  if (hour >= 12 && hour < 14) return "中午午休";
  if (hour >= 14 && hour < 18) return "下午时段";
  if (hour >= 18 && hour < 23) return "夜晚闲暇";
  return "深夜独处";
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
