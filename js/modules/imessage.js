import { getLunarDayName } from '../utils/lunar.js';
import { getCurrentLocationWeather, syncRealWeather, openLocationModal } from './weatherService.js';

const mockChats = [
  {
    id: 1,
    initial: "K",
    name: "K-01 / System",
    lastMsg: "[REPORT] All parameters are stable.",
    time: "10:42",
    unread: true,
    online: true
  },
  {
    id: 2,
    initial: "EVA",
    name: "Eva Rostova",
    lastMsg: "Will check the terminal tonight.",
    time: "08:15",
    unread: false,
    online: false
  },
  {
    id: 3,
    initial: "NX",
    name: "Nexus Protocol",
    lastMsg: "Verification code: 994-021",
    time: "Ytd",
    unread: false,
    online: false
  },
  {
    id: 4,
    initial: "09",
    name: "Unit-09",
    lastMsg: "Connection interrupted. Retrying...",
    time: "Mon",
    unread: true,
    online: true
  },
  {
    id: 5,
    initial: "Z",
    name: "Zero",
    lastMsg: "Archive downloaded successfully.",
    time: "10/24",
    unread: false,
    online: false
  }
];

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
 * 渲染 iMessage 主界面
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

      <!-- 📅 日历 & 实时天气卡片 -->
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

      <!-- 消息列表 -->
      <ul class="chat-list" id="chat-list-ul">
        ${mockChats.map(chat => `
          <li class="chat-item" data-id="${chat.id}">
            <div class="avatar-frame">
              ${chat.initial}
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
    </div>
  `;

  bindEvents(container, weekData);

  // 后台静默发起实时天气同步（如果已定位），更新右上角温度
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
