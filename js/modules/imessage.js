import { getLunarDayName } from '../utils/lunar.js';
import { getCurrentLocationWeather, syncRealWeather, openLocationModal } from './weatherService.js';
import { getStoryAvatarsHtml, initStoryAvatars } from './storyAvatars.js';
import { openChatRoom } from './chatRoom.js'; // ✨ 引入聊天室

function getStoredChatList() {
  return JSON.parse(localStorage.getItem('mini_active_chat_list') || '[]');
}

function saveStoredChatList(list) {
  localStorage.setItem('mini_active_chat_list', JSON.stringify(list));
}

let selectedDateObj = new Date();

function chunkBy232Pattern(array) {
  const chunks = [];
  let i = 0;
  let patternIdx = 0;

  while (i < array.length) {
    const chunkSize = (patternIdx % 2 === 0) ? 2 : 3;
    chunks.push({
      capacity: chunkSize,
      items: array.slice(i, i + chunkSize)
    });
    i += chunkSize;
    patternIdx++;
  }

  return chunks;
}

function getWeekData(anchorDate) {
  const current = new Date(anchorDate);
  const dayOfWeek = current.getDay();
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - dayOfWeek);

  const weekDays = [];
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);

    weekDays.push({
      weekday: dayNames[i],
      dayNum: d.getDate(),
      lunar: getLunarDayName(d),
      dateObj: d,
      isSelected: isSameDay(d, selectedDateObj)
    });
  }

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    yearMonth: `${sunday.getFullYear()}年${sunday.getMonth() + 1}月`,
    weekRange: `本周 ${sunday.getMonth() + 1}·${sunday.getDate()} ~ ${saturday.getMonth() + 1}·${saturday.getDate()}`,
    days: weekDays
  };
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * 渲染 iMessage 列表
 */
export function renderIMessageView(container) {
  const weekData = getWeekData(selectedDateObj);
  const weatherData = getCurrentLocationWeather();
  const chatList = getStoredChatList();
  const groupedBoxes = chunkBy232Pattern(chatList);

  container.innerHTML = `
    <div class="imessage-container">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="搜索对话" id="imessage-search"/>
      </div>

      <div class="calendar-card">
        <div class="calendar-top-bar">
          <div class="calendar-meta-left">
            <span class="cal-year-month">${weekData.yearMonth}</span>
            <span class="cal-week-range">${weekData.weekRange}</span>
          </div>

          <div class="calendar-weather-right" id="weather-location-btn" title="点击选择或更新地区">
            <div class="weather-icon-wrap" id="weather-icon">${weatherData.icon}</div>
            <div class="weather-text-wrap ${weatherData.isSet ? '' : 'unset'}" id="weather-text">
              ${weatherData.isSet ? `${weatherData.city} ${weatherData.temp} ${weatherData.condition}` : '未定位'}
            </div>
          </div>
        </div>

        <div class="calendar-week-row">
          ${weekData.days.map((day, idx) => `
            <div class="cal-day-col ${day.isSelected ? 'active' : ''}" data-idx="${idx}">
              <span class="cal-weekday">${day.weekday}</span>
              <span class="cal-day-num">${day.dayNum}</span>
              <span class="cal-lunar">${day.lunar}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${getStoryAvatarsHtml()}

      <!-- 5个头像框下方的加号 -->
      <div class="chat-new-entry-bar" id="btn-open-char-picker" title="从角色库选择角色开聊">
        <div class="chat-new-entry-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <span class="chat-new-entry-text">从角色库添加角色会话</span>
      </div>

      <!-- 2-3-2 极简分组列表 -->
      <div class="chat-list-container" id="chat-list-scroll-area">
        ${chatList.length === 0 ? `
          <div class="chat-empty-state">
            <div class="empty-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BBBBBB" stroke-width="1.6" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <span class="empty-title">NO CONVERSATIONS</span>
            <span class="empty-desc">暂无对话记录，点击上方加号选择角色</span>
          </div>
        ` : groupedBoxes.map(box => `
          <div class="chat-group-box">
            ${box.items.map(chat => `
              <!-- ✨ 点击直接进入该角色的对话页面 -->
              <div class="chat-item-row" data-open-room-id="${chat.id}">
                <div class="chat-row-avatar-thumb">
                  ${chat.avatarUrl ? `<img src="${chat.avatarUrl}" class="chat-row-avatar-img" />` : `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  `}
                </div>

                <div class="chat-row-info">
                  <div class="chat-row-top">
                    <span class="chat-row-name">${chat.name}</span>
                    <span class="chat-row-time">${chat.time || '刚刚'}</span>
                  </div>
                  <div class="chat-row-bottom">
                    <span class="chat-row-last-msg">${chat.lastMsg || '[已建立沙盒连结] 准备开启对话...'}</span>
                    <button class="chat-row-del-btn" data-del-chat-id="${chat.id}" title="移除会话">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  bindEvents(container, weekData);
  initStoryAvatars(container);

  if (weatherData.isSet) {
    syncRealWeather().then(updated => {
      if (updated) {
        const iconEl = container.querySelector('#weather-icon');
        const textEl = container.querySelector('#weather-text');
        if (iconEl) iconEl.innerHTML = updated.icon;
        if (textEl) textEl.innerHTML = `${updated.city} ${updated.temp} ${updated.condition}`;
      }
    });
  }
}

function bindEvents(container, weekData) {
  // 日历点击
  const dayCols = container.querySelectorAll('.cal-day-col');
  dayCols.forEach(col => {
    col.addEventListener('click', () => {
      const idx = Number(col.getAttribute('data-idx'));
      selectedDateObj = weekData.days[idx].dateObj;
      renderIMessageView(container);
    });
  });

  // 天气点击
  const locationBtn = container.querySelector('#weather-location-btn');
  if (locationBtn) {
    locationBtn.addEventListener('click', () => {
      openLocationModal(() => renderIMessageView(container));
    });
  }

  // 从角色库添加会话
  const openCharPickerBtn = container.querySelector('#btn-open-char-picker');
  if (openCharPickerBtn) {
    openCharPickerBtn.onclick = () => {
      openCharacterSelectModal((selectedChar) => {
        const chatList = getStoredChatList();
        const existing = chatList.find(c => c.id === selectedChar.id || c.name === selectedChar.name);
        if (!existing) {
          chatList.unshift({
            id: selectedChar.id || `chat-${Date.now()}`,
            name: selectedChar.name,
            avatarUrl: selectedChar.avatarUrl || '',
            occupation: selectedChar.occupation || '',
            residence: selectedChar.residence || '',
            lastMsg: '[已建立沙盒连结] 准备开启对话...',
            time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`
          });
          saveStoredChatList(chatList);
        }
        renderIMessageView(container);
      });
    };
  }

  // ✨ 核心：点击会话行进入聊天室
  container.querySelectorAll('[data-open-room-id]').forEach(row => {
    row.onclick = () => {
      const chatId = row.getAttribute('data-open-room-id');
      const chatList = getStoredChatList();
      const target = chatList.find(c => c.id === chatId);
      if (target) {
        // 读取该角色更完整的设定（出生地/语音等）
        const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
        const fullChar = charVault.find(c => c.name === target.name) || target;
        openChatRoom(fullChar, container);
      }
    };
  });

  // 移除会话
  container.querySelectorAll('[data-del-chat-id]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const chatId = btn.getAttribute('data-del-chat-id');
      let chatList = getStoredChatList();
      chatList = chatList.filter(c => c.id !== chatId);
      saveStoredChatList(chatList);
      renderIMessageView(container);
    };
  });
}

function openCharacterSelectModal(onSelect) {
  const characters = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  if (characters.length === 0) {
    alert('角色库暂无录入角色，请先点击左侧第三个图标前往「角色库」录入角色！');
    return;
  }

  const modalRoot = document.getElementById('modal-root') || document.body;
  const drawer = document.createElement('div');
  drawer.className = 'modal-container active';

  drawer.innerHTML = `
    <div class="modal-backdrop" id="char-picker-backdrop"></div>
    <div class="modal-sheet">
      <div class="sheet-drag-handle"></div>
      <div class="sheet-header">
        <div style="width:24px"></div>
        <span class="sheet-title">从角色库选择开聊角色 (${characters.length})</span>
        <button class="sheet-close-btn" id="char-picker-close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <ul class="sheet-options-list" style="padding-bottom: 16px;">
        ${characters.map((c, i) => `
          <li class="sheet-option-item" data-pick-idx="${i}" style="gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 6px; border: 1px solid #111; overflow: hidden; background: #F7F7F7; flex-shrink: 0; display:flex; align-items:center; justify-content:center;">
              ${c.avatarUrl ? `<img src="${c.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:9px;font-weight:700;">${c.name.slice(0,2)}</span>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:1px; flex:1;">
              <span style="font-size:12.5px; font-weight:800; color:#111;">${c.name}</span>
              <span style="font-size:9.5px; color:#888;">${c.occupation || c.residence || '角色档案就绪'}</span>
            </div>
            <button class="api-btn api-btn-primary" style="width:auto; padding:3px 10px; font-size:10px; pointer-events:none;">选择</button>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  modalRoot.appendChild(drawer);
  drawer.querySelector('#char-picker-backdrop').onclick = () => drawer.remove();
  drawer.querySelector('#char-picker-close-btn').onclick = () => drawer.remove();

  drawer.querySelectorAll('[data-pick-idx]').forEach(el => {
    el.onclick = () => {
      const idx = Number(el.getAttribute('data-pick-idx'));
      onSelect(characters[idx]);
      drawer.remove();
    };
  });
}
