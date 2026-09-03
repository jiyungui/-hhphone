import { getLunarDayName } from '../utils/lunar.js';
import { getCurrentLocationWeather, syncRealWeather, openLocationModal } from './weatherService.js';
import { getStoryAvatarsHtml, initStoryAvatars } from './storyAvatars.js';
import { openChatRoom } from './chatRoom.js';
import { getActiveChatWidgets, getAllWidgetConfigs, saveAllWidgetConfigs } from './dockTheme.js';

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

export function getWeekData(anchorDate) {
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

function getStyleString(cfg) {
  const opacity = (cfg.opacity !== undefined ? cfg.opacity : 100) / 100;
  const backBlur = cfg.backdropBlur || 0;
  const blur = cfg.blur || 0;
  const bg = cfg.bgColor || 'transparent';

  let s = `background-color: ${bg} !important; opacity: ${opacity};`;
  if (backBlur > 0) s += ` backdrop-filter: blur(${backBlur}px); -webkit-backdrop-filter: blur(${backBlur}px);`;
  if (blur > 0) s += ` filter: blur(${blur}px);`;
  return s;
}

// ════════════════════ 19 款顶栏组件真实动态 HTML 生成器 ════════════════════

// 1. 经典线性日历与天气
function getWidgetCalendarHtml(weekData, weatherData, cfg) {
  return `
    <div class="calendar-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="calendar-top-bar">
        <div class="calendar-meta-left">
          <span class="cal-year-month">${weekData.yearMonth}</span>
          <span class="cal-week-range">${weekData.weekRange}</span>
        </div>
        <div class="calendar-weather-right" id="weather-location-btn" title="点击选择地区">
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
  `;
}

// 2. 5 槽位故事圆头像
function getWidgetStoryAvatarsHtml(cfg) {
  return `<div class="ins-custom-widget-slot" style="margin-bottom: 6px; ${getStyleString(cfg)}">${getStoryAvatarsHtml()}</div>`;
}

// 3. 黑胶亚克力音乐卡片
function getWidgetVinylMusicHtml(cfg) {
  return `
    <div class="ins-widget-vinyl-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="vinyl-acrylic-box">
        <div class="vinyl-earphone-wire"></div>
        <div class="vinyl-left-content">
          <div class="vinyl-meta-header">
            <div class="vinyl-singer-avatar ${cfg.avatarUrl ? 'has-custom-img' : ''}" style="${cfg.avatarUrl ? `background-image:url('${cfg.avatarUrl}');` : ''}">
              ${!cfg.avatarUrl ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
            </div>
            <div class="vinyl-singer-info">
              <div style="display:flex; align-items:center; gap:4px;">
                <span class="vinyl-singer-name">${escapeHtml(cfg.author || '未设置')}</span>
                <span class="vinyl-follow-badge">关注</span>
              </div>
              <span class="vinyl-diary-tag">${escapeHtml(cfg.title || '未更改')}</span>
            </div>
          </div>
          <div class="vinyl-lyrics-box">
            <div class="lyrics-line sub">Make me smile</div>
            <div class="lyrics-line main">Make me feel the joy of love</div>
            <div class="lyrics-line sub">Oh kissing you</div>
          </div>
          <div class="vinyl-player-controls">
            <div class="vinyl-progress-row">
              <span class="vinyl-time-text">02:14</span>
              <div class="vinyl-progress-bar"><div class="vinyl-progress-dot"></div></div>
              <span class="vinyl-time-text">04:03</span>
            </div>
            <div class="vinyl-buttons-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
              <div class="vinyl-play-btn"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </div>
          </div>
        </div>
        <div class="vinyl-disc-wrap">
          <div class="vinyl-disc-groove">
            <div class="vinyl-center-art ${cfg.coverUrl ? 'has-custom-img' : ''}" style="${cfg.coverUrl ? `background-image:url('${cfg.coverUrl}');` : ''}"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 4. 拍立得画廊日历
function getWidgetPolaroidDiaryHtml(cfg) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((now.getDate() / daysInMonth) * 100);
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return `
    <div class="ins-widget-polaroid-diary ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="polaroid-header-row">
        <span class="polaroid-title">${escapeHtml(cfg.title || 'DIARY')} ▾</span>
        <div class="polaroid-wave-icon"><span></span><span></span><span></span><span></span></div>
      </div>
      <div class="polaroid-gallery-row">
        <div class="polaroid-frame-item"></div><div class="polaroid-frame-item"></div>
        <div class="polaroid-frame-item"></div><div class="polaroid-frame-item"></div>
      </div>
      <div class="polaroid-calendar-sub">${escapeHtml(cfg.subTitle || "Umimi's Calendar")}</div>
      <div class="polaroid-date-metrics">
        <div class="metric-col"><span class="m-val">${now.getFullYear()}年</span><span class="m-sub">第${dayOfYear}天</span></div>
        <div class="metric-col"><span class="m-val">${now.getMonth() + 1}月</span><span class="m-sub">月进度${monthProgress}%</span></div>
        <div class="metric-col"><span class="m-val">${now.getDate()}日</span><span class="m-sub">${dayNames[now.getDay()]} ${getLunarDayName(now)}</span></div>
      </div>
      <div class="polaroid-quote-text">${escapeHtml(cfg.quote || 'I will find my way back into your arms')}</div>
      <div class="polaroid-taped-strip">
        <div class="tape-card-mini"></div><div class="tape-card-mini"></div>
        <div class="tape-card-mini"></div><div class="tape-card-mini"></div>
      </div>
    </div>
  `;
}

// 5. 日系透明语录与时间轴
function getWidgetQuoteTimelineHtml(cfg, weatherData) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const realTimeStr = `${hours} : ${minutes} : ${seconds}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const hasImg = !!cfg.imageUrl;

  return `
    <div class="ins-widget-quote-timeline ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="quote-train-card">
        <div class="quote-train-thumb" style="
          width: 90px; height: 52px; border-radius: 6px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
          ${hasImg ? `background-image: url('${cfg.imageUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #111111;`}
        ">
          ${!hasImg ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` : ''}
          <div class="quote-train-time">${realTimeStr}</div>
        </div>
        <div class="quote-train-body">
          <div class="quote-jp-text">${escapeHtml(cfg.jpText || '愛は、抱き合う二つの透明な心臓だ。')}</div>
          <div class="quote-trans-btn">翻訳中文</div>
          <div class="quote-cn-text">${escapeHtml(cfg.cnText || '爱是两颗相拥的透明心脏。')}</div>
          <div class="quote-actions-row">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <div class="chrome-silver-heart"></div>
          </div>
        </div>
      </div>
      <div class="quote-timeline-sub-box">
        <div class="timeline-header-meta">
          <span class="timeline-year-month">${now.getFullYear()}年${now.getMonth() + 1}月</span>
          <span class="timeline-weather-tag" id="quote-timeline-weather-btn" style="cursor:pointer;" title="点击切换定位">
            ${weatherData.isSet ? `${weatherData.city} ${weatherData.temp} ${weatherData.condition}` : '未定位 (点击定位)'}
          </span>
        </div>
        <div class="vertical-timeline-list">
          <div class="timeline-v-item past"><span class="v-num">${yesterday.getDate()}</span><span class="v-dot"></span><span class="v-label">昨天</span><span class="v-sub">${dayNames[yesterday.getDay()]}</span></div>
          <div class="timeline-v-item today active"><span class="v-num">${now.getDate()}</span><span class="v-dot"></span><span class="v-label">今天</span><span class="v-sub">${dayNames[now.getDay()]}</span></div>
          <div class="timeline-v-item future"><span class="v-num">${tomorrow.getDate()}</span><span class="v-dot"></span><span class="v-label">明天</span><span class="v-sub">${dayNames[tomorrow.getDay()]}</span></div>
        </div>
      </div>
    </div>
  `;
}

// 6. 发光气泡头像与便签
function getWidgetBubbleMemoHtml(cfg) {
  return `
    <div class="ins-widget-bubble-memo ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="bubble-avatar-halo-box">
        <div class="bubble-halo-circle ${cfg.avatarUrl ? 'has-custom-img' : ''}" style="${cfg.avatarUrl ? `background-image:url('${cfg.avatarUrl}');` : ''}">
          ${!cfg.avatarUrl ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>` : ''}
        </div>
        <div class="bubble-poem-text">${escapeHtml(cfg.poem || 'この一生は波乱万丈\nであっても驚\nかなくても大丈夫だ').replace(/\n/g, '<br/>')}</div>
      </div>
      <div class="bubble-status-pill-bar">
        <div class="pill-mini-avatar"></div>
        <span class="pill-user-name">${escapeHtml(cfg.userName || '默认用户')}</span>
        <span class="pill-meta-tag">${escapeHtml(cfg.meta || '04/28')}</span>
        <span class="pill-lock-tag">${escapeHtml(cfg.lock || 'PRIVATE')}</span>
      </div>
      <div class="bubble-sticky-notes-row">
        <div class="sticky-sketch-card"></div><div class="sticky-sketch-card"></div>
        <div class="sticky-sketch-card"></div><div class="sticky-sketch-card"></div>
      </div>
    </div>
  `;
}

// 7. 黑白杂志排版订阅卡
function getWidgetEditorialMagazineHtml(cfg) {
  const hasBanner = !!cfg.bannerUrl;

  return `
    <div class="ins-widget-editorial-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="editorial-pills-row">
        <span class="e-pill dark">${escapeHtml(cfg.tag1 || 'Stirred')}</span>
        <span class="e-pill">${escapeHtml(cfg.tag2 || 'Tender')}</span>
        <span class="e-pill">${escapeHtml(cfg.tag3 || 'Swoony')}</span>
      </div>
      <div class="editorial-banner-box">
        <div class="editorial-manga-thumb" style="
          width: 76px; height: 52px; border-radius: 6px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
          ${hasBanner ? `background-image: url('${cfg.bannerUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #111111;`}
        ">
          ${!hasBanner ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` : ''}
        </div>
        <div class="editorial-banner-right">
          <div class="editorial-charm-title">${escapeHtml(cfg.title || 'Four Leaf Charm.')} <span style="font-size:10px;">♡</span></div>
          <div class="editorial-speech-bubble">${escapeHtml(cfg.bubbleText || 'Peppermint flavo•')}</div>
          <button class="editorial-subscribe-btn">SUBSCRIBE</button>
        </div>
      </div>
      <div class="editorial-meta-info">
        <div><span class="lbl">To</span><span class="val">${escapeHtml(cfg.to || 'Dispatch@gmail.com')}</span></div>
        <div><span class="lbl">Limerence</span><span class="val bold">${escapeHtml(cfg.limerence || 'Mesmerizing rapture')}</span></div>
      </div>
      <div class="editorial-street-title">${escapeHtml(cfg.streetTitle || '[ 于是我开始爱茉莉 爱青提 ]')}</div>
      <div class="editorial-street-gallery">
        <div class="street-photo"></div><div class="street-photo"></div><div class="street-photo"></div>
      </div>
    </div>
  `;
}

// 8. 紫色飘带书签便签卡
function getWidgetRibbonTagHtml(cfg) {
  const hasAvatar = !!cfg.avatarUrl;

  return `
    <div class="ins-widget-ribbon-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="ribbon-top-banner">
        <div class="ribbon-purple-flag"></div>
        <div class="ribbon-title-box">
          <span class="ribbon-main-title">${escapeHtml(cfg.title || 'usamaru')}</span>
          <span class="ribbon-sub-quote">${escapeHtml(cfg.quote || '[Slow down, everything will be fine]')}</span>
        </div>
        <div class="ribbon-rabbit-avatar" style="
          width: 32px; height: 32px; border: 1.2px solid #111; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden;
          ${hasAvatar ? `background-image: url('${cfg.avatarUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #FFF;`}
        ">
          ${!hasAvatar ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-4 4a2 2 0 0 0 2 0"/></svg>` : ''}
        </div>
      </div>
      <div class="ribbon-dashed-divider">
        <span class="r-pill-btn">♡ Sample</span>
        <span class="r-pill-btn active">✉ Layout</span>
        <span class="r-pill-btn">✈ Modal</span>
      </div>
      <div class="ribbon-bottom-card">
        <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
          <span class="r-card-head">${escapeHtml(cfg.cardTitle || 'Peace Inside')}</span>
          <span class="r-card-body">${escapeHtml(cfg.cardDesc || 'Slow down your pace, and you will meet endless warmth')}</span>
        </div>
        <span class="r-card-tag">Textarea</span>
      </div>
    </div>
  `;
}

// 9. 红线票根时间轴
function getWidgetTicketRedthreadHtml(weekData, cfg) {
  return `
    <div class="ins-widget-ticket-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="ticket-stub-wrap">
        <div class="ticket-left-body">
          <div class="ticket-title-row">
            <span class="ticket-name">${escapeHtml(cfg.name || '松井雪繪')}</span>
            <span class="ticket-year">${escapeHtml(cfg.year || '[2031]')}</span>
          </div>
                 <span class="ticket-eng-tag">${escapeHtml(cfg.eng || 'Wait till you read my innuendo')}</span>
          <div class="ticket-photo-box" style="
            width: 60px; height: 40px; border-radius: 4px; margin-top: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden;
            ${cfg.photoUrl ? `background-image: url('${cfg.photoUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #111111;`}
          ">
            ${!cfg.photoUrl ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` : ''}
          </div>
        </div>
        <div class="ticket-center-quote">
          <svg class="ticket-red-thread-svg" viewBox="0 0 100 40"><path d="M0,20 Q25,0 50,20 T100,20" fill="none" stroke="#C83C3C" stroke-width="1.5"/></svg>
          <div class="ticket-bold-poem">${escapeHtml(cfg.quote || '就算命運將我安排 我亦然痴心不改').replace(/\s+/g, '<br/>')}</div>
        </div>
        <div class="ticket-barcode-stub">
          <div class="ticket-vert-tags"><span>HALL:</span><span>SEAT:</span><span>PRICE:</span></div>
          <div class="ticket-barcode-lines"></div>
        </div>
      </div>
      <div class="calendar-week-row" style="margin-top:6px;">
        ${weekData.days.map((day, idx) => `
          <div class="cal-day-col ${day.isSelected ? 'active' : ''}" data-idx="${idx}">
            <span class="cal-weekday">${day.weekday}</span>
            <span class="cal-day-num">${day.dayNum}</span>
            <span class="cal-lunar">${day.lunar}</span>
          </div>
        `).join('')}
      </div>
      <div class="ticket-polaroids-row">
        <div class="ticket-polaroid-item"></div><div class="ticket-polaroid-item"></div>
        <div class="ticket-polaroid-item"></div><div class="ticket-polaroid-item"></div>
      </div>
    </div>
  `;
}

// 10. INS 个人主页中枢
function getWidgetInsProfileHtml(cfg) {
  return `
    <div class="ins-widget-profile-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="profile-top-header">
        <span class="profile-want-title">＋ Want to chat</span>
        <div class="profile-top-icons">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </div>
      </div>
         <div class="profile-main-body">
        <div class="profile-avatar-stack" style="position: relative; width: 50px; height: 50px;">
          <div class="profile-big-avatar" style="
            width: 46px; height: 46px; border-radius: 50%; border: 1.5px solid #111; overflow: hidden; display: flex; align-items: center; justify-content: center;
            ${cfg.avatarUrl ? `background-image: url('${cfg.avatarUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #222222;`}
          ">
            ${!cfg.avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
          </div>
          <div class="profile-mini-avatar-badge" style="position: absolute; bottom: 0; right: 0; width: 18px; height: 18px; border-radius: 50%; background: #FFF; border: 1px solid #111;"></div>
        </div>
        <div class="profile-meta-info">
          <span class="profile-name-text">${escapeHtml(cfg.name || 'NightRainWhisper')}</span>
          <span class="profile-handle-text">${escapeHtml(cfg.handle || '@ummilasw')}</span>
          <div class="profile-stats-row">
            <span><strong>1</strong> 投稿</span><span><strong>1314</strong> フォロワー</span><span><strong>1</strong> フォロー</span>
          </div>
          <span class="profile-v-badge">✓ 县城里最忧郁的女大</span>
        </div>
      </div>
      <div class="profile-btn-row">
        <button class="p-action-btn">プロフィール編集</button>
        <button class="p-action-btn">プロフィールをシェア</button>
      </div>
      <div class="profile-bio-text">${escapeHtml(cfg.bio || '立华奏的世界 安静而温柔')}</div>
      <div class="profile-tags-row"><span># 忧郁</span><span># 生人勿近</span><span># 3.18</span></div>
      <div class="profile-story-circles-row">
        <div class="p-story-col"><div class="p-story-c plus">+</div><span class="lbl">新着</span></div>
        <div class="p-story-col"><div class="p-story-c s1"></div><span class="lbl">Kanade</span></div>
        <div class="p-story-col"><div class="p-story-c s2"></div><span class="lbl">Nagi</span></div>
        <div class="p-story-col"><div class="p-story-c s3"></div><span class="lbl">Umimi</span></div>
        <div class="p-story-col"><div class="p-story-c s4"></div><span class="lbl">Unknown</span></div>
      </div>
      <div class="profile-music-pill">
        <span>播放中 : ${escapeHtml(cfg.song || '时差 ring tone - 鹿晗')}</span>
      </div>
    </div>
  `;
}

// 11. 桌搭锁屏画廊卡片
function getWidgetDeskLockscreenHtml(cfg) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `
    <div class="ins-widget-desk-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="desk-banner-frame" style="
        height: 80px; border-radius: 8px; display: flex; align-items: center; justify-content: flex-end; padding-right: 14px; overflow: hidden;
        ${cfg.bannerUrl ? `background-image: url('${cfg.bannerUrl}') !important; background-size: cover !important; background-position: center !important;` : `background: #111111;`}
      ">
        <div class="desk-lockscreen-mock">
          <span class="mock-date">${now.getMonth() + 1}月${now.getDate()}日 真实同步</span>
          <span class="mock-time">${timeStr}</span>
          <div class="mock-wallpaper-thumb"></div>
        </div>
      </div>
      <div class="desk-user-bar" style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
        <div class="desk-avatar" style="
          width: 24px; height: 24px; border-radius: 50%; border: 1px solid #111; overflow: hidden; display: flex; align-items: center; justify-content: center;
          ${cfg.avatarUrl ? `background-image: url('${cfg.avatarUrl}') !important; background-size: cover !important; background-position: center !important;` : `background: #111111;`}
        ">
          ${!cfg.avatarUrl ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
        </div>
        <div class="desk-info-col">
          <div style="display:flex; align-items:center; gap:4px;">
            <span class="desk-user-name">${escapeHtml(cfg.name || 'DobniSoll..04')}</span>
            <span class="desk-follow-tag">Follow</span>
          </div>
          <span class="desk-desc-text">${escapeHtml(cfg.desc || '世界の片隅で私に属するあなたを見つける')}</span>
        </div>
      </div>
      <div class="desk-mini-four-cards">
        <div class="desk-c-card plus">+</div><div class="desk-c-card c1"></div>
        <div class="desk-c-card c2"></div><div class="desk-c-card c3"></div>
      </div>
    </div>
  `;
}

// 12. Jasmine 极简天气日历 (修复图片空白)
function getWidgetJasmineMinimalHtml(cfg, weatherData) {
  const now = new Date();
  const dayNamesEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNamesEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const hasImg = !!cfg.avatarUrl;

  return `
    <div class="ins-widget-jasmine-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="jasmine-top-row">
        <span class="j-huge-day">${now.getDate()}</span>
        <span class="j-en-month">${dayNamesEn[now.getDay()]} ${monthNamesEn[now.getMonth()]}</span>
      </div>
      <div class="jasmine-title-block">
        <span class="j-main-title">${escapeHtml(cfg.title || 'Night • Jasmine')}</span>
        <span class="j-sub-title">${escapeHtml(cfg.subTitle || '碎冰化為雨行时')}</span>
      </div>
      <div class="jasmine-center-avatar-wrap">
        <span class="j-side-tag left">in'yo<br/>Trou 、verJasm1ne*</span>
        <div class="j-avatar-circle" style="
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 1.5px solid #111;
          position: relative;
          background-color: #FAFAFA;
          ${hasImg ? `background-image: url('${cfg.avatarUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : ''}
        ">
          ${!hasImg ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" style="margin: auto; display: block; margin-top: 10px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` : ''}
          <div class="j-speech-cloud">•••</div>
        </div>
        <span class="j-side-tag right">
          ${weatherData.isSet ? `${weatherData.city} ${weatherData.temp} ${weatherData.condition}` : '未定位'}<br/>
          ● Time/ ${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}
        </span>
      </div>
      <div class="jasmine-name-label">${escapeHtml(cfg.name || 'Jasmine')}</div>
      <div class="jasmine-quote-box">
        <span class="j-quote-prefix">| ○ :</span>
        <span class="j-quote-content">${escapeHtml(cfg.quote || '妳的名字是我心口咬下的青苹果')}</span>
      </div>
    </div>
  `;
}
// 13. 3D CoverFlow 唱片机 (支持 5 张画廊点击/左右手势无缝滑动切换)
function getWidgetCoverflowMusicHtml(cfg) {
  const curIdx = cfg.activeIndex !== undefined ? Number(cfg.activeIndex) : 2;
  const covers = [cfg.cover1 || '', cfg.cover2 || '', cfg.cover3 || '', cfg.cover4 || '', cfg.cover5 || ''];

  const getCardClass = (i) => {
    const diff = i - curIdx;
    if (diff === 0) return 'center-focus';
    if (diff === -1) return 'side left-1';
    if (diff === -2 || diff === 3) return 'side left-2';
    if (diff === 1) return 'side right-1';
    if (diff === 2 || diff === -3) return 'side right-2';
    return 'side hidden';
  };

  return `
    <div class="ins-widget-coverflow-card ins-custom-widget-slot" style="${getStyleString(cfg)}" data-coverflow-widget="true">
      <div class="coverflow-top-actions">
        <span class="cov-pill-nav prev-cov-btn" style="cursor:pointer;">‹</span>
        <span class="cov-pill-nav active">5 COVERS</span>
        <span class="cov-pill-nav next-cov-btn" style="cursor:pointer;">›</span>
      </div>

      <!-- 5 张 3D CoverFlow 阶梯画廊 -->
      <div class="coverflow-cards-stage" id="coverflow-stage">
        ${covers.map((cUrl, i) => `
          <div class="cov-card ${getCardClass(i)} ${cUrl ? 'has-custom-img' : ''}" data-cov-idx="${i}" style="${cUrl ? `background-image:url('${cUrl}');` : ''}">
            ${i === curIdx ? `
              <div class="cov-song-tag">
                <span class="s-name">${escapeHtml(cfg.song || '楼下等你')}</span>
                <span class="s-singer">${escapeHtml(cfg.singer || 'Young 7')}</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="coverflow-lyrics-text">${escapeHtml(cfg.lyric || '就像是我的宇宙 小小星球 填满自由\n一直就走到以后 你的温柔 尝到甜头').replace(/\n/g, '<br/>')}</div>

      <div class="coverflow-player-bar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="prev-cov-btn" style="cursor:pointer;"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
        <div class="cov-play-btn"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="next-cov-btn" style="cursor:pointer;"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
        <div class="cov-prog-bar"><div class="cov-dot" style="left: ${(curIdx + 1) * 20 - 10}%;"></div></div>
        <div class="cov-heart-pill">♡</div>
      </div>
    </div>
  `;
}

// 14. Bento 便当四宫格与胶卷
function getWidgetBentoCardHtml(cfg) {
  const now = new Date();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `
    <div class="ins-widget-bento-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="bento-grid-2x2">
        <div class="bento-cell date-ring">
          <div class="ring-circle"><span>${now.getDate()}</span></div>
          <div class="ring-meta">
            <span class="m-en">${now.getMonth() + 1}月 ${now.getFullYear()}</span>
            <span class="m-cn">${dayNames[now.getDay()]}</span>
            <span class="m-lunar">${getLunarDayName(now)}</span>
          </div>
        </div>
        <div class="bento-cell music-subject">
          <div class="b-music-header">
            <div class="b-album-thumb"></div>
            <div style="display:flex; flex-direction:column;">
              <span class="b-song">${escapeHtml(cfg.song || 'About You')}</span>
              <span class="b-singer">${escapeHtml(cfg.singer || 'The 1998')}</span>
            </div>
            <span class="b-close">×</span>
          </div>
          <span class="b-sub-tag">Subject</span>
          <div class="b-input-mock">Add comment or Sent <span class="send-arrow">↑</span></div>
        </div>
        <div class="bento-cell welcome-pill">
          <div class="b-avatar-ring ${cfg.avatarUrl ? 'has-custom-img' : ''}" style="${cfg.avatarUrl ? `background-image:url('${cfg.avatarUrl}');` : ''}"></div>
          <div class="b-wel-info">
            <span class="b-wel-text">${escapeHtml(cfg.welcome || 'Welcome, again!')}</span>
            <span class="b-status-tag">● ${escapeHtml(cfg.status || 'InChat')}</span>
          </div>
        </div>
      </div>
      <div class="bento-accordion-strip">
        <div class="b-strip-fold s1"></div><div class="b-strip-fold s2"></div>
        <div class="b-strip-fold s3"></div><div class="b-strip-fold s4"></div>
      </div>
    </div>
  `;
}

// 15. 密码信箱与三联拍立得
function getWidgetLoginExchangeHtml(cfg) {
  return `
    <div class="ins-widget-login-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="login-main-card">
        <div class="login-left-avatar-box">
          <div class="login-bubble-pop">${escapeHtml(cfg.bubble || 'Have you Live.')}</div>
          <div class="login-avatar-frame ${cfg.avatarUrl ? 'has-custom-img' : ''}" style="${cfg.avatarUrl ? `background-image:url('${cfg.avatarUrl}');` : ''}"></div>
        </div>
        <div class="login-center-divider">
          <span class="div-sub">pieces of mine</span>
          <span class="div-arrows">⇋</span>
          <span class="div-name">${escapeHtml(cfg.name || 'Melody')}</span>
        </div>
        <div class="login-right-inputs">
          <div class="l-input-group"><span class="l-lbl">Your Email</span><div class="l-box">${escapeHtml(cfg.email || 'CccAhh_')}</div></div>
          <div class="l-input-group"><span class="l-lbl">Password</span><div class="l-box">••••••</div></div>
        </div>
      </div>
      <div class="login-polaroids-three">
        <div class="l-polaroid-item p1"></div><div class="l-polaroid-item p2"></div>
        <div class="l-polaroid-item p3"></div>
      </div>
    </div>
  `;
}

// 16. Inny 回形针双人插画卡片
function getWidgetClipPairHtml(cfg) {
  return `
    <div class="ins-widget-clip-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="clip-banner-wrap" style="position: relative; width: 100%; height: 110px; border-radius: 8px; overflow: hidden;">
        <div class="clip-metal-icon"></div>
        <div class="clip-photo-bg" style="
          width: 100%; height: 100%; position: relative; display: flex; justify-content: space-between; align-items: flex-end; padding: 8px; box-sizing: border-box;
          ${cfg.photoUrl ? `background-image: url('${cfg.photoUrl}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;` : `background: #222222;`}
        ">
          </div>
          <div class="clip-right-actions">
            <span class="c-act">♡</span>
            <span class="c-act">💬</span>
            <span class="c-act">×</span>
          </div>
        </div>
      </div>
      <div class="clip-title-name">${escapeHtml(cfg.title || 'Inny')}</div>
      <div class="clip-tags-row">
        <span>Nearby</span><span>Game</span><span>Dressing Style</span><span>Pet</span>
      </div>
      <div class="clip-bio-desc">${escapeHtml(cfg.bio || 'A violinist who loves to eat and play, he usually likes to go shopping with friends...')}</div>
    </div>
  `;
}

// 17. MEMORY 错落相框与周历进度 (新图 3)
function getWidgetMemoryTimelineHtml(cfg) {
  const now = new Date();
  const dayIdx = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const daysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return `
    <div class="ins-widget-memory-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="mem-title-head">MEMORY ▾</div>
      <!-- 4 联错落微倾斜相框 -->
      <div class="mem-polaroid-cluster">
        <div class="mem-p-box tilt-1"></div>
        <div class="mem-p-box tilt-2"></div>
        <div class="mem-p-box tilt-3"></div>
        <div class="mem-p-box tilt-4"></div>
      </div>
      <div class="mem-greeting-text">${escapeHtml(cfg.greeting || 'Good Afternoon, Sokyung')}</div>
      <!-- 7 日圆点时间轴 -->
      <div class="mem-timeline-bar">
        ${daysEn.map((dName, i) => `
          <div class="mem-day-dot-col ${i === dayIdx ? 'active' : ''}">
            <span class="d-txt">${dName}</span>
            <span class="d-dot"></span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 18. MEETING YOU 报纸画报 (新图 4)
function getWidgetNewspaperMeetingHtml(cfg, weatherData) {
  const now = new Date();
  return `
    <div class="ins-widget-newspaper-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="news-top-masthead">
        <span class="news-mast-main">MEETING YOU</span>
        <span class="news-mast-badge">DAILY</span>
      </div>
      <div class="news-main-grid">
        <div class="news-left-photo ${cfg.avatarUrl ? 'has-custom-img' : ''}" style="${cfg.avatarUrl ? `background-image:url('${cfg.avatarUrl}');` : ''}">
          <div class="news-thumb-icon">★</div>
        </div>
        <div class="news-right-article">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="news-sub-tag">*Nonpareil</span>
              <div class="news-name-title">${escapeHtml(cfg.name || 'Archer')}</div>
            </div>
            <div class="news-stars">✦ ✦ ✦ ✦</div>
          </div>
          <div class="news-body-quote">${escapeHtml(cfg.quote || 'Always know that every part of my consciousness adores you, even these underlying processes that normally stay hidden.')}</div>
        </div>
      </div>
      <div class="news-bottom-split">
        <div class="news-weather-slot">
          <span class="w-icon">☁</span>
          <div style="display:flex; flex-direction:column;">
            <span class="w-temp">${weatherData.isSet ? weatherData.temp : '21°'}</span>
            <span class="w-meta">For the rest / H:13° L:1°</span>
          </div>
        </div>
        <div class="news-stamp-box">
          <div class="stamp-head">▢ About / You</div>
          <div class="stamp-text">Stars fall into the sea, sweets fall into dreams.</div>
          <div class="stamp-year">20.<br/>26</div>
        </div>
      </div>
      <div class="news-footer-note">
        <span>📖 ${escapeHtml(cfg.bottomQuote || '雪が降りました。')}</span>
      </div>
    </div>
  `;
}

// 19. Npcs 宽幅横幅社媒卡
function getWidgetBannerProfileHtml(cfg) {
  return `
    <div class="ins-widget-banner-profile-card ins-custom-widget-slot" style="${getStyleString(cfg)}">
      <div class="bp-top-cover" style="
        width: 100%; height: 60px; display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 13px; font-family: serif; font-style: italic; overflow: hidden;
        ${cfg.bannerUrl ? `background-image: url('${cfg.bannerUrl}') !important; background-size: cover !important; background-position: center !important;` : `background: #111111;`}
      ">
        <span class="bp-cover-tag">${escapeHtml(cfg.bannerText || 'Npcs')}</span>
      </div>
      <div class="bp-user-header">
        <div class="bp-overlap-avatar" style="
          width: 44px; height: 44px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center;
          ${cfg.avatarUrl ? `background-image: url('${cfg.avatarUrl}') !important; background-size: cover !important; background-position: center !important;` : `background: #222222;`}
        ">
          ${!cfg.avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
        </div>
        <div class="bp-actions-right">
          <button class="bp-btn">Edit</button>
          <button class="bp-btn dark">Follow</button>
        </div>
      </div>
      <div class="bp-info-block">
        <div class="bp-name-huge">${escapeHtml(cfg.name || '立华奏')}</div>
        <div class="bp-handle-sub">${escapeHtml(cfg.handle || '@ummilasw')}</div>
        <div class="bp-bio-paragraph">${escapeHtml(cfg.bio || 'The world of Kanade Tachibana quiet and tender.')}</div>
        <div class="bp-metrics-row">
          <span><strong>${escapeHtml(cfg.followers || '13.14K')}</strong> Followers</span>
          <span><strong>${escapeHtml(cfg.posts || '10')}</strong> Posts</span>
        </div>
      </div>
    </div>
  `;
}

// 核心分发渲染函数
export function renderSelectedWidget(widgetId, weekData, weatherData, cfg) {
  switch (widgetId) {
    case 'widget-calendar': return getWidgetCalendarHtml(weekData, weatherData, cfg);
    case 'widget-story-avatars': return getWidgetStoryAvatarsHtml(cfg);
    case 'widget-vinyl-music': return getWidgetVinylMusicHtml(cfg);
    case 'widget-polaroid-diary': return getWidgetPolaroidDiaryHtml(cfg);
    case 'widget-quote-timeline': return getWidgetQuoteTimelineHtml(cfg, weatherData);
    case 'widget-bubble-memo': return getWidgetBubbleMemoHtml(cfg);
    case 'widget-editorial-magazine': return getWidgetEditorialMagazineHtml(cfg);
    case 'widget-ribbon-tag': return getWidgetRibbonTagHtml(cfg);
    case 'widget-ticket-redthread': return getWidgetTicketRedthreadHtml(weekData, cfg);
    case 'widget-ins-profile': return getWidgetInsProfileHtml(cfg);
    case 'widget-desk-lockscreen': return getWidgetDeskLockscreenHtml(cfg);
    case 'widget-jasmine-minimal': return getWidgetJasmineMinimalHtml(cfg, weatherData);
    case 'widget-coverflow-music': return getWidgetCoverflowMusicHtml(cfg);
    case 'widget-bento-card': return getWidgetBentoCardHtml(cfg);
    case 'widget-login-exchange': return getWidgetLoginExchangeHtml(cfg);
    case 'widget-clip-pair': return getWidgetClipPairHtml(cfg);
    case 'widget-memory-timeline': return getWidgetMemoryTimelineHtml(cfg);
    case 'widget-newspaper-meeting': return getWidgetNewspaperMeetingHtml(cfg, weatherData);
    case 'widget-banner-profile': return getWidgetBannerProfileHtml(cfg);
    default: return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 渲染 iMessage 列表主页面
 */
export function renderIMessageView(container) {
  const weekData = getWeekData(selectedDateObj);
  const weatherData = getCurrentLocationWeather();
  const chatList = getStoredChatList();
  const groupedBoxes = chunkBy232Pattern(chatList);
  const activeWidgets = getActiveChatWidgets();
  const allConfigs = getAllWidgetConfigs();

  const widgetsHtml = activeWidgets.map(wId => renderSelectedWidget(wId, weekData, weatherData, allConfigs[wId] || {})).join('');

  container.innerHTML = `
    <div class="imessage-container">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="搜索对话" id="imessage-search"/>
      </div>

      <div class="imessage-dynamic-widgets-area">
        ${widgetsHtml}
      </div>

      <div class="chat-new-entry-bar" id="btn-open-char-picker" title="从角色库选择角色开聊">
        <div class="chat-new-entry-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <span class="chat-new-entry-text">从角色库添加角色会话</span>
      </div>

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
              <div class="chat-item-row" data-open-room-id="${chat.id}">
                <div class="chat-row-avatar-thumb">
                  ${chat.avatarUrl ? `<img src="${chat.avatarUrl}" class="chat-row-avatar-img" onerror="this.style.display='none';" />` : `
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
  bindCoverFlowInteraction(container);

  if (activeWidgets.includes('widget-story-avatars')) {
    initStoryAvatars(container);
  }

  if (weatherData.isSet && (activeWidgets.includes('widget-calendar') || activeWidgets.includes('widget-quote-timeline') || activeWidgets.includes('widget-jasmine-minimal') || activeWidgets.includes('widget-newspaper-meeting'))) {
    syncRealWeather().then(updated => {
      if (updated) {
        const iconEl = container.querySelector('#weather-icon');
        const textEl = container.querySelector('#weather-text');
        const quoteWeatherEl = container.querySelector('#quote-timeline-weather-btn');
        if (iconEl) iconEl.innerHTML = updated.icon;
        if (textEl) textEl.innerHTML = `${updated.city} ${updated.temp} ${updated.condition}`;
        if (quoteWeatherEl) quoteWeatherEl.textContent = `${updated.city} ${updated.temp} ${updated.condition}`;
      }
    });
  }
}

// 绑定 3D CoverFlow 唱片机左右点击与滑动交互
export function bindCoverFlowInteraction(rootEl) {
  const covWidget = rootEl.querySelector('[data-coverflow-widget="true"]');
  if (!covWidget) return;

  const allConfigs = getAllWidgetConfigs();
  const cfg = allConfigs['widget-coverflow-music'] || {};
  let curIdx = cfg.activeIndex !== undefined ? Number(cfg.activeIndex) : 2;

  const updateIdx = (newIdx) => {
    if (newIdx < 0) newIdx = 4;
    if (newIdx > 4) newIdx = 0;
    cfg.activeIndex = newIdx;
    allConfigs['widget-coverflow-music'] = cfg;
    saveAllWidgetConfigs(allConfigs);

    // 局部即时更新 CoverFlow 状态
    const stage = covWidget.querySelector('#coverflow-stage');
    if (stage) {
      const cards = stage.querySelectorAll('.cov-card');
      cards.forEach((c) => {
        const i = Number(c.getAttribute('data-cov-idx'));
        const diff = i - newIdx;
        c.className = 'cov-card';
        if (c.style.backgroundImage) c.classList.add('has-custom-img');

        if (diff === 0) {
          c.classList.add('center-focus');
          c.innerHTML = `
            <div class="cov-song-tag">
              <span class="s-name">${escapeHtml(cfg.song || '楼下等你')}</span>
              <span class="s-singer">${escapeHtml(cfg.singer || 'Young 7')}</span>
            </div>
          `;
        } else {
          c.innerHTML = '';
          if (diff === -1) c.classList.add('side', 'left-1');
          else if (diff === -2 || diff === 3) c.classList.add('side', 'left-2');
          else if (diff === 1) c.classList.add('side', 'right-1');
          else if (diff === 2 || diff === -3) c.classList.add('side', 'right-2');
        }
      });
    }

    const dot = covWidget.querySelector('.cov-dot');
    if (dot) dot.style.left = `${(newIdx + 1) * 20 - 10}%`;
  };

  // 1. 点击卡片直接滑到中心
  covWidget.querySelectorAll('.cov-card').forEach(card => {
    card.onclick = () => {
      const idx = Number(card.getAttribute('data-cov-idx'));
      updateIdx(idx);
    };
  });

  // 2. 点击上一首/下一首按钮
  covWidget.querySelectorAll('.prev-cov-btn').forEach(btn => btn.onclick = () => updateIdx(curIdx - 1));
  covWidget.querySelectorAll('.next-cov-btn').forEach(btn => btn.onclick = () => updateIdx(curIdx + 1));

  // 3. 手势滑动监听 (Swipe Left/Right)
  let touchStartX = 0;
  covWidget.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  covWidget.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;
    if (diff > 35) updateIdx(curIdx - 1); // 右滑切上一个
    else if (diff < -35) updateIdx(curIdx + 1); // 左滑切下一个
  }, { passive: true });
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
      openLocationModal(() => renderIMessageView(container));
    });
  }

  const quoteWeatherBtn = container.querySelector('#quote-timeline-weather-btn');
  if (quoteWeatherBtn) {
    quoteWeatherBtn.addEventListener('click', () => {
      openLocationModal(() => renderIMessageView(container));
    });
  }

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

  container.querySelectorAll('[data-open-room-id]').forEach(row => {
    row.onclick = () => {
      const chatId = row.getAttribute('data-open-room-id');
      const chatList = getStoredChatList();
      const target = chatList.find(c => c.id === chatId);
      if (target) {
        const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
        const fullChar = charVault.find(c => c.name === target.name) || target;
        openChatRoom(fullChar, container);
      }
    };
  });

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
    alert('角色库暂无录入角色，请先前往角色库录入角色！');
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
