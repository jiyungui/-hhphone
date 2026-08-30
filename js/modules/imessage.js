import { getLunarDayName } from '../utils/lunar.js';
import { getCurrentLocationWeather, syncRealWeather, openLocationModal } from './weatherService.js';
import { getStoryAvatarsHtml, initStoryAvatars } from './storyAvatars.js';

// 当前会话列表数据（默认为空，后续可由角色库或新建对话动态添加）
let chatList = [];

let selectedDateObj = new Date();

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

    const isSelected = isSameDay(d, selectedDateObj);
    const lunar = getLunarDayName(d);

    weekDays.push({
      weekday: dayNames[i],
      dayNum: d.getDate(),
      lunar: lunar,
      dateObj: d,
      isSelected
    });
  }

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const year = sunday.getFullYear();
  const month = sunday.getMonth() + 1;
  const startStr = `${month}·${sunday.getDate()}`;
  const endStr = `${saturday.getMonth() + 1}·${saturday.getDate()}`;

  return {
    yearMonth: `${year}年${month}月`,
    weekRange: `本周 ${startStr} ~ ${endStr}`,
    days: weekDays
  };
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * 渲染 iMessage 整体视图
 */
export function renderIMessageView(container) {
  const weekData = getWeekData(selectedDateObj);
  const weatherData = getCurrentLocationWeather();

  container.innerHTML = `
    <div class="imessage-container">
      <!-- 搜索框 -->
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="搜索对话" id="imessage-search"/>
      </div>

      <!-- 📅 日历 & 天气卡片 -->
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

      <!-- ✨ 日历下方的 5 个圆形头像框 -->
      ${getStoryAvatarsHtml()}

      <!-- 消息列表（无占位联系人，展示极简线条风空状态） -->
      <div class="chat-list-container">
        ${chatList.length === 0 ? `
          <div class="chat-empty-state">
            <div class="empty-icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#BBBBBB" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="8" y1="10" x2="16" y2="10"></line>
              </svg>
            </div>
            <span class="empty-title">NO CONVERSATIONS</span>
            <span class="empty-desc">暂无对话记录</span>
          </div>
        ` : `
          <ul class="chat-list" id="chat-list-ul">
            ${chatList.map(chat => `
              <li class="chat-item" data-id="${chat.id}">
                <div class="avatar-frame">
                  ${chat.avatar ? `<img src="${chat.avatar}" class="chat-avatar-img" />` : chat.initial}
                  ${chat.online ? '<div class="avatar-online-dot"></div>' : ''}
                </div>
                <div class="chat-info">
                  <div class="chat-top-row">
                    <span class="chat-name">${chat.name}</span>
                    <span class="chat-time">${chat.time}</span>
                  </div>
                  <div class="chat-bottom-row">
                    <span class="chat-last-msg">${chat.lastMsg}</span>
                    ${chat.unread ? '<span class="unread-pill"></span>' : ''}
                  </div>
                </div>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    </div>
  `;

  // 绑定日历与天气事件
  bindEvents(container, weekData);

  // 初始化 5 个头像槽位的加载与上传逻辑
  initStoryAvatars(container);

  // 后台静默刷新气温
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
  const dayCols = container.querySelectorAll('.cal-day-col');
  dayCols.forEach(col => {
    col.addEventListener('click', () => {
      const idx = Number(col.getAttribute('data-idx'));
      selectedDateObj = weekData.days[idx].dateObj;
      renderIMessageView(container);
    });
  });

  const locationBtn = container.querySelector('#weather-location-btn');
  if (locationBtn) {
    locationBtn.addEventListener('click', () => {
      openLocationModal(() => {
        renderIMessageView(container);
      });
    });
  }
}
