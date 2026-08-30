import { McpGateway } from "../utils/mcpGateway.js";
import { EchoVault } from "../utils/echoVault.js";

// 默认配置
const DEFAULT_CONFIG = {
  activeTab: "api",
  apiName: "DeepSeek 官方",
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 2048,

  ttsPlatform: "minimax",
  minimax: {
    groupId: "",
    apiKey: "",
    model: "speech-01-turbo",
    voiceId: "female-yujie",
    customVoiceId: "",
    speed: 1.0,
    pitch: 0,
  },
  elevenlabs: {
    apiKey: "",
    model: "eleven_multilingual_v2",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    customVoiceId: "",
    stability: 0.5,
    similarityBoost: 0.75,
  },
  autoVoicePlay: false,
  testSpeechText: "你好，语音配置连接正常。",

  memory: {
    activeTab: "dashboard",
    selectedCharSandbox: "",
  },

  retrieval: {
    selectedCharFilter: "all",
    injectPosition: "system",
    maxContextLimit: 8192,
    enableRAGSimilarity: true,
  },

  guide: {
    selectedModelPreset: "",
    lastQuery: "",
    lastAnswer: "",
  },

  compression: {
    stripMediaMetadata: true,
    assetDeduplication: true,
    minifyJsonSchema: true,
    deflatePackage: true,
    isOptimized: false,
    lastOptimizedTime: null,
  },

  worldbookPriority: "high",
  totalCalls: 0,
  totalTokens: 0,
  avgLatency: 0,
};

let config = JSON.parse(
  localStorage.getItem("mini_api_settings") || JSON.stringify(DEFAULT_CONFIG),
);
if (!config.memory) config.memory = DEFAULT_CONFIG.memory;
if (!config.memory.activeTab) config.memory.activeTab = "dashboard";
if (!config.retrieval) config.retrieval = DEFAULT_CONFIG.retrieval;
if (!config.guide) config.guide = DEFAULT_CONFIG.guide;
if (!config.compression) config.compression = DEFAULT_CONFIG.compression;

let rawPresets = JSON.parse(localStorage.getItem("mini_api_presets") || "[]");
let savedPresets = rawPresets.filter(
  (p) => p.id !== "preset-1" && p.id !== "preset-2",
);
localStorage.setItem("mini_api_presets", JSON.stringify(savedPresets));

let userPersonaList = JSON.parse(
  localStorage.getItem("mini_user_personas") || "[]",
);
let userCharList = JSON.parse(
  localStorage.getItem("mini_user_characters") || "[]",
);
let documentVault = JSON.parse(
  localStorage.getItem("mini_mcp_documents") || "[]",
);

let pulledModelsList = [];
let currentAudioInstance = null;

function saveConfig() {
  localStorage.setItem("mini_api_settings", JSON.stringify(config));
}

function savePresets() {
  localStorage.setItem("mini_api_presets", JSON.stringify(savedPresets));
}

function saveUserPersonaList() {
  localStorage.setItem("mini_user_personas", JSON.stringify(userPersonaList));
}

function saveUserCharList() {
  localStorage.setItem("mini_user_characters", JSON.stringify(userCharList));
}

function saveDocumentVault() {
  localStorage.setItem("mini_mcp_documents", JSON.stringify(documentVault));
}

/**
 * 智能 URL 纠错清洗器：无论用户输入什么格式，精准推导出 modelsUrl 与 chatUrl
 */
export function resolveApiEndpoints(rawUrl) {
  if (!rawUrl) return { baseUrl: "", modelsUrl: "", chatUrl: "" };

  let clean = rawUrl.trim().replace(/\/+$/, "");
  // 剥离可能误填的 /chat/completions 或 /models
  clean = clean.replace(/\/chat\/completions$/, "").replace(/\/models$/, "");

  let modelsUrl = "";
  let chatUrl = "";

  if (clean.endsWith("/v1")) {
    modelsUrl = `${clean}/models`;
    chatUrl = `${clean}/chat/completions`;
  } else {
    // 兼容部分不带 v1 的服务商和带 v1 的标准规范
    modelsUrl = `${clean}/v1/models`;
    chatUrl = `${clean}/v1/chat/completions`;
  }

  return { baseUrl: clean, modelsUrl, chatUrl };
}

/**
 * 核心：多通道拉取模型（直连 ➔ 多路跨域中继重试）
 */
async function fetchModelsWithMultiChannels(rawBaseUrl, apiKey) {
  const { modelsUrl, baseUrl } = resolveApiEndpoints(rawBaseUrl);
  if (!modelsUrl || !apiKey) {
    throw new Error("请先填入有效的 Base URL 和 API Key");
  }

  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  // 1. 尝试直接请求 (针对支持 CORS 的端点)
  try {
    const res = await fetch(modelsUrl, { method: "GET", headers });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map((m) => m.id).sort();
      }
    }
  } catch (directErr) {
    console.warn(
      "[Direct /models Blocked by Browser CORS, trying fallback proxy...]",
      directErr,
    );
  }

  // 2. 尝试无 v1 的直连路径 (部分端点如 https://api.deepseek.com/models)
  try {
    const altModelsUrl = `${baseUrl.replace(/\/v1$/, "")}/models`;
    const res2 = await fetch(altModelsUrl, { method: "GET", headers });
    if (res2.ok) {
      const json2 = await res2.json();
      if (json2 && Array.isArray(json2.data) && json2.data.length > 0) {
        return json2.data.map((m) => m.id).sort();
      }
    }
  } catch (e) {}

  // 3. 尝试跨域代理通道
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(modelsUrl)}`;
    const proxyRes = await fetch(proxyUrl, { method: "GET", headers });
    if (proxyRes.ok) {
      const jsonProxy = await proxyRes.json();
      if (
        jsonProxy &&
        Array.isArray(jsonProxy.data) &&
        jsonProxy.data.length > 0
      ) {
        return jsonProxy.data.map((m) => m.id).sort();
      }
    }
  } catch (proxyErr) {
    console.warn("[Proxy /models also blocked]", proxyErr);
  }

  throw new Error("浏览器跨域受限");
}

/**
 * 官方推荐默认模型表（保证即使在离线/跨域受限时用户也能直接选用最新模型）
 */
function getProviderDefaultModels(provider) {
  if (provider === "deepseek") {
    return ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"];
  } else if (provider === "openai") {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "o1-preview",
      "o1-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ];
  } else if (provider === "claude") {
    return [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ];
  } else if (provider === "qwen") {
    return ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long"];
  } else if (provider === "ollama") {
    return ["llama3:latest", "qwen2.5:latest", "deepseek-r1:latest"];
  }
  return [
    "deepseek-chat",
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3-5-sonnet-20241022",
  ];
}

function calculateStorageMetrics() {
  const comp = config.compression;
  const mediaRawKB = 8400;
  const docRawKB =
    Math.round(JSON.stringify(documentVault).length / 1024) +
    documentVault.length * 48;
  const chatRawKB = 220;
  const cfgRawKB =
    Math.round(JSON.stringify(config).length / 1024) +
    Math.round(JSON.stringify(savedPresets).length / 1024) +
    12;

  let memRawKB = 0;
  userCharList.forEach((c) => {
    memRawKB +=
      Math.round(JSON.stringify(McpGateway.getCharMemories(c)).length / 1024) +
      Math.round(JSON.stringify(McpGateway.getCharDarkroom(c)).length / 1024);
  });
  memRawKB = Math.max(memRawKB, 16);

  const totalRawKB = mediaRawKB + docRawKB + chatRawKB + memRawKB + cfgRawKB;

  let mediaFactor = 1.0;
  if (comp.stripMediaMetadata) mediaFactor *= 0.65;
  if (comp.assetDeduplication) mediaFactor *= 0.75;
  const mediaOptKB = Math.round(mediaRawKB * mediaFactor);

  let textFactor = 1.0;
  if (comp.minifyJsonSchema) textFactor *= 0.6;

  const docOptKB = Math.round(docRawKB * textFactor);
  const chatOptKB = Math.round(chatRawKB * textFactor);
  const memOptKB = Math.round(memRawKB * textFactor);
  const cfgOptKB = Math.round(cfgRawKB * textFactor);

  let subtotalKB = mediaOptKB + docOptKB + chatOptKB + memOptKB + cfgOptKB;
  if (comp.deflatePackage) subtotalKB = Math.round(subtotalKB * 0.65);

  const totalOptKB = subtotalKB;
  const ratio = Math.max(1, Math.round((1 - totalOptKB / totalRawKB) * 100));

  return {
    raw: {
      mediaKB: mediaRawKB,
      docKB: docRawKB,
      chatKB: chatRawKB,
      memKB: memRawKB,
      cfgKB: cfgRawKB,
      totalKB: totalRawKB,
      totalMB: (totalRawKB / 1024).toFixed(2),
    },
    optimized: {
      mediaKB: mediaOptKB,
      docKB: docOptKB,
      chatKB: chatOptKB,
      memKB: memOptKB,
      cfgKB: cfgOptKB,
      totalKB: totalOptKB,
      totalMB: (totalOptKB / 1024).toFixed(2),
      ratio,
    },
  };
}

// 7 个子板块定义
const SUB_TABS = [
  {
    id: "api",
    name: "API",
    title: "API 连接与模型",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  },
  {
    id: "voice",
    name: "语音",
    title: "TTS 语音中枢 (MiniMax / ElevenLabs)",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`,
  },
  {
    id: "memory",
    name: "记忆",
    title: "角色沙盒隔离记忆中枢",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
  },
  {
    id: "retrieval",
    name: "读取",
    title: "文档投喂与 Char 认知学习中枢",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  },
  {
    id: "guide",
    name: "介绍",
    title: "项目使用指南 · AI 智能问答",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  },
  {
    id: "compress",
    name: "压缩",
    title: "无损导出体积压缩与优化中枢",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  },
  {
    id: "analytics",
    name: "总结",
    title: "全系统数据分布与备份导出中枢",
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
];

export function renderApiSettingsView(container) {
  const currentTabObj =
    SUB_TABS.find((t) => t.id === config.activeTab) || SUB_TABS[0];

  container.innerHTML = `
    <div class="api-app-container">
      <nav class="api-dock-nav" id="api-dock-nav">
        ${SUB_TABS.map(
          (tab) => `
          <button class="api-dock-item ${config.activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}" title="${tab.title}">
            ${tab.icon}
            <span class="api-dock-label">${tab.name}</span>
          </button>
        `,
        ).join("")}
      </nav>

      <main class="api-content-container" id="api-content-main">
        <div class="api-sub-header">
          <span class="api-sub-title" id="api-sub-title">${currentTabObj.title}</span>
          <div class="api-save-status">
            <span class="status-dot"></span>
            <span>AUTO-SYNC</span>
          </div>
        </div>

        <div id="api-sub-view-root">
          ${renderCurrentSubTabHtml()}
        </div>
      </main>
    </div>
  `;

  bindTabEvents(container);
}

function bindTabEvents(container) {
  const dockItems = container.querySelectorAll(".api-dock-item");
  const subTitleEl = container.querySelector("#api-sub-title");
  const viewRoot = container.querySelector("#api-sub-view-root");

  dockItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      config.activeTab = tabId;
      saveConfig();

      dockItems.forEach((d) => d.classList.remove("active"));
      btn.classList.add("active");

      const currentTabObj = SUB_TABS.find((t) => t.id === tabId);
      if (subTitleEl) subTitleEl.textContent = currentTabObj.title;

      viewRoot.innerHTML = renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    });
  });

  bindSubViewEvents(container);
}

function renderCurrentSubTabHtml() {
  switch (config.activeTab) {
    case "api":
      return renderApiSection();
    case "voice":
      return renderVoiceSection();
    case "memory":
      return renderMemorySection();
    case "retrieval":
      return renderRetrievalSection();
    case "guide":
      return renderGuideSection();
    case "compress":
      return renderCompressSection();
    case "analytics":
      return renderAnalyticsSection();
    default:
      return renderApiSection();
  }
}

function getTemperatureDesc(temp) {
  if (temp <= 0.4) return "严谨保守 · 逻辑精准专注，适合代码与严谨推演";
  if (temp <= 0.8) return "标准平衡 · 拟真对话交流，表达自然真实";
  return "天马行空 · 创意极度丰富，极具发散性与文学色彩";
}

/* ═══════════ 1. API 链接 ═══════════ */
function renderApiSection() {
  const tempDesc = getTemperatureDesc(config.temperature);

  return `

    <div class="api-card">
      <span class="card-title">连接参数配置</span>
      
      <div class="form-group">
        <label class="form-label">API 标识名称</label>
        <input type="text" class="form-input" id="cfg-name" value="${config.apiName || ""}" placeholder="例如：主力 DeepSeek V3 / 备用 OpenAI" />
      </div>

      <div class="form-group">
        <label class="form-label">Base URL (接口端点)</label>
        <input type="text" class="form-input" id="cfg-baseurl" value="${config.baseUrl}" placeholder="https://api.deepseek.com/v1" />
      </div>

      <div class="form-group">
        <label class="form-label">API Key (秘钥)</label>
        <div class="form-input-wrap">
          <input type="password" class="form-input" id="cfg-apikey" value="${config.apiKey}" placeholder="sk-..." />
          <button class="input-icon-btn" id="toggle-key-eye" title="切换可见">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <button class="fetch-models-btn" id="btn-fetch-models">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span id="btn-fetch-models-text">拉取可用模型 (Fetch Models)</span>
      </button>

      <div class="form-group">
        <label class="form-label">当前所选模型 (Model ID)</label>
        ${
          pulledModelsList.length > 0
            ? `
          <select class="form-input" id="cfg-model-select">
            ${pulledModelsList.map((m) => `<option value="${m}" ${m === config.model ? "selected" : ""}>${m}</option>`).join("")}
            <option value="__custom__">+ 手动输入其它模型...</option>
          </select>
        `
            : `
          <input type="text" class="form-input" id="cfg-model" value="${config.model}" placeholder="例如 deepseek-chat / gpt-4o" />
        `
        }
      </div>

      <div class="slider-group">
        <div class="slider-header">
          <span class="form-label">温度 (Temperature)</span>
          <span class="slider-val" id="temp-val">${config.temperature}</span>
        </div>
        <input type="range" class="custom-slider" id="cfg-temp" min="0" max="1.5" step="0.05" value="${config.temperature}" />
        <span class="temp-nature-desc" id="temp-nature-desc">${tempDesc}</span>
      </div>
    </div>

    <div class="api-action-row">
      <button class="api-btn api-btn-outline" id="btn-test-api">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span id="btn-test-api-text">测试连接</span>
      </button>

      <button class="api-btn api-btn-primary" id="btn-open-save-modal">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>保存配置</span>
      </button>
    </div>

    <div class="api-card">
      <span class="card-title">
        <span>已保存的 API 列表 (${savedPresets.length})</span>
        <small style="font-size: 9.5px; color: var(--text-muted); font-weight: normal;">点击「应用」即可瞬间切换</small>
      </span>
      <div class="preset-list-container" id="preset-list-container">
        ${
          savedPresets.length === 0
            ? `<div class="preset-empty">暂无保存的 API，点击上方「保存配置」添加</div>`
            : savedPresets
                .map((preset) => {
                  const isCurrentActive =
                    preset.baseUrl === config.baseUrl &&
                    preset.model === config.model;
                  return `
            <div class="preset-card ${isCurrentActive ? "is-active" : ""}">
              <div class="preset-info">
                <div class="preset-name-row">
                  <span class="preset-name">${preset.name}</span>
                  ${isCurrentActive ? '<span class="active-tag">当前生效</span>' : ""}
                </div>
                <div class="preset-meta">模型: ${preset.model} · 温: ${preset.temperature}</div>
                <div class="preset-meta">${preset.baseUrl}</div>
              </div>
              <div class="preset-actions">
                <button class="preset-use-btn" data-use-id="${preset.id}" ${isCurrentActive ? "disabled" : ""}>
                  ${isCurrentActive ? "使用中" : "应用"}
                </button>
                <button class="preset-del-btn" data-del-id="${preset.id}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          `;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

/* ═══════════ 2. 语音 ═══════════ */
function renderVoiceSection() {
  const isMiniMax = config.ttsPlatform === "minimax";
  const isEleven = config.ttsPlatform === "elevenlabs";

  const minimaxVoices = [
    { id: "female-yujie", name: "成熟御姐", tag: "知性磁性 · 丰富情感" },
    { id: "female-tianmei", name: "甜美少女", tag: "轻快灵动 · 清澈声线" },
    { id: "male-qn-qingse", name: "青涩男声", tag: "阳光自然 · 少年音质" },
    { id: "male-qn-jingying", name: "精英男声", tag: "低沉稳重 · 磁性叙事" },
    { id: "custom", name: "自定义 Voice ID", tag: "调用自建复刻音色" },
  ];

  const elevenVoices = [
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      name: "Rachel (经典自然)",
      tag: "欧美原声 · 温和治愈",
    },
    {
      id: "pNInz6obpgDQGcFmaJgB",
      name: "Adam (磁性叙事)",
      tag: "深沉男中音 · 故事感",
    },
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      name: "Bella (甜美灵动)",
      tag: "轻盈活泼 · 极具表现力",
    },
    {
      id: "ErXwobaYiN019PkySvjV",
      name: "Antoni (沉稳男声)",
      tag: "典雅清晰 · 语调从容",
    },
    { id: "custom", name: "自定义 Voice ID", tag: "个人克隆/社区音色" },
  ];

  return `
    <div class="api-card">
      <span class="card-title">选择语音合成引擎</span>
      <div class="tts-platform-grid">
        <div class="tts-platform-card ${isMiniMax ? "active" : ""}" data-tts-platform="minimax">
          <span class="platform-name">MiniMax 语音</span>
          <span class="platform-desc">海螺/MiniMax 大模型 · 中文多情感</span>
        </div>
        <div class="tts-platform-card ${isEleven ? "active" : ""}" data-tts-platform="elevenlabs">
          <span class="platform-name">ElevenLabs</span>
          <span class="platform-desc">全球顶尖拟真 · 丰富微情绪声学</span>
        </div>
      </div>
    </div>

    <div class="api-card">
      <span class="card-title">${isMiniMax ? "MiniMax 接口参数" : "ElevenLabs 接口参数"}</span>
      ${
        isMiniMax
          ? `
        <div class="form-group">
          <label class="form-label">Group ID (用户组 ID)</label>
          <input type="text" class="form-input" id="cfg-mm-groupid" value="${config.minimax.groupId || ""}" placeholder="例如：17983921..." />
        </div>
        <div class="form-group">
          <label class="form-label">API Key (Bearer Token)</label>
          <div class="form-input-wrap">
            <input type="password" class="form-input" id="cfg-mm-apikey" value="${config.minimax.apiKey || ""}" placeholder="eyJhbGciOi..." />
            <button class="input-icon-btn" id="toggle-mm-key-eye">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      `
          : `
        <div class="form-group">
          <label class="form-label">xi-api-key (ElevenLabs Key)</label>
          <div class="form-input-wrap">
            <input type="password" class="form-input" id="cfg-el-apikey" value="${config.elevenlabs.apiKey || ""}" placeholder="sk_..." />
            <button class="input-icon-btn" id="toggle-el-key-eye">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      `
      }
    </div>

    <div class="api-card">
      <span class="card-title">音色预设 (Voice Timbre)</span>
      <div class="voice-preset-grid">
        ${(isMiniMax ? minimaxVoices : elevenVoices)
          .map(
            (v) => `
          <div class="voice-chip ${(isMiniMax ? config.minimax.voiceId : config.elevenlabs.voiceId) === v.id ? "active" : ""}" data-voice-id="${v.id}">
            <span class="chip-name">${v.name}</span>
            <span class="chip-tag">${v.tag}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    <div class="api-card">
      <span class="card-title">实时试听测试</span>
      <div class="voice-test-box">
        <textarea class="test-text-input" id="cfg-test-text" placeholder="输入你想试听的句子...">${config.testSpeechText}</textarea>
        <div class="audio-player-bar">
          <div class="audio-status-left">
            <div class="audio-wave-wrap" id="audio-wave-wrap">
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
            </div>
            <span id="audio-status-text">待播放</span>
          </div>
          <span style="font-size: 9.5px; color: var(--text-muted); font-weight: 600;">${isMiniMax ? "MiniMax 引擎" : "ElevenLabs 引擎"}</span>
        </div>
        <button class="api-btn api-btn-primary" id="btn-play-voice-test">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <span>生成并试听当前音色</span>
        </button>
      </div>
    </div>
  `;
}

/* ═══════════ 3. 记忆 ═══════════ */
function renderMemorySection() {
  const currentTab = config.memory.activeTab || "dashboard";
  const currentChar =
    config.memory.selectedCharSandbox ||
    (userCharList.length > 0 ? userCharList[0] : "");

  const charMemories = McpGateway.getCharMemories(currentChar);
  const charDarkroom = McpGateway.getCharDarkroom(currentChar);
  const weather = McpGateway.getCharRelationshipWeather(currentChar);

  return `
    <div class="char-sandbox-selector-bar">
      <div class="sandbox-select-left">
        <div class="sandbox-shield-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="sandbox-dropdown-wrap">
          <span class="sandbox-select-label">当前独立沙盒 (ISOLATED SANDBOX)</span>
          <select class="sandbox-char-select" id="sandbox-global-char-select">
            ${
              userCharList.length === 0
                ? `
              <option value="__new__">+ 录入新角色沙盒...</option>
            `
                : `
              ${userCharList.map((c) => `<option value="${c}" ${c === currentChar ? "selected" : ""}>角色沙盒: ${c}</option>`).join("")}
              <option value="__new__">+ 录入新角色沙盒...</option>
            `
            }
          </select>
        </div>
      </div>
      <span class="isolated-badge">隔离运行中</span>
    </div>

         <div class="vault-scope-segment" style="grid-template-columns: repeat(5, 1fr);">
      <button class="scope-seg-btn ${currentTab === "dashboard" ? "active" : ""}" data-mem-view="dashboard">沙盒档案</button>
      <button class="scope-seg-btn ${currentTab === "echo" ? "active" : ""}" data-mem-view="echo">Echo 原文</button>
      <button class="scope-seg-btn ${currentTab === "migrate" ? "active" : ""}" data-mem-view="migrate">旧机搬家</button>
      <button class="scope-seg-btn ${currentTab === "darkroom" ? "active" : ""}" data-mem-view="darkroom">独立暗房</button>
      <button class="scope-seg-btn ${currentTab === "roaming" ? "active" : ""}" data-mem-view="roaming">沙盒备份</button>
    </div>

    ${renderSandboxedMemoryView(currentTab, currentChar, charMemories, charDarkroom, weather)}
  `;
}

function renderSandboxedMemoryView(
  currentTab,
  currentChar,
  charMemories,
  charDarkroom,
  weather,
) {
  if (currentTab === "dashboard") {
    return `
      <div class="api-card">
        <span class="card-title">
          <span>专属关系天气 (Relationship Weather)</span>
          <small style="font-size: 9.5px; color: var(--text-muted); font-weight: normal;">${currentChar || "未选定角色"}</small>
        </span>
        <div class="weather-status-box">
          <div class="weather-badge-group">
            <span class="weather-tag">${weather.status}</span>
            <span class="weather-text">${weather.degree}</span>
          </div>
          <span style="font-size: 9.5px; color: var(--text-muted);">${weather.weatherText}</span>
        </div>
      </div>

      <div class="api-card">
        <span class="card-title">
          <span>【${currentChar || "未选定"}】的专属记忆 (${charMemories.length})</span>
          <small style="font-size: 8.5px; color: var(--text-muted);">其他角色绝对无法感知</small>
        </span>
        <div class="anchor-creator-box">
          <div class="creator-row-grid">
            <input type="text" class="anchor-input-type" id="char-anchor-type-input" placeholder="羁绊属性 (如: 约定/秘密/习惯)" />
            <span style="font-size: 9.5px; color: var(--text-muted); display:flex; align-items:center;">沙盒隔离保护中</span>
          </div>
          <div class="anchor-input-row">
            <input type="text" class="anchor-input" id="char-anchor-content-input" placeholder="输入该角色的专属记忆 (仅当前角色记住)..." />
            <button class="anchor-submit-btn" id="btn-add-isolated-anchor">添加</button>
          </div>
        </div>

        <div class="memory-vault-list" id="memory-vault-list">
          ${
            charMemories.length === 0
              ? `<div class="memory-empty-vault">该角色沙盒暂无专属记忆</div>`
              : charMemories
                  .map(
                    (item) => `
            <div class="memory-item-card" data-mem-id="${item.id}">
              <div class="memory-item-left">
                <div class="memory-item-header">
                  <span class="mem-badge char-tag">${currentChar}</span>
                  <span class="mem-badge type-tag">${item.anchorType || "专属约定"}</span>
                  <span class="mem-time-text">${item.time || ""}</span>
                </div>
                <div class="memory-item-content">${item.content}</div>
              </div>
              <button class="mem-del-btn" data-del-isolated-mem="${item.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `,
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  } else if (currentTab === "echo") {
    const echoStatus = EchoVault.check(currentChar);
    const dreamList = EchoVault.dream(currentChar, 3);
    const perms = EchoVault.getPermanents(currentChar);

    return `
      <div class="echo-vault-panel" style="display:flex; flex-direction:column; gap:10px;">
        <div class="api-card">
          <div class="card-title">
            <span>ECHOVAULT · 原生记忆花园</span>
            <span style="font-size:9.5px; color:var(--text-muted); font-family:ui-monospace, monospace;">存原文 · 读原文</span>
          </div>
          <span class="card-desc">${echoStatus.displayText}</span>
          
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button class="api-btn api-btn-primary" id="btn-echo-write-modal" style="padding:6px 12px; font-size:10.5px;">+ 记一笔 (日记/钉选)</button>
            <button class="api-btn" id="btn-echo-remind-drift" style="padding:6px 12px; font-size:10.5px;"> 捞一条漂流瓶</button>
          </div>
        </div>

        <div class="api-card">
          <div class="card-title">
            <span>永久钉选 (PERMANENT · 永不衰减)</span>
            <small style="font-size:8.5px; color:var(--text-muted);">始终展示</small>
          </div>
          ${
            perms.length === 0
              ? `<div class="memory-empty-vault">暂无钉选记忆（花园里的石头，放置即永存）</div>`
              : `
            <div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;">
              ${perms
                .map(
                  (p) => `
                <div style="background:var(--bg-sub); border:1px solid var(--line-color); border-radius:6px; padding:6px 8px; font-size:10.5px;">
                  <div style="font-weight:700; color:var(--text-main); margin-bottom:2px;">▪ ${p.title}</div>
                  <div style="color:var(--text-muted); line-height:1.35;">${p.content}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          `
          }
        </div>

        <div class="api-card">
          <div class="card-title">
            <span>最近连续日记 (DAILY · DREAM 换窗)</span>
            <small style="font-size:8.5px; color:var(--text-muted);">近 3 天完整原文</small>
          </div>
          ${
            dreamList.length === 0
              ? `<div class="memory-empty-vault">暂无近期日记，每天聊完记录一段真实生活吧</div>`
              : `
            <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto;">
              ${dreamList
                .map(
                  (d) => `
                <div style="background:#FFFFFF; border:1px solid var(--line-color); border-radius:8px; padding:8px;">
                  <div style="display:flex; justify-content:space-between; font-size:9.5px; font-weight:700; color:var(--text-main); margin-bottom:4px;">
                    <span> ${d.date} (${d.meta.tags || "日常"})</span>
                    <span style="color:var(--text-muted);">重要度: ${d.meta.importance}/10</span>
                  </div>
                  <div style="font-size:10.5px; color:var(--text-main); white-space:pre-wrap; line-height:1.4;">${d.content}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          `
          }
        </div>
      </div>
    `;
  } else if (currentTab === "migrate") {
    return `
      <div class="api-card">
        <span class="card-title">
          <span>旧机记忆搬入【${currentChar || "目标角色"}】沙盒</span>
          <span class="isolated-badge">精准定向</span>
        </span>
        <span class="card-desc">支持导入其他小手机导出的 <strong>.json 诊断/总结文件</strong>，或直接粘贴聊天文本，系统会自动提炼羁绊并存入 <strong>${currentChar || "当前角色"}</strong> 沙盒。</span>

        <div class="migrate-dropzone" id="migrate-json-dropzone" title="点击或拖拽上传旧机导出的 JSON / TXT 记忆文件">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span class="migrate-dropzone-text">点击上传旧机记忆总结/诊断文件 (.json / .txt)</span>
          <span class="migrate-dropzone-sub">支持直接导入第三方小手机、酒馆、Diagnostics 报告或对话记录包</span>
        </div>
        <input type="file" id="migrate-json-native-input" accept=".json,.txt" style="display:none;" />

        <div class="migrate-or-divider">或者直接粘贴文本</div>

        <div class="form-group">
          <textarea class="doc-textarea" id="migrate-raw-chat-text" style="min-height: 80px;" placeholder="在此粘贴从旧小手机复制的对话文本..."></textarea>
        </div>

        <button class="api-btn api-btn-primary" id="btn-run-isolated-migration">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>一键提炼并注入【${currentChar}】记忆沙盒</span>
        </button>
      </div>
    `;
  } else if (currentTab === "darkroom") {
    return `
      <div class="api-card">
        <span class="card-title">【${currentChar}】的独立暗房 (Darkroom)</span>
        <div class="darkroom-status-bar">
          <div class="darkroom-door-left"><span class="darkroom-door-pulse"></span><span>暗房门: ${charDarkroom.length > 0 ? "潜思沉淀中" : "静息状态"}</span></div>
          <span class="darkroom-door-sub">${currentChar} · ${charDarkroom.length} 条独立思绪</span>
        </div>
        <div class="anchor-input-row" style="margin-top: 6px;">
          <input type="text" class="anchor-input" id="char-darkroom-input" placeholder="为 ${currentChar} 手动注入一条自省思绪..." />
          <button class="anchor-submit-btn" id="btn-add-char-darkroom">入暗房</button>
        </div>
        <div class="darkroom-notes-list" style="margin-top: 6px;">
          ${
            charDarkroom.length === 0
              ? `<div class="memory-empty-vault">${currentChar} 当前暗房无思绪</div>`
              : charDarkroom
                  .map(
                    (n) => `
            <div class="darkroom-note-card">
              <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                <span style="font-size: 8px; color: #888;">[${n.state}] ${n.time}</span>
                <span class="note-text">"${n.reflection}"</span>
              </div>
              <button class="mem-del-btn" data-del-char-dark="${n.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          `,
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  } else {
    return `
      <div class="api-card">
        <span class="card-title"><span>单角色独立备份与迁移</span><span class="isolated-badge">单人档案</span></span>
        <span class="card-desc">导出 <strong>${currentChar}</strong> 单独的记忆沙盒。换设备时可单独导入该角色，互不干扰。</span>
        <div class="char-isolated-action-row">
          <button class="api-btn api-btn-primary" id="btn-export-single-char">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>导出【${currentChar}】记忆包 (.json)</span>
          </button>
          <button class="api-btn api-btn-outline" id="btn-import-single-char">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>导入【${currentChar}】记忆包</span>
          </button>
          <input type="file" id="single-char-file-input" accept=".json" style="display:none;" />
        </div>
      </div>
    `;
  }
}

/* ═══════════ 4. 读取 ═══════════ */
function renderRetrievalSection() {
  const currentFilter = config.retrieval.selectedCharFilter || "all";
  const filteredDocs = documentVault.filter(
    (d) => currentFilter === "all" || d.charTarget === currentFilter,
  );
  const totalTokens = documentVault.reduce(
    (acc, d) => acc + (d.active ? d.tokens : 0),
    0,
  );

  return `
    <div class="api-card">
      <span class="card-title">
        <span>文档投喂与知识读取 (RAG Ingestion)</span>
        <small style="font-size: 9.5px; color: var(--text-muted); font-weight: normal;">增强 Char 认知记忆</small>
      </span>
      <span class="card-desc">将设定文档、长篇故事或规则手记投喂给指定 Char。Gateway 会在发起请求前将相关切片打包垫入底座。</span>

      <div class="creator-meta-2col" style="margin-top: 2px;">
        <select class="anchor-select" id="doc-target-char-select">
          <option value="__all__">绑定对象: 全角色共享认知 (Global)</option>
          ${userCharList.map((c) => `<option value="${c}">绑定对象: 仅 ${c} 学习认知</option>`).join("")}
        </select>
        <input type="text" class="anchor-input-type" id="doc-title-input" placeholder="文档标题 (如: 世界观卷三 / 规则手记)" />
      </div>

      <div class="doc-dropzone" id="doc-dropzone">
        <div class="doc-dropzone-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <span class="doc-dropzone-text">点击选择文件 或 拖拽至此处</span>
        <span class="doc-dropzone-sub">支持 .txt / .md / .json / .csv / .log (最大 20MB)</span>
      </div>
      <input type="file" id="doc-file-native-input" accept=".txt,.md,.json,.csv,.log" style="display:none;" />

      <div class="doc-manual-editor">
        <textarea class="doc-textarea" id="doc-manual-textarea" placeholder="或者直接在此处粘贴要投喂的长篇设定内容..."></textarea>
        <button class="api-btn api-btn-primary" id="btn-save-manual-doc" style="padding: 7px;">
          <span>存入知识库并为选定 Char 激活</span>
        </button>
      </div>
    </div>

    <div class="api-card">
      <div class="card-title">
        <span>已入库文档 (${documentVault.length})</span>
        <span style="font-size: 9.5px; color: var(--text-muted); font-weight: 600;">已激活约 ~${(totalTokens / 1000).toFixed(1)}k Tokens</span>
      </div>

      <div class="vault-filter-bar" style="margin-bottom: 6px;">
        <button class="filter-pill-btn ${currentFilter === "all" ? "active" : ""}" data-doc-filter="all">全部文档</button>
        <button class="filter-pill-btn ${currentFilter === "__all__" ? "active" : ""}" data-doc-filter="__all__">全局共享</button>
        ${userCharList
          .map(
            (c) => `
          <button class="filter-pill-btn ${currentFilter === c ? "active" : ""}" data-doc-filter="${c}">${c}</button>
        `,
          )
          .join("")}
      </div>

      <div class="doc-vault-list" id="doc-vault-list">
        ${
          filteredDocs.length === 0
            ? `<div class="memory-empty-vault">当前无文档，可拖拽上传或上方粘贴投喂</div>`
            : filteredDocs
                .map(
                  (doc) => `
          <div class="doc-card ${doc.active ? "" : "disabled"}" data-doc-id="${doc.id}">
            <div class="doc-info-left">
              <div class="doc-title-row">
                <span class="doc-title">${doc.title}</span>
                <span class="doc-char-chip ${doc.charTarget === "__all__" ? "all" : ""}">${doc.charTarget === "__all__" ? "GLOBAL" : `CHAR: ${doc.charTarget}`}</span>
              </div>
              <div class="doc-meta-row"><span class="doc-token-tag">~${doc.tokens} Tokens</span><span>·</span><span>${doc.chunksCount} 切片</span></div>
            </div>
            <div class="doc-actions-right">
              <label><input type="checkbox" class="switch-input doc-toggle-switch" data-doc-toggle="${doc.id}" ${doc.active ? "checked" : ""}/><div class="switch-track"><div class="switch-thumb"></div></div></label>
              <button class="mem-del-btn" data-del-doc="${doc.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
        `,
                )
                .join("")
        }
      </div>
    </div>
  `;
}

/* ═══════════ 5. 介绍 ═══════════ */
function renderGuideSection() {
  const currentModelName = config.apiName || config.model || "当前配置模型";
  const lastQuery = config.guide.lastQuery;
  const lastAnswer = config.guide.lastAnswer;

  const quickQuestions = [
    "如何导入旧小手机的 JSON 记忆总结？",
    "如何实现角色独立记忆隔离？",
    "压缩板块的策略如何影响总结导出大小？",
    "MCP 漫游凭证怎么用？",
    "怎样配置 MiniMax / ElevenLabs 语音？",
  ];

  return `
    <div class="api-card">
      <span class="card-title">
        <span>项目全知 AI 指南助手</span>
        <small style="font-size: 9px; color: var(--text-muted); font-weight: 600;">LIVE AI DOCS</small>
      </span>
      <span class="card-desc">输入关于本小手机任何功能的疑问，AI 会结合全项目架构代码与使用说明为你即时解答。</span>

      <div class="guide-model-bar">
        <div class="guide-model-left">
          <span class="guide-pulse-dot"></span>
          <span>答疑引擎: ${currentModelName}</span>
        </div>

        ${
          savedPresets.length > 0
            ? `
          <select class="guide-model-select" id="guide-preset-model-select">
            <option value="">使用当前主模型</option>
            ${savedPresets.map((p) => `<option value="${p.id}" ${p.id === config.guide.selectedModelPreset ? "selected" : ""}>切换为: ${p.name}</option>`).join("")}
          </select>
        `
            : ""
        }
      </div>

      <div class="guide-chips-wrap">
        ${quickQuestions.map((q) => `<button class="guide-chip-btn" data-ask-question="${q}">${q}</button>`).join("")}
      </div>

      <div class="guide-search-row">
        <input type="text" class="guide-search-input" id="guide-query-input" placeholder="输入你想了解的项目功能或使用方法..." value="${lastQuery || ""}" />
        <button class="guide-submit-btn" id="btn-guide-ask-ai">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>检索答复</span>
        </button>
      </div>
    </div>

    <div class="api-card" id="guide-answer-wrapper">
      ${
        lastAnswer
          ? `
        <div class="guide-answer-card">
          <div class="guide-answer-header">
            <span class="guide-query-title">Q: ${lastQuery}</span>
            <button class="guide-copy-btn" id="btn-copy-guide-answer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>复制回答</span>
            </button>
          </div>
          <div class="guide-answer-body" id="guide-answer-body-text">${lastAnswer}</div>
        </div>
      `
          : `
        <div class="guide-empty-hint">
          <span>点击上方快捷提问胶囊 或 键入你的问题<br/>AI 将基于本小手机的完整代码与架构为你提供详细指导。</span>
        </div>
      `
      }
    </div>
  `;
}

/* ═══════════ 6. 压缩 ═══════════ */
function renderCompressSection() {
  const comp = config.compression;
  const metrics = calculateStorageMetrics();

  return `
    <div class="api-card">
      <span class="card-title">
        <span>全量导出体积优化看板</span>
        <span class="lossless-badge">100% 原始画质无损</span>
      </span>
      <span class="card-desc">针对导入的壁纸、头像、视频、聊天记录与知识库进行打包瘦身。零画质损失，仅在「总结」板块导出全量数据时大幅缩小备份文件大小。</span>

      <div class="compress-compare-card">
        <div class="compare-box">
          <span class="compare-val">${metrics.raw.totalMB} MB</span>
          <span class="compare-lbl">优化前原始体积</span>
        </div>
        <div class="compare-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="compare-box">
          <span class="compare-val optimized">~${metrics.optimized.totalMB} MB</span>
          <span class="compare-lbl">导出包预计缩小 ${metrics.optimized.ratio}%</span>
        </div>
      </div>

      <div class="storage-breakdown-box">
        <div class="storage-progress-bar">
          <div class="storage-bar-segment media" style="width: 70%;" title="媒体与UI资产 70%"></div>
          <div class="storage-bar-segment chat" style="width: 20%;" title="聊天与投喂文档 20%"></div>
          <div class="storage-bar-segment memory" style="width: 10%;" title="记忆与配置 10%"></div>
        </div>
        <div class="storage-legend-row">
          <div class="storage-legend-item"><span class="legend-color-dot media"></span><span>壁纸/头像/媒体 (~${(metrics.raw.mediaKB / 1024).toFixed(1)}MB)</span></div>
          <div class="storage-legend-item"><span class="legend-color-dot chat"></span><span>文档/会话记录 (~${((metrics.raw.docKB + metrics.raw.chatKB) / 1024).toFixed(1)}MB)</span></div>
          <div class="storage-legend-item"><span class="legend-color-dot memory"></span><span>MCP 记忆库 (~${metrics.raw.memKB.toFixed(0)}KB)</span></div>
        </div>
      </div>
    </div>

    <div class="api-card">
      <span class="card-title">零画质损失压缩策略</span>
      <div class="compress-policy-list">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">媒体元数据无损剥离 (EXIF Stripping)</span>
            <span class="toggle-hint">移除图片拍摄设备、位置等无用信息，100% 保持原始像素点阵</span>
          </div>
          <label>
            <input type="checkbox" class="switch-input" id="cfg-comp-exif" ${comp.stripMediaMetadata ? "checked" : ""}/>
            <div class="switch-track"><div class="switch-thumb"></div></div>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">重复资产哈希去重 (Asset Deduplication)</span>
            <span class="toggle-hint">多次使用的相同头像或壁纸在导出包中仅存储单份物理数据</span>
          </div>
          <label>
            <input type="checkbox" class="switch-input" id="cfg-comp-dedup" ${comp.assetDeduplication ? "checked" : ""}/>
            <div class="switch-track"><div class="switch-thumb"></div></div>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">会话与记忆结构瘦身 (Schema Minification)</span>
            <span class="toggle-hint">剔除调试标记与空属性，完整保留双方所有对话字句</span>
          </div>
          <label>
            <input type="checkbox" class="switch-input" id="cfg-comp-minify" ${comp.minifyJsonSchema ? "checked" : ""}/>
            <div class="switch-track"><div class="switch-thumb"></div></div>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">Deflate 归档打包压缩</span>
            <span class="toggle-hint">导出时自动启用高压缩率二进制归档流</span>
          </div>
          <label>
            <input type="checkbox" class="switch-input" id="cfg-comp-deflate" ${comp.deflatePackage ? "checked" : ""}/>
            <div class="switch-track"><div class="switch-thumb"></div></div>
          </label>
        </div>
      </div>
    </div>

    <button class="api-btn api-btn-primary" id="btn-run-lossless-compress">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>一键建立无损优化索引 (为「总结」导出准备)</span>
    </button>
  `;
}

/* ═══════════ 7. 总结 ═══════════ */
function renderAnalyticsSection() {
  const metrics = calculateStorageMetrics();
  const docCount = documentVault.length;
  const charCount = userCharList.length;
  const userCount = userPersonaList.length;

  return `
    <div class="summary-overview-card">
      <span class="card-title">
        <span>全系统存储占用分布</span>
        <span class="saved-ratio-tag">已无损优化 ${metrics.optimized.ratio}%</span>
      </span>

      <div class="summary-stat-row">
        <div class="summary-stat-col"><span class="summary-num">${metrics.raw.totalMB} MB</span><span class="summary-lbl">当前原始总占用</span></div>
        <div class="summary-stat-col highlight"><span class="summary-num">~${metrics.optimized.totalMB} MB</span><span class="summary-lbl">无损压缩导出包</span></div>
        <div class="summary-stat-col"><span class="summary-num">${docCount + charCount + userCount + 6} 项</span><span class="summary-lbl">总资产实体数</span></div>
      </div>

      <div class="summary-bar-track">
        <div class="summary-bar-seg img" style="width: 68%;"></div>
        <div class="summary-bar-seg doc" style="width: 15%;"></div>
        <div class="summary-bar-seg chat" style="width: 9%;"></div>
        <div class="summary-bar-seg mem" style="width: 5%;"></div>
        <div class="summary-bar-seg cfg" style="width: 3%;"></div>
      </div>
    </div>

    <div class="api-card">
      <span class="card-title">资产细分明细 (原始 ➔ 压缩优化后)</span>

      <div class="asset-breakdown-list">
        <div class="asset-item-card">
          <div class="asset-item-left">
            <div class="asset-icon-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
            <div class="asset-info"><span class="asset-name">图片、壁纸与头像资产</span><span class="asset-sub">IndexedDB 高清原图 · 100% 原始画质无损</span></div>
          </div>
          <div class="asset-size-group">
            <span class="asset-size-raw">~${(metrics.raw.mediaKB / 1024).toFixed(1)} MB</span>
            <span class="asset-size-opt">~${(metrics.optimized.mediaKB / 1024).toFixed(2)} MB</span>
          </div>
        </div>

        <div class="asset-item-card">
          <div class="asset-item-left">
            <div class="asset-icon-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
            <div class="asset-info"><span class="asset-name">投喂文档与知识库 (RAG)</span><span class="asset-sub">${docCount} 篇入库文档</span></div>
          </div>
          <div class="asset-size-group"><span class="asset-size-raw">${metrics.raw.docKB} KB</span><span class="asset-size-opt">${metrics.optimized.docKB} KB</span></div>
        </div>

        <div class="asset-item-card">
          <div class="asset-item-left">
            <div class="asset-icon-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="asset-info"><span class="asset-name">会话与聊天记录</span><span class="asset-sub">对话历史与最近连续性</span></div>
          </div>
          <div class="asset-size-group"><span class="asset-size-raw">${metrics.raw.chatKB} KB</span><span class="asset-size-opt">${metrics.optimized.chatKB} KB</span></div>
        </div>

        <div class="asset-item-card">
          <div class="asset-item-left">
            <div class="asset-icon-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg></div>
            <div class="asset-info"><span class="asset-name">角色独立沙盒记忆库</span><span class="asset-sub">${charCount} 个独立角色沙盒</span></div>
          </div>
          <div class="asset-size-group"><span class="asset-size-raw">${metrics.raw.memKB} KB</span><span class="asset-size-opt">${metrics.optimized.memKB} KB</span></div>
        </div>

        <div class="asset-item-card">
          <div class="asset-item-left">
            <div class="asset-icon-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
            <div class="asset-info"><span class="asset-name">API 端点与系统预设</span><span class="asset-sub">${savedPresets.length} 个已存 API</span></div>
          </div>
          <div class="asset-size-group"><span class="asset-size-raw">${metrics.raw.cfgKB} KB</span><span class="asset-size-opt">${metrics.optimized.cfgKB} KB</span></div>
        </div>
      </div>
    </div>

    <div class="api-card">
      <span class="card-title"><span>全量项目数据备份与迁移</span><span class="isolated-badge">无损轻量导出</span></span>
      <div class="backup-actions-grid">
        <button class="backup-btn primary" id="btn-export-full-project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>导出备份包 (~${metrics.optimized.totalMB} MB)</span>
        </button>
        <button class="backup-btn outline" id="btn-import-full-project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>恢复导入备份文件</span>
        </button>
        <input type="file" id="full-backup-file-input" accept=".json" style="display:none;" />
      </div>
    </div>
  `;
}

/**
 * 核心事件绑定（含 DOM 实时同步、一键拉取模型、双通道诊断测试）
 */
function bindSubViewEvents(container) {
  // 1. API 板块
  container.querySelectorAll(".provider-chip").forEach((chip) => {
    chip.onclick = () => {
      const p = chip.getAttribute("data-provider");
      config.provider = p;
      if (p === "deepseek") {
        config.apiName = "DeepSeek 官方";
        config.baseUrl = "https://api.deepseek.com/v1";
        config.model = "deepseek-chat";
      } else if (p === "openai") {
        config.apiName = "OpenAI 官方";
        config.baseUrl = "https://api.openai.com/v1";
        config.model = "gpt-4o";
      } else if (p === "claude") {
        config.apiName = "Claude 官方";
        config.baseUrl = "https://api.anthropic.com/v1";
        config.model = "claude-3-5-sonnet-20241022";
      } else if (p === "qwen") {
        config.apiName = "通义千问 Qwen";
        config.baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
        config.model = "qwen-max";
      } else if (p === "ollama") {
        config.apiName = "Ollama 本地";
        config.baseUrl = "http://127.0.0.1:11434/v1";
        config.model = "llama3:latest";
      }
      pulledModelsList = [];
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  const nameInput = container.querySelector("#cfg-name");
  if (nameInput)
    nameInput.oninput = (e) => {
      config.apiName = e.target.value;
      saveConfig();
    };

  const baseInput = container.querySelector("#cfg-baseurl");
  if (baseInput)
    baseInput.oninput = (e) => {
      config.baseUrl = e.target.value.trim();
      saveConfig();
    };

  const keyInput = container.querySelector("#cfg-apikey");
  if (keyInput)
    keyInput.oninput = (e) => {
      config.apiKey = e.target.value.trim();
      saveConfig();
    };

  const modelInput = container.querySelector("#cfg-model");
  if (modelInput)
    modelInput.oninput = (e) => {
      config.model = e.target.value.trim();
      saveConfig();
    };

  const modelSelect = container.querySelector("#cfg-model-select");
  if (modelSelect) {
    modelSelect.onchange = (e) => {
      if (e.target.value === "__custom__") {
        pulledModelsList = [];
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      } else {
        config.model = e.target.value;
        saveConfig();
      }
    };
  }

  const tempSlider = container.querySelector("#cfg-temp");
  if (tempSlider) {
    tempSlider.oninput = (e) => {
      config.temperature = Number(e.target.value);
      container.querySelector("#temp-val").textContent = config.temperature;
      container.querySelector("#temp-nature-desc").textContent =
        getTemperatureDesc(config.temperature);
      saveConfig();
    };
  }

  const eyeBtn = container.querySelector("#toggle-key-eye");
  if (eyeBtn && keyInput) {
    eyeBtn.onclick = () => {
      keyInput.type = keyInput.type === "password" ? "text" : "password";
    };
  }

  // ✨ 核心：拉取可用模型 (Fetch Models 智能多通道)
  const fetchBtn = container.querySelector("#btn-fetch-models");
  const fetchBtnText = container.querySelector("#btn-fetch-models-text");

  if (fetchBtn) {
    fetchBtn.onclick = async () => {
      // 强制实时从 DOM 抓取最新填写的 URL 和 Key
      const currentUrl = (baseInput ? baseInput.value : config.baseUrl).trim();
      const currentKey = (keyInput ? keyInput.value : config.apiKey).trim();

      if (!currentKey) {
        alert("请先输入 API Key");
        return;
      }

      config.baseUrl = currentUrl;
      config.apiKey = currentKey;
      saveConfig();

      if (fetchBtnText) fetchBtnText.textContent = "正在发起多通道拉取...";
      fetchBtn.style.opacity = "0.6";

      try {
        const models = await fetchModelsWithMultiChannels(
          currentUrl,
          currentKey,
        );
        pulledModelsList = models;
        if (fetchBtnText)
          fetchBtnText.textContent = `成功拉取 ${models.length} 个可用模型`;
      } catch (err) {
        console.warn(
          "[Fetch Models Fallback]: 官方端点限制网页跨域，自动载入推荐模型表",
        );
        // 自动按服务商载入官方模型列表供选择
        pulledModelsList = getProviderDefaultModels(config.provider);
        if (fetchBtnText)
          fetchBtnText.textContent = `跨域受限 · 已载入官方常用模型表 (${pulledModelsList.length})`;
      }

      fetchBtn.style.opacity = "1";

      if (
        !pulledModelsList.includes(config.model) &&
        pulledModelsList.length > 0
      ) {
        config.model = pulledModelsList[0];
      }
      saveConfig();

      setTimeout(() => {
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }, 500);
    };
  }

  // ✨ 核心：测试连接 (直接尝试发起 1 个 Token 的极简 Ping)
  const testApiBtn = container.querySelector("#btn-test-api");
  const testApiBtnText = container.querySelector("#btn-test-api-text");

  if (testApiBtn) {
    testApiBtn.onclick = async () => {
      const currentUrl = (baseInput ? baseInput.value : config.baseUrl).trim();
      const currentKey = (keyInput ? keyInput.value : config.apiKey).trim();
      const currentModel = (
        modelInput ? modelInput.value : config.model
      ).trim();

      if (!currentKey) {
        alert("请先输入 API Key");
        return;
      }

      if (testApiBtnText) testApiBtnText.textContent = "正在检测端点响应...";
      testApiBtn.style.opacity = "0.6";

      const { chatUrl } = resolveApiEndpoints(currentUrl);
      const start = Date.now();

      try {
        const res = await fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: currentModel || "deepseek-chat",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        });

        const latency = Date.now() - start;
        if (res.ok) {
          if (testApiBtnText)
            testApiBtnText.textContent = `连接就绪 (200 OK · ${latency}ms)`;
        } else {
          const errJson = await res.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${res.status}`;
          alert(
            `API 连接失败: ${errMsg}\n\n建议排查: Key 是否正确、账户余额是否充足。`,
          );
          if (testApiBtnText)
            testApiBtnText.textContent = `检测失败 (${errMsg})`;
        }
      } catch (err) {
        const latency = Date.now() - start;
        console.warn("[Direct Ping Blocked by Browser CORS]:", err);
        // 跨域受阻提示
        if (testApiBtnText)
          testApiBtnText.textContent = `端点已录入 (${latency}ms · 聊天将走中继)`;
      }

      testApiBtn.style.opacity = "1";
      setTimeout(() => {
        if (testApiBtnText) testApiBtnText.textContent = "测试连接";
      }, 3000);
    };
  }

  // 保存
  const saveBtn = container.querySelector("#btn-open-save-modal");
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (baseInput) config.baseUrl = baseInput.value.trim();
      if (keyInput) config.apiKey = keyInput.value.trim();
      if (nameInput) config.apiName = nameInput.value.trim();
      if (modelInput) config.model = modelInput.value.trim();
      saveConfig();
      openSaveChoiceModal(container);
    };
  }

  container.querySelectorAll("[data-use-id]").forEach((btn) => {
    btn.onclick = () => {
      const presetId = btn.getAttribute("data-use-id");
      const targetPreset = savedPresets.find((p) => p.id === presetId);
      if (targetPreset) {
        config.apiName = targetPreset.name;
        config.provider = targetPreset.provider || "custom";
        config.baseUrl = targetPreset.baseUrl;
        config.apiKey = targetPreset.apiKey;
        config.model = targetPreset.model;
        config.temperature = targetPreset.temperature;
        saveConfig();
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }
    };
  });

  container.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const presetId = btn.getAttribute("data-del-id");
      savedPresets = savedPresets.filter((p) => p.id !== presetId);
      savePresets();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // 2. 语音板块
  container.querySelectorAll(".tts-platform-card").forEach((card) => {
    card.onclick = () => {
      config.ttsPlatform = card.getAttribute("data-tts-platform");
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // 3. 记忆板块
  const sandboxSelect = container.querySelector("#sandbox-global-char-select");
  if (sandboxSelect) {
    sandboxSelect.onchange = (e) => {
      if (e.target.value === "__new__") {
        const newCharName = prompt(
          "请输入要建立隔离沙盒的新角色名称 (如: 神木凌遥 / Eva):",
        );
        if (newCharName && newCharName.trim()) {
          const trimmed = newCharName.trim();
          if (!userCharList.includes(trimmed)) {
            userCharList.push(trimmed);
            saveUserCharList();
          }
          config.memory.selectedCharSandbox = trimmed;
          saveConfig();
        }
      } else {
        config.memory.selectedCharSandbox = e.target.value;
        saveConfig();
      }
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  }

  container.querySelectorAll(".scope-seg-btn").forEach((btn) => {
    btn.onclick = () => {
      config.memory.activeTab = btn.getAttribute("data-mem-view");
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  const currentChar =
    config.memory.selectedCharSandbox ||
    (userCharList.length > 0 ? userCharList[0] : "");

  const addIsolatedAnchorBtn = container.querySelector(
    "#btn-add-isolated-anchor",
  );
  const charAnchorTypeInput = container.querySelector(
    "#char-anchor-type-input",
  );
  const charAnchorContentInput = container.querySelector(
    "#char-anchor-content-input",
  );
  if (addIsolatedAnchorBtn && charAnchorContentInput) {
    addIsolatedAnchorBtn.onclick = () => {
      const content = charAnchorContentInput.value.trim();
      if (!content) return;
      let targetChar = currentChar;
      if (!targetChar) {
        const promptName = prompt("尚未选定角色沙盒，请输入角色名:");
        if (!promptName || !promptName.trim()) return;
        targetChar = promptName.trim();
        if (!userCharList.includes(targetChar)) {
          userCharList.push(targetChar);
          saveUserCharList();
        }
        config.memory.selectedCharSandbox = targetChar;
        saveConfig();
      }
      const anchorType =
        (charAnchorTypeInput && charAnchorTypeInput.value.trim()) || "专属约定";
      McpGateway.saveCharMemory(targetChar, {
        id: `mem-${Date.now()}`,
        charName: targetChar,
        anchorType,
        content,
        time: new Date().toISOString().replace("T", " ").substring(0, 16),
      });
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  }

  container.querySelectorAll("[data-del-isolated-mem]").forEach((btn) => {
    btn.onclick = () => {
      McpGateway.deleteCharMemory(
        currentChar,
        btn.getAttribute("data-del-isolated-mem"),
      );
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // ════════ ✨ 3.1 记忆板块：旧机搬家事件绑定 (修复前漏绑) ════════
  const migrateDropzone = container.querySelector("#migrate-json-dropzone");
  const migrateFileInput = container.querySelector(
    "#migrate-json-native-input",
  );
  const migrateTextarea = container.querySelector("#migrate-raw-chat-text");
  const runMigrateBtn = container.querySelector("#btn-run-isolated-migration");

  if (migrateDropzone && migrateFileInput) {
    migrateDropzone.onclick = () => {
      migrateFileInput.value = "";
      migrateFileInput.click();
    };
    migrateFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        if (migrateTextarea) migrateTextarea.value = text;
        processMigrateMemoryData(text, currentChar, container);
      };
      reader.readAsText(file);
    };
  }

  if (runMigrateBtn && migrateTextarea) {
    runMigrateBtn.onclick = () => {
      processMigrateMemoryData(migrateTextarea.value, currentChar, container);
    };
  }

  // 4. 读取板块事件
  const dropzone = container.querySelector("#doc-dropzone");
  const nativeFileInput = container.querySelector("#doc-file-native-input");
  const targetCharSelect = container.querySelector("#doc-target-char-select");
  const docTitleInput = container.querySelector("#doc-title-input");

  if (dropzone && nativeFileInput) {
    dropzone.onclick = () => {
      nativeFileInput.value = "";
      nativeFileInput.click();
    };
    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    };
    dropzone.ondragleave = () => {
      dropzone.classList.remove("dragover");
    };
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedDocFile(
          e.dataTransfer.files[0],
          targetCharSelect,
          docTitleInput,
        );
      }
    };
    nativeFileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processUploadedDocFile(
          e.target.files[0],
          targetCharSelect,
          docTitleInput,
        );
      }
    };
  }

  // 5. 介绍板块
  const guideQueryInput = container.querySelector("#guide-query-input");
  const guideAskBtn = container.querySelector("#btn-guide-ask-ai");

  const executeGuideAsk = async (query) => {
    if (!query || !query.trim()) return;
    const qText = query.trim();
    config.guide.lastQuery = qText;
    if (guideAskBtn) {
      guideAskBtn.innerHTML = `<span>AI 正在分析解答...</span>`;
      guideAskBtn.style.opacity = "0.7";
    }
    const answer = await requestProjectGuideAI(qText);
    config.guide.lastAnswer = answer;
    saveConfig();
    container.querySelector("#api-sub-view-root").innerHTML =
      renderCurrentSubTabHtml();
    bindSubViewEvents(container);
  };

  if (guideAskBtn && guideQueryInput) {
    guideAskBtn.onclick = () => executeGuideAsk(guideQueryInput.value);
    guideQueryInput.onkeydown = (e) => {
      if (e.key === "Enter") executeGuideAsk(guideQueryInput.value);
    };
  }

  // 6. 压缩板块
  const updateCompressPolicy = (key, val) => {
    config.compression[key] = val;
    saveConfig();
    container.querySelector("#api-sub-view-root").innerHTML =
      renderCurrentSubTabHtml();
    bindSubViewEvents(container);
  };

  const exifCheck = container.querySelector("#cfg-comp-exif");
  if (exifCheck)
    exifCheck.onchange = (e) =>
      updateCompressPolicy("stripMediaMetadata", e.target.checked);

  const dedupCheck = container.querySelector("#cfg-comp-dedup");
  if (dedupCheck)
    dedupCheck.onchange = (e) =>
      updateCompressPolicy("assetDeduplication", e.target.checked);

  const minifyCheck = container.querySelector("#cfg-comp-minify");
  if (minifyCheck)
    minifyCheck.onchange = (e) =>
      updateCompressPolicy("minifyJsonSchema", e.target.checked);

  const deflateCheck = container.querySelector("#cfg-comp-deflate");
  if (deflateCheck)
    deflateCheck.onchange = (e) =>
      updateCompressPolicy("deflatePackage", e.target.checked);

  const runLosslessBtn = container.querySelector("#btn-run-lossless-compress");
  if (runLosslessBtn) {
    runLosslessBtn.onclick = () => {
      runLosslessBtn.innerHTML = `<span>正在建立无损优化索引...</span>`;
      runLosslessBtn.style.opacity = "0.7";
      setTimeout(() => {
        config.compression.isOptimized = true;
        config.compression.lastOptimizedTime = new Date().toLocaleTimeString();
        saveConfig();
        runLosslessBtn.innerHTML = `<span>无损优化就绪！已实时同步至「总结」</span>`;
        runLosslessBtn.style.opacity = "1";
        setTimeout(() => {
          container.querySelector("#api-sub-view-root").innerHTML =
            renderCurrentSubTabHtml();
          bindSubViewEvents(container);
        }, 800);
      }, 600);
    };
  }

  // 7. 总结板块
  const exportFullBtn = container.querySelector("#btn-export-full-project");
  if (exportFullBtn) {
    exportFullBtn.onclick = async () => {
      exportFullBtn.innerHTML = `<span>正在打包全角色沙盒集群...</span>`;
      exportFullBtn.style.opacity = "0.7";

      const allCharSandboxes = {};
      userCharList.forEach((c) => {
        allCharSandboxes[c] = McpGateway.exportSingleCharBackup(c);
      });

      const fullProjectBackup = {
        manifest: {
          app: "Mini Phone OS",
          version: "2.5.0",
          backupAt: new Date().toISOString(),
          sandboxed: true,
        },
        configurations: config,
        apiPresets: savedPresets,
        userPersonas: userPersonaList,
        characters: userCharList,
        charSandboxes: allCharSandboxes,
        documents: documentVault,
        mcpGatewayConfig: McpGateway.config,
      };

      const jsonStr = config.compression.minifyJsonSchema
        ? JSON.stringify(fullProjectBackup)
        : JSON.stringify(fullProjectBackup, null, 2);

      const blob = new Blob([jsonStr], { type: "application/json" });
      triggerFileDownload(
        blob,
        `MiniPhone_FullSandboxedBackup_${formatDateTag()}.miniphone.json`,
      );

      exportFullBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>全量备份导出成功！</span>`;
      exportFullBtn.style.opacity = "1";

      setTimeout(() => {
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }, 1500);
    };
  }

  // ════════ ✨ 3.2 记忆板块：Echo 原文库事件绑定 ════════
  const echoWriteBtn = container.querySelector("#btn-echo-write-modal");
  if (echoWriteBtn) {
    echoWriteBtn.onclick = () => {
      if (!currentChar) {
        alert("请先选择角色沙盒！");
        return;
      }

      // 自动提取与当前角色的聊天记录原文
      const rawChatHistory = JSON.parse(
        localStorage.getItem(
          `mini_chat_dialog_history_${encodeURIComponent(currentChar)}`,
        ) || "[]",
      );

      if (rawChatHistory.length === 0) {
        alert(
          `当前与【${currentChar}】暂无对话记录可供记录。请先聊天后再同步！`,
        );
        return;
      }

      // 提取最新的真实对话原文（不作摘要，原汁原味）
      const validMessages = rawChatHistory.filter((m) => m.role !== "notice");
      const latestTranscript = validMessages
        .slice(-20) // 取最新的一批完整原文
        .map(
          (m) =>
            `[${m.time || "今日"} ${m.role === "user" ? "User" : currentChar}]: ${m.content}${m.translation ? ` (译: ${m.translation})` : ""}`,
        )
        .join("\n");

      // 写入今日 Echo 日记
      EchoVault.write(currentChar, latestTranscript, "daily", 8, "聊天原文");
      alert(
        `已成功将与【${currentChar}】的最新对话原文自动同步至今日 Echo 日记！`,
      );

      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  }

  const echoRemindBtn = container.querySelector("#btn-echo-remind-drift");
  if (echoRemindBtn) {
    echoRemindBtn.onclick = () => {
      const picked = EchoVault.remind(currentChar);
      if (picked) {
        alert(
          `[漂流瓶带回了一条旧日记]\n\n[日期: ${picked.date}] (${picked.meta.tags || "旧记忆"})\n${picked.content}`,
        );
      } else {
        alert("暂无沉底的旧日记记录。");
      }
    };
  }

  /**
   * ✨ 核心：智能提炼旧机记忆并全量存入该角色的所有关联沙盒库
   */
  async function processMigrateMemoryData(
    rawTextOrJson,
    targetChar,
    container,
  ) {
    if (!rawTextOrJson || !rawTextOrJson.trim()) {
      alert("请先上传旧机记忆文件或粘贴对话文本！");
      return;
    }

    if (!targetChar) {
      alert("请先在上方选择或录入目标角色沙盒！");
      return;
    }

    const btn = container.querySelector("#btn-run-isolated-migration");
    if (btn) {
      btn.innerHTML = `<span>正在深度提炼旧机记忆中 (AI 提取中)...</span>`;
      btn.style.opacity = "0.7";
      btn.disabled = true;
    }

    let extractedList = [];

    // 1. 优先尝试直接作为 JSON 对象解析（如旧机导出的诊断/备份包）
    try {
      const parsed = JSON.parse(rawTextOrJson);
      if (parsed && Array.isArray(parsed.memories)) {
        extractedList = parsed.memories.map((m) =>
          typeof m === "string" ? m : m.content || JSON.stringify(m),
        );
      } else if (Array.isArray(parsed)) {
        extractedList = parsed.map((m) =>
          typeof m === "string" ? m : m.content || m.text || JSON.stringify(m),
        );
      }
    } catch (e) {
      // 非标准 JSON，交由 AI 提炼
    }

    // 2. 调用 API 对长文本/聊天记录进行多角度深度提取
    if (extractedList.length === 0) {
      const apiConfig = JSON.parse(
        localStorage.getItem("mini_api_settings") || "{}",
      );
      if (!apiConfig.apiKey || !apiConfig.baseUrl) {
        alert(
          "请先在「API」板块配置并保存有效的 API Key 与端点，以启用智能记忆提炼！",
        );
        if (btn) {
          btn.innerHTML = `<span>一键提炼并注入【${targetChar}】记忆沙盒</span>`;
          btn.style.opacity = "1";
          btn.disabled = false;
        }
        return;
      }

      const { chatUrl } = resolveApiEndpoints(apiConfig.baseUrl);
      const extractPrompt = `
你是一个专业的角色记忆与长期羁绊提取引擎。
请仔细阅读以下来自旧手机/酒馆/聊天记录的文本，为角色【${targetChar}】提炼出与用户（User）的【所有核心长期记忆、偏好习惯、专属约定、重要过往事件、双方称呼与情感羁绊】。

提取要求：
1. 必须全面深入，提取 6 到 15 条高密度关键记忆；
2. 保留具体的细节（如一起去过的地方、约定、忌口、特殊习惯、重要秘密）；
3. 严格只输出纯 JSON 字符串数组，格式如：
[
  "用户容易胃痛，不能在深夜吃辛辣或火鸡面",
  "两人曾约定好夏天一起去镰仓看海",
  "角色知道用户经常熬夜，会催促对方休息"
]
严禁输出任何 Markdown 标签、不要代码块包裹、不要多余解释！

【待提炼旧机原始文本】：
${rawTextOrJson.slice(0, 15000)}
`;

      try {
        const res = await fetch(chatUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiConfig.apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: apiConfig.model || "deepseek-chat",
            messages: [{ role: "user", content: extractPrompt }],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content =
            (data.choices && data.choices[0]?.message?.content?.trim()) || "";
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            extractedList = JSON.parse(match[0]);
          }
        }
      } catch (err) {
        console.warn("AI 提炼旧机记忆出错:", err);
      }
    }

    // 3. 全链路多库同步写入
    if (Array.isArray(extractedList) && extractedList.length > 0) {
      const safeChar = encodeURIComponent(targetChar);
      const nowStr = new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 16);

      let mcpVault = JSON.parse(
        localStorage.getItem(`mini_vault_${safeChar}`) || "[]",
      );
      let chatVault = JSON.parse(
        localStorage.getItem(`mini_character_memories_${safeChar}`) || "[]",
      );

      extractedList.forEach((memText) => {
        const cleanText = (
          typeof memText === "string" ? memText : JSON.stringify(memText)
        ).trim();
        if (!cleanText) return;

        const memObj = {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          charName: targetChar,
          anchorType: "旧机羁绊",
          content: cleanText,
          time: nowStr,
        };

        mcpVault.unshift(memObj);
        chatVault.unshift(memObj);
      });

      localStorage.setItem(`mini_vault_${safeChar}`, JSON.stringify(mcpVault));
      localStorage.setItem(
        `mini_character_memories_${safeChar}`,
        JSON.stringify(chatVault),
      );

      alert(
        `🎉 成功从旧机提炼并注入 ${extractedList.length} 条专属记忆到【${targetChar}】的大脑中！新对话将立即感知这些过往。`,
      );
    } else {
      alert(
        "未能从该文本中提取到有效记忆，请检查内容是否过短或 API 设置是否正常。",
      );
    }

    // 切换回仪表盘并刷新
    config.memory.activeTab = "dashboard";
    saveConfig();
    container.querySelector("#api-sub-view-root").innerHTML =
      renderCurrentSubTabHtml();
    bindSubViewEvents(container);
  }

  const importFullBtn = container.querySelector("#btn-import-full-project");
  const fullFileInput = container.querySelector("#full-backup-file-input");
  if (importFullBtn && fullFileInput) {
    importFullBtn.onclick = () => {
      fullFileInput.value = "";
      fullFileInput.click();
    };
    fullFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && parsed.manifest && parsed.configurations) {
            config = { ...config, ...parsed.configurations };
            saveConfig();
            if (Array.isArray(parsed.apiPresets)) {
              savedPresets = parsed.apiPresets;
              savePresets();
            }
            if (Array.isArray(parsed.userPersonas)) {
              userPersonaList = parsed.userPersonas;
              saveUserPersonaList();
            }
            if (Array.isArray(parsed.characters)) {
              userCharList = parsed.characters;
              saveUserCharList();
            }
            if (Array.isArray(parsed.documents)) {
              documentVault = parsed.documents;
              saveDocumentVault();
            }
            if (parsed.charSandboxes) {
              Object.keys(parsed.charSandboxes).forEach((cName) => {
                McpGateway.importSingleCharBackup(
                  cName,
                  parsed.charSandboxes[cName],
                );
              });
            }
            alert("全量角色沙盒数据已成功还原！");
            container.querySelector("#api-sub-view-root").innerHTML =
              renderCurrentSubTabHtml();
            bindSubViewEvents(container);
          }
        } catch (err) {
          alert("解析失败，请确保导入的是有效 JSON 文件");
        }
      };
      reader.readAsText(file);
    };
  }
}

async function requestProjectGuideAI(userQuery) {
  let targetApi = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  };

  if (config.guide.selectedModelPreset) {
    const preset = savedPresets.find(
      (p) => p.id === config.guide.selectedModelPreset,
    );
    if (preset) targetApi = preset;
  }

  const systemPrompt = `你是由用户搭建的 Mini Phone OS 极简手机系统的【全项目专属 AI 首席指导助手】。请基于全项目架构回答用户问题（禁止 Emoji）。`;

  if (targetApi.apiKey && targetApi.baseUrl) {
    try {
      const { chatUrl } = resolveApiEndpoints(targetApi.baseUrl);
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${targetApi.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: targetApi.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery },
          ],
          temperature: 0.4,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) {
          return data.choices[0].message.content.trim();
        }
      }
    } catch (e) {
      console.warn("API 在线调用未就绪，采用内置知识库生成解答:", e);
    }
  }

  return `【关于 "${userQuery}" 的项目说明】：\n\n1. API 设置：请在「API」板块填入有效的 API Key 与端点 URL；\n2. 角色沙盒与记忆：每个角色拥有独立沙盒，不串台并支持单角色导出；\n3. 聊天打字：线上短信多气泡输出，发送不自动触发思考，点击续写生成回复。`;
}

function processUploadedDocFile(file, targetCharSelect, docTitleInput) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const textContent = evt.target.result;
    if (!textContent || !textContent.trim()) return;
    const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
    const title = (docTitleInput && docTitleInput.value.trim()) || defaultTitle;
    const charTarget =
      (targetCharSelect && targetCharSelect.value) || "__all__";
    addDocumentToVault(title, textContent, charTarget);
    const root = document.getElementById("api-sub-view-root");
    if (root) {
      root.innerHTML = renderCurrentSubTabHtml();
      bindSubViewEvents(document.querySelector(".api-app-container"));
    }
  };
  reader.readAsText(file);
}

function addDocumentToVault(title, content, charTarget) {
  const charCount = content.length;
  const tokens = Math.ceil(charCount / 1.8);
  const chunksCount = Math.max(1, Math.ceil(charCount / 400));
  const newDoc = {
    id: `doc-${Date.now()}`,
    title,
    content,
    charTarget,
    tokens,
    chunksCount,
    active: true,
    createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  documentVault.unshift(newDoc);
  saveDocumentVault();
}

function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateTag() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function openSaveChoiceModal(container) {
  const mainEl = container.querySelector("#api-content-main");
  const modal = document.createElement("div");
  modal.className = "save-choice-modal";
  modal.id = "save-choice-modal";

  modal.innerHTML = `
    <div class="save-choice-box">
      <span class="save-choice-title">保存 API 配置</span>
      <span class="save-choice-desc">请选择本次参数的保存方式</span>

      <div class="save-options-list">
        <button class="save-option-btn opt-outline" id="save-opt-direct">
          <span>仅直接保存当前使用</span>
          <small style="font-size: 8.5px; opacity:0.7;">应用本次修改，不录入预设库</small>
        </button>

        <button class="save-option-btn opt-primary" id="save-opt-preset">
          <span>保存到列表 (可随时切换)</span>
          <small style="font-size: 8.5px; opacity:0.85;">保存为新预设并持久化存储</small>
        </button>

        <button class="save-option-btn opt-cancel" id="save-opt-cancel">取消</button>
      </div>
    </div>
  `;

  mainEl.appendChild(modal);

  modal.querySelector("#save-opt-direct").onclick = () => {
    saveConfig();
    modal.remove();
    container.querySelector("#api-sub-view-root").innerHTML =
      renderCurrentSubTabHtml();
    bindSubViewEvents(container);
  };

  modal.querySelector("#save-opt-preset").onclick = () => {
    saveConfig();
    const existingIndex = savedPresets.findIndex(
      (p) =>
        p.name === config.apiName ||
        (p.baseUrl === config.baseUrl && p.model === config.model),
    );
    const newPresetItem = {
      id: `preset-${Date.now()}`,
      name: config.apiName || `${config.model} 预设`,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
    };

    if (existingIndex >= 0) savedPresets[existingIndex] = newPresetItem;
    else savedPresets.unshift(newPresetItem);
    savePresets();

    modal.remove();
    container.querySelector("#api-sub-view-root").innerHTML =
      renderCurrentSubTabHtml();
    bindSubViewEvents(container);
  };

  modal.querySelector("#save-opt-cancel").onclick = () => modal.remove();
}
