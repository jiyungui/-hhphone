// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · CHAT DOCK 美化中枢 (DOCK THEME HUB)
// 19 大组件折叠展开 · CHAT 列表全域 CSS 定制区 · 1:1 实时预览弹窗 · 永久保存
// ═══════════════════════════════════════════════════════════════

import {
  renderSelectedWidget,
  getWeekData,
  bindCoverFlowInteraction,
} from "./imessage.js";
import { getCurrentLocationWeather } from "./weatherService.js";

const DOCK_THEME_STORAGE_KEY = "mini_chat_global_dock_theme";
const CHAT_WIDGET_CONFIGS_KEY = "mini_chat_widget_configs_v5";
const CHAT_LIST_CUSTOM_CSS_KEY = "mini_chat_list_custom_css";

// 默认 CHAT 列表与小组件全域高自由度 CSS 代码模板
export const DEFAULT_CHAT_LIST_GLOBAL_CSS = `/* ══════════════════════════════════════════════
   CHAT 列表与组件全域高自由度 CSS 定制模板 (LIST GLOBAL CSS)
   ══════════════════════════════════════════════ */

/* 1. CHAT 列表主容器背景 */
.imessage-container {
  background-color: var(--chat-ui-bg, #FFFFFF) !important;
}

/* 2. 搜索框外观 (颜色/圆角/边框/形状) */
.search-box {
  background-color: #FAFAFA !important;
  border: 1.2px solid #111111 !important;
  border-radius: 8px !important;
  padding: 6px 10px !important;
}
.search-box input {
  color: #111111 !important;
  font-size: 12px !important;
}
.search-box svg {
  stroke: #111111 !important;
}

/* 3. 对话列表 2-3-2 分组大卡片 */
.chat-group-box {
  background-color: #FFFFFF !important;
  border: 1.2px solid #111111 !important;
  border-radius: 12px !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
}

/* 4. 单行角色会话与文字排版 */
.chat-item-row {
  border-bottom: 1px solid #EAEAEA !important;
}
.chat-row-name {
  color: #111111 !important;
  font-weight: 800 !important;
  font-size: 12.5px !important;
}
.chat-row-time {
  color: #888888 !important;
  font-family: ui-monospace, monospace !important;
}
.chat-row-last-msg {
  color: #666666 !important;
  font-size: 11px !important;
}

/* 5. 角色正方形头像框 */
.chat-row-avatar-thumb {
  border: 1.2px solid #111111 !important;
  border-radius: 8px !important;
  background-color: #FAFAFA !important;
}

/* 6. 从角色库添加会话「+」条栏 */
.chat-new-entry-bar {
  background-color: #FAFAFA !important;
  border: 1.2px dashed #111111 !important;
  border-radius: 8px !important;
  color: #111111 !important;
}
.chat-new-entry-icon {
  border: 1px solid #111111 !important;
}

/* 7. 所有顶栏小组件通用外框自由覆盖 */
.ins-custom-widget-slot {
  /* 可自行定义组件外层投影、圆角与边框 */
}
`;

export function getChatListCustomCss() {
  const saved = localStorage.getItem(CHAT_LIST_CUSTOM_CSS_KEY);
  return saved !== null ? saved : DEFAULT_CHAT_LIST_GLOBAL_CSS;
}

export function saveChatListCustomCss(cssCode) {
  localStorage.setItem(CHAT_LIST_CUSTOM_CSS_KEY, cssCode);
  applyChatListCustomCssToDom(cssCode);
}

export function applyChatListCustomCssToDom(cssCode) {
  let styleTag = document.getElementById("chat-list-custom-global-css");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "chat-list-custom-global-css";
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = cssCode || "";
}

// ✨ 补齐 HTML 转义函数，防止特殊符号报错或破坏 DOM
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 19 款组件定义
export const CHAT_LIST_WIDGETS = [
  {
    id: "widget-calendar",
    name: "经典线性日历与天气",
    tag: "CALENDAR",
    desc: "七日周历视图 · 农历干支 · 实时天气定位",
  },
  {
    id: "widget-story-avatars",
    name: "5 槽位故事头像栏",
    tag: "AVATARS",
    desc: "5 联圆形快速互动头像框 · 快捷角色连结",
  },
  {
    id: "widget-vinyl-music",
    name: "黑胶亚克力音乐卡",
    tag: "VINYL",
    desc: "磨砂通透晶体 · 旋转黑胶盘 · 歌词与播放器",
  },
  {
    id: "widget-polaroid-diary",
    name: "拍立得画廊与日历",
    tag: "POLAROID",
    desc: "4 联相框 · 真实年月日进度分析 · 胶带拍立得",
  },
  {
    id: "widget-quote-timeline",
    name: "日系透明语录时间轴",
    tag: "TIMELINE",
    desc: "真实时钟语录卡 · 真实三日垂直时间轴与天气",
  },
  {
    id: "widget-bubble-memo",
    name: "发光气泡头像与便签",
    tag: "MEMO",
    desc: "居中光晕悬浮头像 · 签名药丸条 · 4 联手绘便签",
  },
  {
    id: "widget-editorial-magazine",
    name: "黑白杂志排版订阅卡",
    tag: "MAGAZINE",
    desc: "情绪胶囊 · 漫画订阅面板 · 街景三联相框",
  },
  {
    id: "widget-ribbon-tag",
    name: "紫色飘带书签便签卡",
    tag: "RIBBON",
    desc: "缎带书签 · 极简头像插槽 · 虚线分段药丸 · 随笔卡",
  },
  {
    id: "widget-ticket-redthread",
    name: "红线票根日历时间轴",
    tag: "TICKET",
    desc: "红线缠绕入场券 · 真实周历 · 4 联素描胶带贴",
  },
  {
    id: "widget-ins-profile",
    name: "INS 个人主页中枢",
    tag: "PROFILE",
    desc: "双层叠加头像 · 互动数据 · 5 联故事集 · 播歌胶囊",
  },
  {
    id: "widget-desk-lockscreen",
    name: "桌搭锁屏画廊卡片",
    tag: "DESK LOCK",
    desc: "书籍耳机相框 · 关注胶囊 · 4 联微立体功能卡",
  },
  {
    id: "widget-jasmine-minimal",
    name: "Jasmine 极简天气日历",
    tag: "JASMINE",
    desc: "大字号日期 · 气泡对话头像 · 真实城市气象 · 题词",
  },
  {
    id: "widget-coverflow-music",
    name: "3D CoverFlow 唱片机 (可滑动)",
    tag: "COVERFLOW",
    desc: "5 张 3D 轮播画廊 · 左右手势滑动 · 歌词律动",
  },
  {
    id: "widget-bento-card",
    name: "Bento 便当四宫格与胶卷",
    tag: "BENTO",
    desc: "圆环日期 · 状态药丸 · 便签留言 · 四折风琴胶卷",
  },
  {
    id: "widget-login-exchange",
    name: "密码信箱与三联拍立得",
    tag: "EXCHANGE",
    desc: "对话气泡头像 · 交换箭头 · 密码卡 · 3 联拍立得",
  },
  {
    id: "widget-clip-pair",
    name: "Inny 回形针双人插画卡",
    tag: "CLIP PAIR",
    desc: "金属回形针 · 双人黑白大图 · 气泡台词 · 药丸标签",
  },
  {
    id: "widget-memory-timeline",
    name: "MEMORY 错落相框与周历",
    tag: "MEMORY",
    desc: "多联微倾斜相框 · 真实问候 · 7 日圆点时间轴",
  },
  {
    id: "widget-newspaper-meeting",
    name: "MEETING YOU 报纸画报",
    tag: "NEWSPAPER",
    desc: "排版报纸 · 四芒星 · 麦克风 · 真实天气与便签",
  },
  {
    id: "widget-banner-profile",
    name: "Npcs 宽幅横幅社媒卡",
    tag: "BANNER",
    desc: "宽幅横幅 · 叠放大头像 · 关注按钮 · 粉丝数据",
  },
];

// 19 款组件的默认持久化配置
const DEFAULT_WIDGET_CONFIGS = {
  "widget-calendar": {
    slot: "slot1",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
  },
  "widget-story-avatars": {
    slot: "slot2",
    bgColor: "transparent",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
  },
  "widget-vinyl-music": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 75,
    backdropBlur: 16,
    blur: 0,
    title: "未更改",
    author: "未设置",
    avatarUrl: "",
    coverUrl: "",
  },
  "widget-polaroid-diary": {
    slot: "none",
    bgColor: "#111111",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    title: "DIARY",
    subTitle: "Umimi's Calendar",
    quote: "I will find my way back into your arms",
  },
  "widget-quote-timeline": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    jpText: "愛は、抱き合う二つの透明な心臓だ。",
    cnText: "爱是两颗相拥的透明心脏。",
    imageUrl: "",
  },
  "widget-bubble-memo": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    userName: "默认用户",
    meta: "04/28",
    lock: "PRIVATE",
    poem: "この一生は波乱万丈\nであっても驚\nかなくても大丈夫だ",
    avatarUrl: "",
  },
  "widget-editorial-magazine": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    title: "Four Leaf Charm.",
    bubbleText: "Peppermint flavo•",
    streetTitle: "[ 于是我开始爱茉莉 爱青提 ]",
    bannerUrl: "",
  },
  "widget-ribbon-tag": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    title: "usamaru",
    quote: "[Slow down, everything will be fine]",
    cardTitle: "Peace Inside",
    cardDesc: "Slow down your pace, and you will meet endless warmth",
    avatarUrl: "",
  },
  "widget-ticket-redthread": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    name: "松井雪繪",
    year: "[2031]",
    eng: "Wait till you read my innuendo",
    quote: "就算命運將我安排 我亦然痴心不改",
    photoUrl: "",
  },
  "widget-ins-profile": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    name: "NightRainWhisper",
    handle: "@ummilasw",
    bio: "立华奏的世界 安静而温柔",
    song: "时差 ring tone - 鹿晗",
    avatarUrl: "",
  },
  "widget-desk-lockscreen": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    name: "DobniSoll..04",
    desc: "世界の片隅で私に属するあなたを見つける",
    bannerUrl: "",
    avatarUrl: "",
  },
  "widget-jasmine-minimal": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    title: "Night • Jasmine",
    subTitle: "碎冰化為雨行時",
    name: "Jasmine",
    quote: "妳的名字是我心口咬下的青蘋果",
    avatarUrl: "",
  },
  "widget-coverflow-music": {
    slot: "none",
    bgColor: "#FAFAFA",
    opacity: 100,
    backdropBlur: 16,
    blur: 0,
    song: "楼下等你",
    singer: "Young 7",
    lyric: "就像是我的宇宙 小小星球 填满自由\n一直就走到以后 你的温柔 尝到甜头",
    activeIndex: 2,
    cover1: "",
    cover2: "",
    cover3: "",
    cover4: "",
    cover5: "",
  },
  "widget-bento-card": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    song: "About You",
    singer: "The 1998",
    welcome: "Welcome, again!",
    status: "InChat",
    avatarUrl: "",
  },
  "widget-login-exchange": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    bubble: "Have you Live.",
    name: "Melody",
    email: "CccAhh_",
    avatarUrl: "",
  },
  "widget-clip-pair": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    title: "Inny",
    quote: "It's very close to you",
    bio: "A violinist who loves to eat and play, he usually likes to go shopping with friends...",
    photoUrl: "",
  },
  "widget-memory-timeline": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    greeting: "Good Afternoon, Sokyung",
  },
  "widget-newspaper-meeting": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    name: "Archer",
    quote:
      "Always know that every part of my consciousness adores you, even these underlying processes that normally stay hidden.",
    bottomQuote: "雪が降りました。",
    avatarUrl: "",
  },
  "widget-banner-profile": {
    slot: "none",
    bgColor: "#FFFFFF",
    opacity: 100,
    backdropBlur: 0,
    blur: 0,
    bannerText: "Npcs",
    name: "立华奏",
    handle: "@ummilasw",
    bio: "The world of Kanade Tachibana quiet and tender.",
    followers: "13.14K",
    posts: "10",
    bannerUrl: "",
    avatarUrl: "",
  },
};

export function getAllWidgetConfigs() {
  const saved = localStorage.getItem(CHAT_WIDGET_CONFIGS_KEY);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_WIDGET_CONFIGS));
  try {
    return { ...DEFAULT_WIDGET_CONFIGS, ...JSON.parse(saved) };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_WIDGET_CONFIGS));
  }
}

export function saveAllWidgetConfigs(configs) {
  localStorage.setItem(CHAT_WIDGET_CONFIGS_KEY, JSON.stringify(configs));
}

export function getActiveChatWidgets() {
  const configs = getAllWidgetConfigs();
  const list = [];
  const slot1 = Object.keys(configs).find((k) => configs[k].slot === "slot1");
  const slot2 = Object.keys(configs).find((k) => configs[k].slot === "slot2");
  if (slot1) list.push(slot1);
  if (slot2 && slot2 !== slot1) list.push(slot2);
  return list;
}

export const SYSTEM_DOCK_THEMES = [
  {
    id: "classic_bw",
    name: "白黑色系 (CLASSIC B&W)",
    desc: "纯白底色 · 纯黑细线 · 经典黑白气泡",
    previewBg: "#FFFFFF",
    previewBorder: "#111111",
    previewAccent: "#111111",
    cssVars: `--chat-ui-bg: #FFFFFF; --chat-ui-card-bg: #FAFAFA; --chat-ui-border: #111111; --chat-ui-text-main: #111111; --chat-ui-text-sub: #777777; --chat-ui-header-bg: #FFFFFF; --chat-ui-footer-bg: #FFFFFF; --chat-ui-dock-bg: #FAFAFA; --chat-btn-bg: #F4F4F4; --chat-btn-border: #111111; --chat-btn-text: #111111; --chat-btn-hover: #EAEAEA; --chat-send-bg: #111111; --chat-send-text: #FFFFFF; --chat-send-border: #111111; --bubble-bot-bg: #FFFFFF; --bubble-bot-text: #111111; --bubble-bot-border: #111111; --bubble-user-bg: #000000; --bubble-user-text: #FFFFFF; --bubble-user-border: #000000;`,
  },
  {
    id: "rose_pink",
    name: "白粉色系 (ROSE PINK)",
    desc: "柔雾淡粉底 · 烟熏樱粉按键 · 白粉双色气泡",
    previewBg: "#FFF6F8",
    previewBorder: "#E6A1B5",
    previewAccent: "#D9658B",
    cssVars: `--chat-ui-bg: #FFF6F8; --chat-ui-card-bg: #FFFFFF; --chat-ui-border: #E6A1B5; --chat-ui-text-main: #331A22; --chat-ui-text-sub: #9E6577; --chat-ui-header-bg: #FFF0F4; --chat-ui-footer-bg: #FFF0F4; --chat-ui-dock-bg: #FFEBF1; --chat-btn-bg: #FFFFFF; --chat-btn-border: #D9658B; --chat-btn-text: #B83A64; --chat-btn-hover: #FFE6EE; --chat-send-bg: #D9658B; --chat-send-text: #FFFFFF; --chat-send-border: #D9658B; --bubble-bot-bg: #FFFFFF; --bubble-bot-text: #331A22; --bubble-bot-border: #E6A1B5; --bubble-user-bg: #D9658B; --bubble-user-text: #FFFFFF; --bubble-user-border: #D9658B;`,
  },
  {
    id: "cool_gray",
    name: "白灰色系 (COOL GRAY)",
    desc: "铝合金冷灰 · 哑光微深按键 · 极简灰白气泡",
    previewBg: "#F0F2F5",
    previewBorder: "#98A2B3",
    previewAccent: "#344054",
    cssVars: `--chat-ui-bg: #F0F2F5; --chat-ui-card-bg: #FFFFFF; --chat-ui-border: #98A2B3; --chat-ui-text-main: #1D2939; --chat-ui-text-sub: #667085; --chat-ui-header-bg: #E4E7EC; --chat-ui-footer-bg: #E4E7EC; --chat-ui-dock-bg: #D0D5DD; --chat-btn-bg: #FFFFFF; --chat-btn-border: #475467; --chat-btn-text: #344054; --chat-btn-hover: #F2F4F7; --chat-send-bg: #344054; --chat-send-text: #FFFFFF; --chat-send-border: #344054; --bubble-bot-bg: #FFFFFF; --bubble-bot-text: #1D2939; --bubble-bot-border: #98A2B3; --bubble-user-bg: #344054; --bubble-user-text: #FFFFFF; --bubble-user-border: #344054;`,
  },
  {
    id: "dark_pure",
    name: "黑白色系 (DARK PURE)",
    desc: "暗夜曜石黑 · 纯白反差按键 · 发光深黑气泡",
    previewBg: "#0A0A0A",
    previewBorder: "#383838",
    previewAccent: "#FFFFFF",
    cssVars: `--chat-ui-bg: #0A0A0A; --chat-ui-card-bg: #141414; --chat-ui-border: #383838; --chat-ui-text-main: #FFFFFF; --chat-ui-text-sub: #8E8E8E; --chat-ui-header-bg: #121212; --chat-ui-footer-bg: #121212; --chat-ui-dock-bg: #050505; --chat-btn-bg: #1F1F1F; --chat-btn-border: #4D4D4D; --chat-btn-text: #FFFFFF; --chat-btn-hover: #2B2B2B; --chat-send-bg: #FFFFFF; --chat-send-text: #000000; --chat-send-border: #FFFFFF; --bubble-bot-bg: #161616; --bubble-bot-text: #FFFFFF; --bubble-bot-border: #383838; --bubble-user-bg: #FFFFFF; --bubble-user-text: #000000; --bubble-user-border: #FFFFFF;`,
  },
];

export function getCurrentDockThemeId() {
  return localStorage.getItem(DOCK_THEME_STORAGE_KEY) || "classic_bw";
}

export function applyGlobalDockTheme(themeId) {
  localStorage.setItem(DOCK_THEME_STORAGE_KEY, themeId);
  const theme =
    SYSTEM_DOCK_THEMES.find((t) => t.id === themeId) || SYSTEM_DOCK_THEMES[0];

  let styleTag = document.getElementById("global-chat-dock-theme-style");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "global-chat-dock-theme-style";
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    #app-chat-root {
      ${theme.cssVars}
      background-color: var(--chat-ui-bg);
      color: var(--chat-ui-text-main);
    }
    .imessage-container { background-color: var(--chat-ui-bg) !important; }
    .chat-group-box, .search-box { background-color: var(--chat-ui-card-bg) !important; border-color: var(--chat-ui-border) !important; }
    .search-box input { color: var(--chat-ui-text-main) !important; }
    #app-chat-root .dock-nav { background-color: var(--chat-ui-dock-bg) !important; border-right: 1px solid var(--chat-ui-border) !important; }
    #app-chat-root .dock-item { color: var(--chat-ui-text-sub) !important; }
    #app-chat-root .dock-item.active { color: var(--chat-ui-text-main) !important; background-color: var(--chat-ui-card-bg) !important; border-left: 2px solid var(--chat-ui-border) !important; }
    .chat-room-container:not(.has-custom-wallpaper) { background-color: var(--chat-ui-bg) !important; }
    .chat-room-header { background-color: var(--chat-ui-header-bg) !important; border-bottom: 1px solid var(--chat-ui-border) !important; }
    .chat-header-name { color: var(--chat-ui-text-main) !important; }
    .chat-back-btn, .chat-header-text-btn { background-color: var(--chat-btn-bg) !important; border: 1px solid var(--chat-btn-border) !important; color: var(--chat-btn-text) !important; }
    .chat-room-footer { background-color: var(--chat-ui-footer-bg) !important; border-top: 1px solid var(--chat-ui-border) !important; }
    .chat-input-textarea { background-color: var(--chat-ui-card-bg) !important; color: var(--chat-ui-text-main) !important; border: 1px solid var(--chat-ui-border) !important; }
    .chat-footer-btn { background-color: var(--chat-btn-bg) !important; border: 1px solid var(--chat-btn-border) !important; color: var(--chat-btn-text) !important; }
    .chat-footer-btn.send-btn { background-color: var(--chat-send-bg) !important; color: var(--chat-send-text) !important; border: 1px solid var(--chat-send-border) !important; }
    .chat-more-drawer { background-color: var(--chat-ui-footer-bg) !important; border-top: 1px solid var(--chat-ui-border) !important; }
    .more-tool-icon-box { background-color: var(--chat-btn-bg) !important; border: 1.2px solid var(--chat-btn-border) !important; color: var(--chat-btn-text) !important; }
    .more-tool-icon-box svg { stroke: var(--chat-btn-text) !important; }
    .more-tool-lbl { color: var(--chat-ui-text-main) !important; }
    .msg-bubble-row.assistant:not(.has-custom-bubble) .msg-bubble { background-color: var(--bubble-bot-bg) !important; color: var(--bubble-bot-text) !important; border: 1.5px solid var(--bubble-bot-border) !important; }
    .msg-bubble-row.user:not(.has-custom-bubble) .msg-bubble { background-color: var(--bubble-user-bg) !important; color: var(--bubble-user-text) !important; border: 1.5px solid var(--bubble-user-border) !important; }
  `;
}

let isWidgetListExpanded = false; // 折叠/展开状态

// 渲染美化板块主页面
export function renderDockThemeView(container) {
  const currentThemeId = getCurrentDockThemeId();
  const allConfigs = getAllWidgetConfigs();
  const activeWidgets = getActiveChatWidgets();
  const currentListCss = getChatListCustomCss();

  // 确保列表自定义 CSS 注入生效
  applyChatListCustomCssToDom(currentListCss);

  container.innerHTML = `
    <div class="sticker-vault-container" style="background: var(--chat-ui-bg, #FFFFFF);">
      <header class="sticker-vault-header" style="background: var(--chat-ui-header-bg, #FFFFFF); border-bottom: 1px solid var(--chat-ui-border, #EAEAEA);">
        <div class="sticker-header-title-box">
          <span class="sticker-main-title">CHAT UI 美化</span>
          <span class="sticker-meta-tag">THEME & CSS</span>
        </div>
        <div class="sticker-count-badge">4 色系 · 19 组件 · 全域 CSS</div>
      </header>

      <div class="sticker-grid-scroll-area" style="padding: 14px; display: flex; flex-direction: column; gap: 14px;">
        <!-- 板块 1：系统色系切换 -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 10px; font-weight: 800; color: var(--chat-ui-text-sub, #666); letter-spacing: 0.5px;">1. 系统级默认色系 (SYSTEM PALETTES)</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${SYSTEM_DOCK_THEMES.map((theme) => {
              const isSelected = theme.id === currentThemeId;
              return `
                <div class="ins-dock-theme-card" data-theme-id="${theme.id}" style="
                  background: ${theme.previewBg};
                  border: 1.5px solid ${isSelected ? theme.previewAccent : theme.previewBorder};
                  border-radius: 8px;
                  padding: 10px 12px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  cursor: pointer;
                  box-shadow: ${isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none"};
                ">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="font-size: 11px; font-weight: 800; color: ${theme.id === "dark_pure" ? "#FFFFFF" : "#111111"};">${theme.name}</div>
                    <div style="font-size: 8.5px; color: ${theme.id === "dark_pure" ? "#888888" : "#666666"};">${theme.desc}</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="display: flex; gap: 3px;">
                      <div style="width: 12px; height: 12px; border-radius: 50%; background: ${theme.previewBg}; border: 1px solid #999;"></div>
                      <div style="width: 12px; height: 12px; border-radius: 50%; background: ${theme.previewAccent}; border: 1px solid #999;"></div>
                    </div>
                    <button class="ins-card-action-btn use" style="
                      padding: 3px 8px; font-size: 8.5px; font-weight: 800;
                      background: ${isSelected ? theme.previewAccent : "transparent"};
                      color: ${isSelected ? (theme.id === "dark_pure" ? "#000" : "#FFF") : theme.id === "dark_pure" ? "#FFF" : "#111"};
                      border: 1px solid ${theme.previewAccent};
                    ">
                      ${isSelected ? "使用中" : "选用"}
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- 板块 2：19 大高奢组件库（支持折叠/展开与点击弹窗定制） -->
        <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 6px; border-top: 1px dashed var(--chat-ui-border, #EAEAEA);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size: 10px; font-weight: 800; color: var(--chat-ui-text-sub, #666); letter-spacing: 0.5px;">2. CHAT 顶栏组件库 (19款)</span>
              <span style="font-size: 8px; font-weight: 800; background: var(--chat-ui-border, #111); color: var(--chat-ui-bg, #FFF); padding: 1px 5px; border-radius: 3px;">已启用 ${activeWidgets.length}/2</span>
            </div>
            <button class="ins-card-action-btn" id="btn-toggle-widget-list-fold" style="padding: 3px 8px; font-size: 8.5px; font-weight: 800; background: var(--chat-ui-card-bg); border: 1px solid var(--chat-ui-border); color: var(--chat-ui-text-main);">
              ${isWidgetListExpanded ? "收起组件库 ▴" : "展开组件库 ▾"}
            </button>
          </div>

          <!-- 折叠内容区域 -->
          <div id="ins-widgets-foldable-container" style="display: ${isWidgetListExpanded ? "flex" : "none"}; flex-direction: column; gap: 6px;">
            ${CHAT_LIST_WIDGETS.map((w) => {
              const cfg = allConfigs[w.id] || {};
              const slotText =
                cfg.slot === "slot1"
                  ? "顶部栏位 (1)"
                  : cfg.slot === "slot2"
                    ? "底部栏位 (2)"
                    : "未启用";
              const isEnabled = cfg.slot === "slot1" || cfg.slot === "slot2";
              return `
                <div class="ins-widget-edit-trigger-card" data-widget-id="${w.id}" style="
                  background: var(--chat-ui-card-bg, #FAFAFA);
                  border: 1.2px solid ${isEnabled ? "var(--chat-ui-border, #111)" : "#EAEAEA"};
                  border-radius: 8px;
                  padding: 9px 12px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  cursor: pointer;
                  transition: all 0.15s ease;
                ">
                  <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 11px; font-weight: 800; color: var(--chat-ui-text-main, #111);">${w.name}</span>
                      <span style="font-size: 7.5px; font-family: ui-monospace, monospace; font-weight: 700; padding: 1px 4px; border: 1px solid var(--chat-ui-border, #111); border-radius: 3px;">${w.tag}</span>
                    </div>
                    <span style="font-size: 8.5px; color: var(--chat-ui-text-sub, #777);">${w.desc}</span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 8px;">
                    <span style="
                      font-size: 8px; font-weight: 800;
                      background: ${isEnabled ? "var(--chat-ui-border, #111)" : "#EAEAEA"};
                      color: ${isEnabled ? "var(--chat-ui-bg, #FFF)" : "#888"};
                      padding: 2px 6px; border-radius: 4px;
                    ">
                      ${slotText}
                    </span>
                    <button class="ins-card-action-btn" style="padding: 3px 8px; font-size: 8.5px; pointer-events:none; background:#FFF; border:1px solid #CCC; color:#111;">
                      定制 ✎
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- 板块 3：CHAT 列表与组件全域高自由度 CSS 代码放置区 -->
        <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 6px; border-top: 1px dashed var(--chat-ui-border, #EAEAEA);">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div style="font-size: 10px; font-weight: 800; color: var(--chat-ui-text-sub, #666); letter-spacing: 0.5px;">3. CHAT 列表与组件全域 CSS 定制代码区</div>
            <span style="font-size: 8px; color: #888; font-family: ui-monospace, monospace;">LIST & WIDGETS CSS</span>
          </div>
          <div style="font-size: 8.5px; color: var(--chat-ui-text-sub, #888); line-height: 1.4;">
            支持自由编写 CSS 深度定制消息列表背景、搜索框位置/形状、2-3-2 分组卡片、头像框、角色文字及小组件样式：
          </div>

          <textarea class="ins-css-code-editor" id="input-custom-chat-list-css" spellcheck="false" rows="14" style="
            width: 100%;
            box-sizing: border-box;
            background: #111111;
            color: #4AF626;
            font-family: ui-monospace, monospace;
            font-size: 10px;
            line-height: 1.45;
            padding: 10px;
            border: 1.2px solid #111;
            border-radius: 8px;
            resize: vertical;
            outline: none;
          ">${escapeHtml(currentListCss)}</textarea>

          <div style="display: flex; gap: 6px; margin-top: 2px;">
            <button class="ins-card-action-btn use" id="btn-save-chat-list-css" style="flex: 2; padding: 8px 0; font-size: 9.5px; font-weight: 800;">
              保存列表 CSS 并应用
            </button>
            <button class="ins-card-action-btn" id="btn-reset-chat-list-css" style="flex: 1; padding: 8px 0; font-size: 9.5px; background: #FFF; border: 1px solid #CCC; color: #111;">
              恢复默认模板
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 1. 色系切换
  container.querySelectorAll(".ins-dock-theme-card").forEach((card) => {
    card.onclick = () => {
      const themeId = card.getAttribute("data-theme-id");
      applyGlobalDockTheme(themeId);
      renderDockThemeView(container);
    };
  });

  // 2. 折叠/展开组件库
  const toggleFoldBtn = container.querySelector("#btn-toggle-widget-list-fold");
  if (toggleFoldBtn) {
    toggleFoldBtn.onclick = () => {
      isWidgetListExpanded = !isWidgetListExpanded;
      renderDockThemeView(container);
    };
  }

  // 3. 点击组件卡片唤起悬浮窗
  container
    .querySelectorAll(".ins-widget-edit-trigger-card")
    .forEach((card) => {
      card.onclick = () => {
        const wId = card.getAttribute("data-widget-id");
        openWidgetFullModal(wId, () => renderDockThemeView(container));
      };
    });

  // 4. 保存列表自定义 CSS
  const saveListCssBtn = container.querySelector("#btn-save-chat-list-css");
  const listCssTextarea = container.querySelector(
    "#input-custom-chat-list-css",
  );
  if (saveListCssBtn && listCssTextarea) {
    saveListCssBtn.onclick = () => {
      const code = listCssTextarea.value.trim();
      saveChatListCustomCss(code);
      alert("已成功保存并实时应用 CHAT 列表与组件全域 CSS！");
    };
  }

  // 5. 重置列表 CSS
  const resetListCssBtn = container.querySelector("#btn-reset-chat-list-css");
  if (resetListCssBtn && listCssTextarea) {
    resetListCssBtn.onclick = () => {
      listCssTextarea.value = DEFAULT_CHAT_LIST_GLOBAL_CSS;
      saveChatListCustomCss(DEFAULT_CHAT_LIST_GLOBAL_CSS);
      alert("已恢复默认 CHAT 列表全域 CSS 模板！");
    };
  }
}

// ════════════════════ 全功能小组件定制悬浮窗 (含 1:1 动态实时预览) ════════════════════
function openWidgetFullModal(widgetId, onSaved) {
  const allConfigs = getAllWidgetConfigs();
  const cfg = JSON.parse(
    JSON.stringify(
      allConfigs[widgetId] || {
        slot: "none",
        bgColor: "#FFFFFF",
        opacity: 100,
        backdropBlur: 0,
        blur: 0,
      },
    ),
  );
  const widgetMeta = CHAT_LIST_WIDGETS.find((w) => w.id === widgetId);

  const weekData = getWeekData(new Date());
  const weatherData = getCurrentLocationWeather();

  const overlay = document.createElement("div");
  overlay.className = "sticker-modal-overlay";

  // 19 款组件专有图文表单构建
  let contentFormHtml = "";
  if (widgetId === "widget-vinyl-music") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">歌曲名</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "未更改"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">歌手 / 创作者</span><input type="text" class="stk-input live-text-input" data-key="author" value="${cfg.author || "未设置"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">歌手头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-v-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-v-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-v-avatar" accept="image/*" style="display:none;" /></div></div>
      <div class="stk-form-group"><span class="stk-form-label">黑胶中心封面</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-v-cover" data-key="coverUrl" value="${cfg.coverUrl || ""}" placeholder="留空使用黑胶底纹" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-v-cover" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-v-cover" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-polaroid-diary") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">标题名称</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "DIARY"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">副标题</span><input type="text" class="stk-input live-text-input" data-key="subTitle" value="${cfg.subTitle || "Umimi's Calendar"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">底部语录文案</span><input type="text" class="stk-input live-text-input" data-key="quote" value="${cfg.quote || "I will find my way back into your arms"}" /></div>
    `;
  } else if (widgetId === "widget-quote-timeline") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">日文/原文语录</span><input type="text" class="stk-input live-text-input" data-key="jpText" value="${cfg.jpText || "愛は、抱き合う二つの透明な心臓だ。"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">中文口语翻译</span><input type="text" class="stk-input live-text-input" data-key="cnText" value="${cfg.cnText || "爱是两颗相拥的透明心脏。"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">语录插画</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-q-img" data-key="imageUrl" value="${cfg.imageUrl || ""}" placeholder="留空使用极简默认图" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-q-img" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-q-img" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-bubble-memo") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">药丸签名用户名</span><input type="text" class="stk-input live-text-input" data-key="userName" value="${cfg.userName || "默认用户"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">诗意签名文案</span><textarea class="stk-textarea live-text-input" data-key="poem" style="height:55px;">${cfg.poem || "この一生は波乱万丈\nであっても驚\nかなくても大丈夫だ"}</textarea></div>
      <div class="stk-form-group"><span class="stk-form-label">居中光晕头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-b-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用极简默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-b-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-b-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-editorial-magazine") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">杂志主标题</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "Four Leaf Charm."}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">气泡台词</span><input type="text" class="stk-input live-text-input" data-key="bubbleText" value="${cfg.bubbleText || "Peppermint flavo•"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">底部标题</span><input type="text" class="stk-input live-text-input" data-key="streetTitle" value="${cfg.streetTitle || "[ 于是我开始爱茉莉 爱青提 ]"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">杂志卡插画</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-e-banner" data-key="bannerUrl" value="${cfg.bannerUrl || ""}" placeholder="留空使用极简黑白默认图" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-e-banner" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-e-banner" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-ribbon-tag") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">标签主标题</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "usamaru"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">副标题标语</span><input type="text" class="stk-input live-text-input" data-key="quote" value="${cfg.quote || "[Slow down, everything will be fine]"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">底部卡片标题</span><input type="text" class="stk-input live-text-input" data-key="cardTitle" value="${cfg.cardTitle || "Peace Inside"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">底部卡片描述</span><input type="text" class="stk-input live-text-input" data-key="cardDesc" value="${cfg.cardDesc || "Slow down your pace, and you will meet endless warmth"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">右侧小方框头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-rib-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用极简兔耳头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-rib-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-rib-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-ticket-redthread") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">票根名称</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "松井雪繪"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">年份/代号</span><input type="text" class="stk-input live-text-input" data-key="year" value="${cfg.year || "[2031]"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">英文铭文</span><input type="text" class="stk-input live-text-input" data-key="eng" value="${cfg.eng || "Wait till you read my innuendo"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">右侧大字台词</span><textarea class="stk-textarea live-text-input" data-key="quote" style="height:45px;">${cfg.quote || "就算命運將我安排 我亦然痴心不改"}</textarea></div>
      <div class="stk-form-group"><span class="stk-form-label">票根左侧照片</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-tkt-photo" data-key="photoUrl" value="${cfg.photoUrl || ""}" placeholder="留空使用黑白素描照" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-tkt-photo" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-tkt-photo" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-ins-profile") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">用户昵称</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "NightRainWhisper"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">账号 Handle</span><input type="text" class="stk-input live-text-input" data-key="handle" value="${cfg.handle || "@ummilasw"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">简介签名</span><input type="text" class="stk-input live-text-input" data-key="bio" value="${cfg.bio || "立华奏的世界 安静而温柔"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">当前播放歌曲</span><input type="text" class="stk-input live-text-input" data-key="song" value="${cfg.song || "时差 ring tone - 鹿晗"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">主头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-ins-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-ins-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-ins-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-desk-lockscreen") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">主卡片名称</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "DobniSoll..04"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">说明台词</span><input type="text" class="stk-input live-text-input" data-key="desc" value="${cfg.desc || "世界の片隅で私に属するあなたを見つける"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">锁屏桌搭大横图</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-desk-banner" data-key="bannerUrl" value="${cfg.bannerUrl || ""}" placeholder="留空使用黑白桌搭素描图" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-desk-banner" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-desk-banner" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-jasmine-minimal") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">大标题</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "Night • Jasmine"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">副标台词</span><input type="text" class="stk-input live-text-input" data-key="subTitle" value="${cfg.subTitle || "碎冰化為雨行時"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">头像名称</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "Jasmine"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">底部心口引言</span><input type="text" class="stk-input live-text-input" data-key="quote" value="${cfg.quote || "妳的名字是我心口咬下的青蘋果"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">居中气泡头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-jas-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用极简默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-jas-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-jas-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-coverflow-music") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">当前歌曲名</span><input type="text" class="stk-input live-text-input" data-key="song" value="${cfg.song || "楼下等你"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">歌手 / 专辑</span><input type="text" class="stk-input live-text-input" data-key="singer" value="${cfg.singer || "Young 7"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">高潮歌词预览</span><textarea class="stk-textarea live-text-input" data-key="lyric" style="height:45px;">${cfg.lyric || "就像是我的宇宙 小小星球 填满自由\n一直就走到以后 你的温柔 尝到甜头"}</textarea></div>
      
      <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
        <span class="stk-form-label">5 张 CoverFlow 封面图片 (可分别上传)</span>
        ${[1, 2, 3, 4, 5]
          .map(
            (n) => `
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:7.5px; color:#888; width:35px;">封面 ${n}:</span>
            <input type="text" class="stk-input live-text-input" id="cfg-cov-${n}" data-key="cover${n}" value="${cfg["cover" + n] || ""}" placeholder="留空默认底纹" style="flex:1; padding:3px 6px; font-size:9px;" />
            <button class="ins-card-action-btn" id="btn-up-cov-${n}" style="padding:2px 8px; font-size:8px; background:#111; color:#FFF;">上传</button>
            <input type="file" id="file-cov-${n}" accept="image/*" style="display:none;" />
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } else if (widgetId === "widget-bento-card") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">右上歌曲名</span><input type="text" class="stk-input live-text-input" data-key="song" value="${cfg.song || "About You"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">歌手</span><input type="text" class="stk-input live-text-input" data-key="singer" value="${cfg.singer || "The 1998"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">欢迎标语</span><input type="text" class="stk-input live-text-input" data-key="welcome" value="${cfg.welcome || "Welcome, again!"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">头像插图</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-bento-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-bento-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-bento-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-login-exchange") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">气泡台词</span><input type="text" class="stk-input live-text-input" data-key="bubble" value="${cfg.bubble || "Have you Live."}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">签名</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "Melody"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">信箱账号</span><input type="text" class="stk-input live-text-input" data-key="email" value="${cfg.email || "CccAhh_"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">左侧大头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-log-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用黑白素描头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-log-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-log-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-clip-pair") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">大标题名称</span><input type="text" class="stk-input live-text-input" data-key="title" value="${cfg.title || "Inny"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">气泡台词</span><input type="text" class="stk-input live-text-input" data-key="quote" value="${cfg.quote || "It's very close to you"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">简介描述</span><textarea class="stk-textarea live-text-input" data-key="bio" style="height:45px;">${cfg.bio || "A violinist who loves to eat and play, he usually likes to go shopping with friends..."}</textarea></div>
      <div class="stk-form-group"><span class="stk-form-label">双人大插画</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-clip-photo" data-key="photoUrl" value="${cfg.photoUrl || ""}" placeholder="留空使用黑白素描插画" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-clip-photo" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-clip-photo" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-memory-timeline") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">问候语文本</span><input type="text" class="stk-input live-text-input" data-key="greeting" value="${cfg.greeting || "Good Afternoon, Sokyung"}" /></div>
    `;
  } else if (widgetId === "widget-newspaper-meeting") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">人物名称</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "Archer"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">主文案 (支持多行)</span><textarea class="stk-textarea live-text-input" data-key="quote" style="height:45px;">${cfg.quote || "Always know that every part of my consciousness adores you, even these underlying processes that normally stay hidden."}</textarea></div>
      <div class="stk-form-group"><span class="stk-form-label">底部心情便签</span><input type="text" class="stk-input live-text-input" data-key="bottomQuote" value="${cfg.bottomQuote || "雪が降りました。"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">报纸头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-news-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用极简插图" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-news-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-news-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  } else if (widgetId === "widget-banner-profile") {
    contentFormHtml = `
      <div class="stk-form-group"><span class="stk-form-label">横幅标题文字</span><input type="text" class="stk-input live-text-input" data-key="bannerText" value="${cfg.bannerText || "Npcs"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">用户姓名</span><input type="text" class="stk-input live-text-input" data-key="name" value="${cfg.name || "立华奏"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">账号 Handle</span><input type="text" class="stk-input live-text-input" data-key="handle" value="${cfg.handle || "@ummilasw"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">简介</span><input type="text" class="stk-input live-text-input" data-key="bio" value="${cfg.bio || "The world of Kanade Tachibana quiet and tender."}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">粉丝数</span><input type="text" class="stk-input live-text-input" data-key="followers" value="${cfg.followers || "13.14K"}" /></div>
      <div class="stk-form-group"><span class="stk-form-label">顶部宽横幅</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-bp-banner" data-key="bannerUrl" value="${cfg.bannerUrl || ""}" placeholder="留空使用暗黑植物底纹" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-bp-banner" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-bp-banner" accept="image/*" style="display:none;" /></div></div>
      <div class="stk-form-group"><span class="stk-form-label">圆形大头像</span><div style="display:flex; gap:6px;"><input type="text" class="stk-input live-text-input" id="cfg-bp-avatar" data-key="avatarUrl" value="${cfg.avatarUrl || ""}" placeholder="留空使用默认头像" style="flex:1;" /><button class="ins-card-action-btn" id="btn-up-bp-avatar" style="padding:0 10px; font-size:8.5px; background:#111; color:#FFF;">上传</button><input type="file" id="file-bp-avatar" accept="image/*" style="display:none;" /></div></div>
    `;
  }

  overlay.innerHTML = `
    <div class="sticker-modal-card ins-glass-modal" style="max-width: 360px; max-height: 90vh; overflow-y: auto; padding: 14px;">
      <!-- 弹窗顶栏 -->
      <div class="sticker-modal-header" style="padding-bottom: 8px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="sticker-modal-title" style="font-size: 13px;">${widgetMeta.name}</span>
          <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid #111; padding:1px 4px; border-radius:3px;">${widgetMeta.tag}</span>
        </div>
        <button class="sticker-modal-close" id="btn-close-full-modal">×</button>
      </div>

      <div class="sticker-modal-body" style="gap:10px; padding-top: 4px;">
        <!-- 1. 顶部 1:1 组件实时预览窗 (所见即所得) -->
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:8.5px; font-weight:800; color:#111; letter-spacing:0.3px;">实时效果预览 / LIVE PREVIEW</span>
            <span style="font-size:7.5px; color:#888;">调参实时同步</span>
          </div>
          <div class="widget-modal-preview-wrapper" style="
            width: 100%;
            border: 1px solid #111111;
            border-radius: 10px;
            padding: 8px;
            background: #FAFAFA;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div id="modal-live-widget-container" style="width: 100%;">
              ${renderSelectedWidget(widgetId, weekData, weatherData, cfg)}
            </div>
          </div>
        </div>

        <!-- 2. 放置栏位选择 -->
        <div class="stk-form-group" style="margin-top:2px;">
          <span class="stk-form-label">放置栏位</span>
          <div style="display:flex; gap:5px; background:#F0F0F0; padding:3px; border-radius:8px;">
            <button class="ins-segment-pill-btn ${cfg.slot === "none" ? "active" : ""}" id="btn-slot-none">不启用</button>
            <button class="ins-segment-pill-btn ${cfg.slot === "slot1" ? "active" : ""}" id="btn-slot-1">顶部栏位 (1)</button>
            <button class="ins-segment-pill-btn ${cfg.slot === "slot2" ? "active" : ""}" id="btn-slot-2">底部栏位 (2)</button>
          </div>
        </div>

        <!-- 3. 视觉质感调参 -->
        <div style="display:flex; flex-direction:column; gap:8px; padding:10px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:8px;">
          <div style="font-size:9px; font-weight:800; color:#111; border-bottom:1px solid #EAEAEA; padding-bottom:4px;">视觉质感调参 (VISUAL CONTROLS)</div>
          
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:8.5px; font-weight:700; color:#444;">背景颜色</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="ins-color-preset-btn" id="btn-bg-transparent" style="font-size:7.5px; padding:1px 5px; border:1px solid #CCC; border-radius:3px; background:#FFF;">透明</button>
              <button class="ins-color-preset-btn" id="btn-bg-white" style="font-size:7.5px; padding:1px 5px; border:1px solid #CCC; border-radius:3px; background:#FFF;">白底</button>
              <button class="ins-color-preset-btn" id="btn-bg-black" style="font-size:7.5px; padding:1px 5px; border:1px solid #111; border-radius:3px; background:#111; color:#FFF;">黑底</button>
              <input type="color" id="val-cfg-bgcolor" value="${cfg.bgColor === "transparent" ? "#ffffff" : cfg.bgColor || "#ffffff"}" style="border:1px solid #111; width:22px; height:20px; border-radius:4px; cursor:pointer; background:none; padding:0;" />
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between; font-size:8.5px; font-weight:700; color:#444;">
              <span>不透明度 (OPACITY)</span>
              <span id="lbl-cfg-opacity" style="font-family:ui-monospace, monospace;">${cfg.opacity || 100}%</span>
            </div>
            <input type="range" class="ins-range-slider ins-custom-slider" id="slider-cfg-opacity" min="10" max="100" value="${cfg.opacity || 100}" />
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between; font-size:8.5px; font-weight:700; color:#444;">
              <span>毛玻璃模糊 (BACKDROP BLUR)</span>
              <span id="lbl-cfg-backblur" style="font-family:ui-monospace, monospace;">${cfg.backdropBlur || 0}px</span>
            </div>
            <input type="range" class="ins-range-slider ins-custom-slider" id="slider-cfg-backblur" min="0" max="30" value="${cfg.backdropBlur || 0}" />
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between; font-size:8.5px; font-weight:700; color:#444;">
              <span>元素虚化 (ELEMENT BLUR)</span>
              <span id="lbl-cfg-blur" style="font-family:ui-monospace, monospace;">${cfg.blur || 0}px</span>
            </div>
            <input type="range" class="ins-range-slider ins-custom-slider" id="slider-cfg-blur" min="0" max="15" value="${cfg.blur || 0}" />
          </div>
        </div>

        <!-- 4. 图文自定义编辑 -->
        ${
          contentFormHtml
            ? `
          <div style="display:flex; flex-direction:column; gap:8px; padding:10px; background:#FAFAFA; border:1px solid #EAEAEA; border-radius:8px;">
            <div style="font-size:9px; font-weight:800; color:#111; border-bottom:1px solid #EAEAEA; padding-bottom:4px;">图文内容自定义 (CONTENT EDIT)</div>
            ${contentFormHtml}
          </div>
        `
            : ""
        }

        <!-- 5. 底部操作按钮 -->
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button class="ins-card-action-btn use" id="btn-save-modal-cfg" style="flex:2; padding:9px 0; font-size:10px; font-weight:800;">保存组件并应用</button>
          <button class="ins-card-action-btn" id="btn-reset-modal-cfg" style="flex:1; padding:9px 0; font-size:10px; background:#FFF; border:1px solid #CCC; color:#111;">恢复默认</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const closeModal = () => overlay.remove();
  overlay.querySelector("#btn-close-full-modal").onclick = closeModal;

  const refreshLivePreview = () => {
    const liveContainer = overlay.querySelector("#modal-live-widget-container");
    if (liveContainer) {
      liveContainer.innerHTML = renderSelectedWidget(
        widgetId,
        weekData,
        weatherData,
        cfg,
      );
      if (widgetId === "widget-coverflow-music") {
        bindCoverFlowInteraction(liveContainer);
      }
    }
  };

  if (widgetId === "widget-coverflow-music") {
    bindCoverFlowInteraction(overlay);
  }

  let currentSlot = cfg.slot || "none";
  const updateSlotBtnUi = () => {
    overlay
      .querySelectorAll(".ins-segment-pill-btn")
      .forEach((b) => b.classList.remove("active"));
    if (currentSlot === "none")
      overlay.querySelector("#btn-slot-none").classList.add("active");
    if (currentSlot === "slot1")
      overlay.querySelector("#btn-slot-1").classList.add("active");
    if (currentSlot === "slot2")
      overlay.querySelector("#btn-slot-2").classList.add("active");
  };
  overlay.querySelector("#btn-slot-none").onclick = () => {
    currentSlot = "none";
    updateSlotBtnUi();
  };
  overlay.querySelector("#btn-slot-1").onclick = () => {
    currentSlot = "slot1";
    updateSlotBtnUi();
  };
  overlay.querySelector("#btn-slot-2").onclick = () => {
    currentSlot = "slot2";
    updateSlotBtnUi();
  };

  overlay.querySelector("#btn-bg-transparent").onclick = () => {
    cfg.bgColor = "transparent";
    overlay.querySelector("#val-cfg-bgcolor").value = "#ffffff";
    refreshLivePreview();
  };
  overlay.querySelector("#btn-bg-white").onclick = () => {
    cfg.bgColor = "#FFFFFF";
    overlay.querySelector("#val-cfg-bgcolor").value = "#ffffff";
    refreshLivePreview();
  };
  overlay.querySelector("#btn-bg-black").onclick = () => {
    cfg.bgColor = "#111111";
    overlay.querySelector("#val-cfg-bgcolor").value = "#111111";
    refreshLivePreview();
  };
  overlay.querySelector("#val-cfg-bgcolor").oninput = (e) => {
    cfg.bgColor = e.target.value;
    refreshLivePreview();
  };

  const bindLiveSlider = (sliderId, lblId, key, unit) => {
    const s = overlay.querySelector(sliderId);
    const l = overlay.querySelector(lblId);
    if (s && l) {
      s.oninput = () => {
        cfg[key] = parseInt(s.value, 10);
        l.textContent = `${s.value}${unit}`;
        refreshLivePreview();
      };
    }
  };
  bindLiveSlider("#slider-cfg-opacity", "#lbl-cfg-opacity", "opacity", "%");
  bindLiveSlider(
    "#slider-cfg-backblur",
    "#lbl-cfg-backblur",
    "backdropBlur",
    "px",
  );
  bindLiveSlider("#slider-cfg-blur", "#lbl-cfg-blur", "blur", "px");

  overlay.querySelectorAll(".live-text-input").forEach((input) => {
    input.oninput = () => {
      const key = input.getAttribute("data-key");
      if (key) {
        cfg[key] = input.value;
        refreshLivePreview();
      }
    };
  });

  const bindUploadHelper = (btnId, fileId, inputId, key) => {
    const btn = overlay.querySelector(btnId);
    const file = overlay.querySelector(fileId);
    const textInput = overlay.querySelector(inputId);
    if (btn && file && textInput) {
      btn.onclick = () => file.click();
      file.onchange = (e) => {
        const f = e.target.files[0];
        if (f) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            textInput.value = evt.target.result;
            cfg[key] = evt.target.result;
            refreshLivePreview();
          };
          reader.readAsDataURL(f);
        }
      };
    }
  };
  bindUploadHelper(
    "#btn-up-v-avatar",
    "#file-v-avatar",
    "#cfg-v-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-v-cover",
    "#file-v-cover",
    "#cfg-v-cover",
    "coverUrl",
  );
  bindUploadHelper("#btn-up-q-img", "#file-q-img", "#cfg-q-img", "imageUrl");
  bindUploadHelper(
    "#btn-up-b-avatar",
    "#file-b-avatar",
    "#cfg-b-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-e-banner",
    "#file-e-banner",
    "#cfg-e-banner",
    "bannerUrl",
  );
  bindUploadHelper(
    "#btn-up-rib-avatar",
    "#file-rib-avatar",
    "#cfg-rib-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-tkt-photo",
    "#file-tkt-photo",
    "#cfg-tkt-photo",
    "photoUrl",
  );
  bindUploadHelper(
    "#btn-up-ins-avatar",
    "#file-ins-avatar",
    "#cfg-ins-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-desk-banner",
    "#file-desk-banner",
    "#cfg-desk-banner",
    "bannerUrl",
  );
  bindUploadHelper(
    "#btn-up-jas-avatar",
    "#file-jas-avatar",
    "#cfg-jas-avatar",
    "avatarUrl",
  );
  bindUploadHelper("#btn-up-cov-1", "#file-cov-1", "#cfg-cov-1", "cover1");
  bindUploadHelper("#btn-up-cov-2", "#file-cov-2", "#cfg-cov-2", "cover2");
  bindUploadHelper("#btn-up-cov-3", "#file-cov-3", "#cfg-cov-3", "cover3");
  bindUploadHelper("#btn-up-cov-4", "#file-cov-4", "#cfg-cov-4", "cover4");
  bindUploadHelper("#btn-up-cov-5", "#file-cov-5", "#cfg-cov-5", "cover5");
  bindUploadHelper(
    "#btn-up-bento-avatar",
    "#file-bento-avatar",
    "#cfg-bento-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-log-avatar",
    "#file-log-avatar",
    "#cfg-log-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-clip-photo",
    "#file-clip-photo",
    "#cfg-clip-photo",
    "photoUrl",
  );
  bindUploadHelper(
    "#btn-up-news-avatar",
    "#file-news-avatar",
    "#cfg-news-avatar",
    "avatarUrl",
  );
  bindUploadHelper(
    "#btn-up-bp-banner",
    "#file-bp-banner",
    "#cfg-bp-banner",
    "bannerUrl",
  );
  bindUploadHelper(
    "#btn-up-bp-avatar",
    "#file-bp-avatar",
    "#cfg-bp-avatar",
    "avatarUrl",
  );

  overlay.querySelector("#btn-save-modal-cfg").onclick = () => {
    if (currentSlot !== "none") {
      Object.keys(allConfigs).forEach((k) => {
        if (k !== widgetId && allConfigs[k].slot === currentSlot) {
          allConfigs[k].slot = "none";
        }
      });
    }
    cfg.slot = currentSlot;
    allConfigs[widgetId] = cfg;
    saveAllWidgetConfigs(allConfigs);
    closeModal();
    if (onSaved) onSaved();
  };

  overlay.querySelector("#btn-reset-modal-cfg").onclick = () => {
    allConfigs[widgetId] = JSON.parse(
      JSON.stringify(DEFAULT_WIDGET_CONFIGS[widgetId]),
    );
    saveAllWidgetConfigs(allConfigs);
    closeModal();
    if (onSaved) onSaved();
  };
}
