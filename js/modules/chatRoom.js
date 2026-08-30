import { McpGateway } from '../utils/mcpGateway.js';

let activeCharInfo = null;
let chatMessages = [];
let isGenerating = false;
let isSearchMode = false;
let isMoreToolsOpen = false;

// 存储 Key
function getChatStorageKey(charName) {
  return `mini_chat_dialog_history_${encodeURIComponent(charName || 'default')}`;
}

function loadChatMessages(charName) {
  return JSON.parse(localStorage.getItem(getChatStorageKey(charName)) || '[]');
}

function saveChatMessages(charName, msgs) {
  localStorage.setItem(getChatStorageKey(charName), JSON.stringify(msgs));
}

/**
 * 开启指定角色的聊天室
 */
export function openChatRoom(charInfo, container) {
  activeCharInfo = charInfo;
  chatMessages = loadChatMessages(charInfo.name);
  isGenerating = false;
  isSearchMode = false;
  isMoreToolsOpen = false;

  renderChatRoomView(container);
}

/**
 * 渲染聊天室视图
 */
export function renderChatRoomView(container) {
  if (!activeCharInfo) return;

  const charName = activeCharInfo.name;
  const avatarUrl = activeCharInfo.avatarUrl || '';

  // 创建或获取聊天室 DOM
  let roomEl = container.querySelector('#chat-room-instance');
  if (!roomEl) {
    roomEl = document.createElement('div');
    roomEl.id = 'chat-room-instance';
    roomEl.className = 'chat-room-container';
    container.appendChild(roomEl);
  }

  roomEl.innerHTML = `
    <!-- ══════════ 1. 顶栏 ══════════ -->
    <header class="chat-room-header">
      <div class="chat-header-left">
        <!-- 返回键 -->
        <button class="chat-back-btn" id="btn-chat-back" title="返回对话列表">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <!-- 可自定义圆形头像框 -->
        <div class="chat-header-avatar" id="btn-change-chat-avatar" title="点击更换头像">
          ${avatarUrl ? `<img src="${avatarUrl}" />` : `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          `}
          <input type="file" id="chat-avatar-upload-native" accept="image/*" style="display:none;" />
        </div>

        <!-- 名字与在线对号状态 -->
        <div class="chat-header-info">
          <span class="chat-header-name">${charName}</span>
          <div class="chat-header-status">
            <span class="status-check-circle">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span>在线</span>
          </div>
        </div>
      </div>

      <!-- 右侧文本操作键 (搜索 / 设置) -->
      <div class="chat-header-right">
        <button class="chat-header-text-btn" id="btn-toggle-search">搜索</button>
        <button class="chat-header-text-btn" id="btn-open-char-settings">设置</button>
      </div>
    </header>

    <!-- ══════════ 2. 搜索条 ══════════ -->
    <div class="chat-search-slide-bar ${isSearchMode ? 'active' : ''}" id="chat-search-slide-bar">
      <input type="text" class="chat-search-slide-input" id="chat-search-kw-input" placeholder="输入关键词搜索历史聊天..." />
      <button class="chat-search-close-btn" id="btn-close-search">关闭</button>
    </div>

    <!-- ══════════ 3. 消息流 ══════════ -->
    <main class="chat-messages-area" id="chat-messages-scroll-area">
      <div class="chat-handoff-pill">
        [沙盒已连接] ${charName} 专属认知就绪
      </div>

      ${renderMessagesHtml(chatMessages)}

      ${isGenerating ? `
        <div class="msg-bubble-row assistant">
          <div class="msg-bubble">
            <div class="typing-wave-wrap">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      ` : ''}
    </main>

    <!-- ══════════ 4. 更多工具抽屉 ══════════ -->
    <div class="chat-more-drawer ${isMoreToolsOpen ? 'active' : ''}" id="chat-more-drawer">
      <div class="more-tool-item" id="tool-tts-speak">
        <div class="more-tool-icon-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
        </div>
        <span class="more-tool-lbl">重读发声</span>
      </div>

      <div class="more-tool-item" id="tool-clear-history">
        <div class="more-tool-icon-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </div>
        <span class="more-tool-lbl">清空对话</span>
      </div>

      <div class="more-tool-item" id="tool-darkroom-check">
        <div class="more-tool-icon-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <span class="more-tool-lbl">暗房心境</span>
      </div>

      <div class="more-tool-item" id="tool-copy-context">
        <div class="more-tool-icon-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </div>
        <span class="more-tool-lbl">复制记录</span>
      </div>
    </div>

    <!-- ══════════ 5. 底栏输入区 ══════════ -->
    <footer class="chat-room-footer">
      <!-- 更多工具键 -->
      <button class="chat-footer-btn" id="btn-toggle-more">更多</button>

      <!-- 消息输入框 -->
      <textarea class="chat-input-textarea" id="chat-input-textarea" placeholder="输入消息..." rows="1"></textarea>

      <!-- 续写键 -->
      <button class="chat-footer-btn" id="btn-continue-writing" ${isGenerating ? 'disabled' : ''}>续写</button>

      <!-- 发送键 -->
      <button class="chat-footer-btn send-btn" id="btn-send-message" ${isGenerating ? 'disabled' : ''}>发送</button>
    </footer>
  `;

  bindChatRoomEvents(roomEl, container);
  scrollToBottom(roomEl);
}

function renderMessagesHtml(messages) {
  if (messages.length === 0) {
    return `
      <div style="padding: 30px 0; text-align: center; font-size: 10.5px; color: var(--text-dim);">
        与【${activeCharInfo.name}】建立连接，在此输入开始交流
      </div>
    `;
  }

  return messages.map((m, idx) => `
    <div class="msg-bubble-row ${m.role}" data-msg-idx="${idx}">
      <div class="msg-bubble">
        <div class="msg-text-content">${escapeHtml(m.content)}</div>
        <div class="msg-time-tag">${m.time || ''}</div>
      </div>
    </div>
  `).join('');
}

function bindChatRoomEvents(roomEl, container) {
  // 返回按钮
  roomEl.querySelector('#btn-chat-back').onclick = () => {
    roomEl.remove();
  };

  // 点击头像自定义更换图片
  const avatarBox = roomEl.querySelector('#btn-change-chat-avatar');
  const avatarFileInput = roomEl.querySelector('#chat-avatar-upload-native');
  if (avatarBox && avatarFileInput) {
    avatarBox.onclick = () => {
      avatarFileInput.value = '';
      avatarFileInput.click();
    };

    avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const newUrl = URL.createObjectURL(file);
      activeCharInfo.avatarUrl = newUrl;

      // 更新角色库持久化
      const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
      const target = charList.find(c => c.name === activeCharInfo.name);
      if (target) {
        target.avatarUrl = newUrl;
        localStorage.setItem('mini_character_vault_full', JSON.stringify(charList));
      }

      renderChatRoomView(container);
    };
  }

  // 搜索键
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
        area.innerHTML = `<div class="chat-handoff-pill">[沙盒已连接] ${activeCharInfo.name} 专属认知就绪</div>` + renderMessagesHtml(chatMessages);
        return;
      }
      const filtered = chatMessages.filter(m => m.content.toLowerCase().includes(kw));
      area.innerHTML = `<div class="chat-handoff-pill">搜索结果: 找到 ${filtered.length} 条相关对话</div>` + renderMessagesHtml(filtered);
    };
  }

  // 设置键
  const settingsBtn = roomEl.querySelector('#btn-open-char-settings');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      const weather = McpGateway.getCharRelationshipWeather(activeCharInfo.name);
      alert(`【${activeCharInfo.name} 对话设置与状态】\n- 关系天气：${weather.status} (${weather.weatherText})\n- 居住地：${activeCharInfo.residence || '未设置'}\n- 语音状态：${activeCharInfo.voiceEnabled ? '已开启' : '未开启'}\n- 时间感知：${activeCharInfo.timePerception ? '已开启' : '已关闭'}`);
    };
  }

  // 更多工具展开键
  const moreBtn = roomEl.querySelector('#btn-toggle-more');
  const moreDrawer = roomEl.querySelector('#chat-more-drawer');
  if (moreBtn && moreDrawer) {
    moreBtn.onclick = () => {
      isMoreToolsOpen = !isMoreToolsOpen;
      moreDrawer.classList.toggle('active', isMoreToolsOpen);
    };
  }

  // 工具箱操作
  const clearTool = roomEl.querySelector('#tool-clear-history');
  if (clearTool) {
    clearTool.onclick = () => {
      if (confirm(`确定要清空与【${activeCharInfo.name}】的全部对话记录吗？`)) {
        chatMessages = [];
        saveChatMessages(activeCharInfo.name, chatMessages);
        renderChatRoomView(container);
      }
    };
  }

  const darkroomTool = roomEl.querySelector('#tool-darkroom-check');
  if (darkroomTool) {
    darkroomTool.onclick = () => {
      const darks = McpGateway.getCharDarkroom(activeCharInfo.name);
      if (darks.length === 0) {
        alert(`【${activeCharInfo.name}】当前暗房无潜思记录，心境平静。`);
      } else {
        alert(`【${activeCharInfo.name} 的暗房思绪 (${darks.length}条)】\n\n` + darks.map(d => `• "${d.reflection}"`).join('\n\n'));
      }
    };
  }

  const copyTool = roomEl.querySelector('#tool-copy-context');
  if (copyTool) {
    copyTool.onclick = () => {
      const text = chatMessages.map(m => `[${m.role === 'user' ? '我' : activeCharInfo.name}]: ${m.content}`).join('\n');
      navigator.clipboard.writeText(text);
      alert('已复制全部聊天记录到剪贴板！');
    };
  }

  // 发送消息
  const sendBtn = roomEl.querySelector('#btn-send-message');
  const inputArea = roomEl.querySelector('#chat-input-textarea');

  const executeSend = () => {
    const text = inputArea.value.trim();
    if (!text || isGenerating) return;
    inputArea.value = '';
    handleUserSendMessage(text, container);
  };

  if (sendBtn && inputArea) {
    sendBtn.onclick = executeSend;
    inputArea.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeSend();
      }
    };
  }

  // 续写
  const continueBtn = roomEl.querySelector('#btn-continue-writing');
  if (continueBtn) {
    continueBtn.onclick = () => {
      if (isGenerating) return;
      handleContinueWriting(container);
    };
  }
}

/**
 * 处理发送消息并调用沙盒网关与大模型 API
 */
async function handleUserSendMessage(userText, container) {
  const charName = activeCharInfo.name;
  const timeStr = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;

  // 1. 记录用户消息
  chatMessages.push({
    role: 'user',
    content: userText,
    time: timeStr
  });
  saveChatMessages(charName, chatMessages);

  // 更新会话列表的最新消息摘要
  updateActiveChatListSummary(charName, userText, timeStr);

  isGenerating = true;
  renderChatRoomView(container);

  // 2. 调用大模型发起生成
  await requestModelReply(container, false);
}

/**
 * 处理「续写」
 */
async function handleContinueWriting(container) {
  isGenerating = true;
  renderChatRoomView(container);
  await requestModelReply(container, true);
}

/**
 * 核心：发起大模型调用
 */
async function requestModelReply(container, isContinue = false) {
  const charName = activeCharInfo.name;
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');
  const activeUser = localStorage.getItem('mini_current_active_user') || '我';

  // 1. 生成包含角色绝对人设、口癖、时空认知与独立沙盒的 Handoff Prompt
  const sandboxedSystemPrompt = McpGateway.generateIsolatedHandoffBlock(activeUser, charName, chatMessages);

  // 构建消息序列
  const apiMessages = [
    { role: 'system', content: sandboxedSystemPrompt },
    ...chatMessages.map(m => ({ role: m.role, content: m.content }))
  ];

  if (isContinue) {
    apiMessages.push({
      role: 'user',
      content: '（请紧接着你的上一句发言继续自然展开叙述或对话，无需重复上文）'
    });
  }

  let replyText = '';

  // 2. 若配置了 API 则发起在线调用
  if (apiConfig.apiKey && apiConfig.baseUrl) {
    try {
      const cleanUrl = apiConfig.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: apiConfig.model || 'deepseek-chat',
          messages: apiMessages,
          temperature: typeof apiConfig.temperature === 'number' ? apiConfig.temperature : 0.7
        })
      });

      if (res.ok) {
        const data = await res.json();
        replyText = data.choices[0]?.message?.content?.trim() || '';
      } else {
        throw new Error(`API HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('在线 API 响应受阻，调用本地沙盒人设引擎兜底:', err);
    }
  }

  // 3. 离线/兜底生成（根据角色人设与口癖生成拟真回应）
  if (!replyText) {
    await new Promise(r => setTimeout(r, 800));
    replyText = generateCharacterFallbackReply(activeCharInfo);
  }

  isGenerating = false;

  const timeStr = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;

  if (isContinue && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant') {
    chatMessages[chatMessages.length - 1].content += `\n${replyText}`;
  } else {
    chatMessages.push({
      role: 'assistant',
      content: replyText,
      time: timeStr
    });
  }

  saveChatMessages(charName, chatMessages);
  updateActiveChatListSummary(charName, replyText, timeStr);

  renderChatRoomView(container);
}

/**
 * 更新会话列表摘要
 */
function updateActiveChatListSummary(charName, lastMsg, timeStr) {
  let activeList = JSON.parse(localStorage.getItem('mini_active_chat_list') || '[]');
  const target = activeList.find(c => c.name === charName);
  if (target) {
    target.lastMsg = lastMsg;
    target.time = timeStr;
    localStorage.setItem('mini_active_chat_list', JSON.stringify(activeList));
  }
}

/**
 * 离线拟真兜底
 */
function generateCharacterFallbackReply(char) {
  const cp = char.catchphrase || '';
  const name = char.name;
  return `我在。关于你刚才提到的事情，我都清晰记录在认知中了。${cp ? `（${cp}）` : ''}`;
}

function scrollToBottom(roomEl) {
  const area = roomEl.querySelector('#chat-messages-scroll-area');
  if (area) {
    setTimeout(() => {
      area.scrollTop = area.scrollHeight;
    }, 50);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
