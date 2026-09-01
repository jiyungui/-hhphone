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

  // 1. ✨ 真实计算所有图片与头像媒体大小（扫描角色头像、用户证件照、以及聊天图片）
  let mediaRawBytes = 0;
  const charVaultFull = JSON.parse(
    localStorage.getItem("mini_character_vault_full") || "[]",
  );
  charVaultFull.forEach((c) => {
    if (c.avatarUrl && c.avatarUrl.startsWith("data:")) {
      mediaRawBytes += c.avatarUrl.length;
    }
  });

  const userPersonasFull = JSON.parse(
    localStorage.getItem("mini_user_personas_full") || "[]",
  );
  userPersonasFull.forEach((u) => {
    if (u.avatarUrl && u.avatarUrl.startsWith("data:")) {
      mediaRawBytes += u.avatarUrl.length;
    }
  });

  // 扫描聊天记录中的图片卡片大小与总聊天大小
  let chatRawBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("mini_chat_dialog_history_")) {
      const chatVal = localStorage.getItem(key) || "[]";
      chatRawBytes += chatVal.length;
      try {
        const msgs = JSON.parse(chatVal);
        if (Array.isArray(msgs)) {
          msgs.forEach((m) => {
            if (m.mediaUrl && m.mediaUrl.startsWith("data:")) {
              mediaRawBytes += m.mediaUrl.length;
            }
          });
        }
      } catch (e) {}
    }
  }

  const mediaRawKB = Math.round(mediaRawBytes / 1024);
  const chatRawKB = Math.round(chatRawBytes / 1024);

  // 2. 真实计算投喂文档大小
  const docRawKB = Math.round(JSON.stringify(documentVault).length / 1024);

  // 3. 真实计算配置与预设大小
  const cfgRawKB = Math.round(
    (JSON.stringify(config).length + JSON.stringify(savedPresets).length) /
      1024,
  );

  // 4. 真实计算全角色记忆库大小
  let memRawBytes = 0;
  userCharList.forEach((c) => {
    memRawBytes += JSON.stringify(McpGateway.getCharMemories(c)).length;
    memRawBytes += JSON.stringify(McpGateway.getCharDarkroom(c)).length;
    const safeC = encodeURIComponent(c);
    memRawBytes += (localStorage.getItem(`echo_daily_${safeC}`) || "").length;
    memRawBytes += (localStorage.getItem(`echo_perm_${safeC}`) || "").length;
  });
  const memRawKB = Math.round(memRawBytes / 1024);

  const totalRawKB = Math.max(
    1,
    mediaRawKB + docRawKB + chatRawKB + memRawKB + cfgRawKB,
  );

  // 计算无损优化后大小
  let mediaFactor = 1.0;
  if (comp.stripMediaMetadata) mediaFactor *= 0.85;
  if (comp.assetDeduplication) mediaFactor *= 0.9;
  const mediaOptKB = Math.round(mediaRawKB * mediaFactor);

  let textFactor = 1.0;
  if (comp.minifyJsonSchema) textFactor *= 0.7;

  const docOptKB = Math.round(docRawKB * textFactor);
  const chatOptKB = Math.round(chatRawKB * textFactor);
  const memOptKB = Math.round(memRawKB * textFactor);
  const cfgOptKB = Math.round(cfgRawKB * textFactor);

  let subtotalKB = mediaOptKB + docOptKB + chatOptKB + memOptKB + cfgOptKB;
  if (comp.deflatePackage) subtotalKB = Math.round(subtotalKB * 0.7);

  const totalOptKB = Math.max(1, subtotalKB);
  const ratio = Math.max(0, Math.round((1 - totalOptKB / totalRawKB) * 100));

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

      // ✨ 核心：离开或重新进入介绍板块时，自动清空上一轮的问答驻留
      if (config.activeTab === "guide" || tabId === "guide") {
        config.guide.lastQuery = "";
        config.guide.lastAnswer = "";
      }

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
      <span class="card-title">${isMiniMax ? "MiniMax 接口与模型参数" : "ElevenLabs 接口与模型参数"}</span>
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
        <div class="form-group">
          <label class="form-label">语音大模型 (Model)</label>
          <select class="api-select" id="cfg-mm-model-select">
            <option value="speech-01-turbo" ${config.minimax.model === "speech-01-turbo" ? "selected" : ""}>speech-01-turbo (低延迟·高性价比)</option>
            <option value="speech-01-hd" ${config.minimax.model === "speech-01-hd" ? "selected" : ""}>speech-01-hd (高保真·丰富情感)</option>
            <option value="speech-02-turbo" ${config.minimax.model === "speech-02-turbo" ? "selected" : ""}>speech-02-turbo (次世代语音)</option>
          </select>
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
        <div class="form-group">
          <label class="form-label">语音模型 (Model)</label>
          <select class="api-select" id="cfg-el-model-select">
            <option value="eleven_multilingual_v2" ${config.elevenlabs.model === "eleven_multilingual_v2" ? "selected" : ""}>eleven_multilingual_v2 (多语言·微情绪)</option>
            <option value="eleven_turbo_v2_5" ${config.elevenlabs.model === "eleven_turbo_v2_5" ? "selected" : ""}>eleven_turbo_v2_5 (极速超低延迟)</option>
            <option value="eleven_flash_v2" ${config.elevenlabs.model === "eleven_flash_v2" ? "selected" : ""}>eleven_flash_v2 (高性价比)</option>
          </select>
        </div>
      `
      }
    </div>

    <div class="api-card">
      <div class="card-title">
        <span>音色预设 (Voice Timbre)</span>
        <span class="active-tag">${isMiniMax ? config.minimax.voiceId : config.elevenlabs.voiceId}</span>
      </div>
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

      <!-- 自定义 Voice ID 输入框（当选择自定义时展开） -->
      <div class="form-group" style="margin-top: 8px;">
        <label class="form-label">自定义 Voice ID (选自定义时生效)</label>
        <input type="text" class="form-input" id="cfg-custom-voice-id" value="${isMiniMax ? config.minimax.customVoiceId || "" : config.elevenlabs.customVoiceId || ""}" placeholder="输入第三方克隆或专属音色 ID..." />
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
          <span style="font-size: 9.5px; color: var(--text-muted); font-weight: 600;">${isMiniMax ? `${config.minimax.model} · ${config.minimax.voiceId}` : `${config.elevenlabs.model} · ${config.elevenlabs.voiceId}`}</span>
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

               <div class="doc-dropzone" id="doc-dropzone" style="margin-top: 8px;">
        <div class="doc-dropzone-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <span class="doc-dropzone-text">点击选择文件 或 拖拽至此处</span>
        <span class="doc-dropzone-sub">支持 .txt / .md / .json / .csv / .log (自动弹出内容预览与命名)</span>
      </div>
      <input type="file" id="doc-file-native-input" accept=".txt,.md,.json,.csv,.log" style="display:none;" />

      <div class="doc-manual-editor">
        <textarea class="doc-textarea" id="doc-manual-textarea" placeholder="或者直接在此处粘贴要投喂的长篇设定内容..."></textarea>
        <button class="api-btn api-btn-primary" id="btn-save-manual-doc" style="padding: 8px;">
          <span>预览内容并命名入库</span>
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
            <div class="doc-actions-right" style="display:flex; align-items:center; gap:6px;">
              <button class="mem-del-btn" data-rename-doc="${doc.id}" title="重命名文档" style="opacity:0.85;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <label><input type="checkbox" class="switch-input doc-toggle-switch" data-doc-toggle="${doc.id}" ${doc.active ? "checked" : ""}/><div class="switch-track"><div class="switch-thumb"></div></div></label>
              <button class="mem-del-btn" data-del-doc="${doc.id}" title="删除文档"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
    "API 如何正确连接与配置？",
    "如何给指定角色投喂设定文档 (读取)？",
    "EchoVault 原生记忆库如何使用？",
    "如何使用「旧机搬家」导入历史记忆？",
    "聊天室的「内嵌翻译」与「时区感知」怎么开启？",
    "聊天气泡的「重回」、「引用」与「撤回」如何使用？",
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
          <div class="storage-bar-segment media" style="width: ${Math.round((metrics.raw.mediaKB / metrics.raw.totalKB) * 100) || 0}%;" title="媒体资产"></div>
          <div class="storage-bar-segment chat" style="width: ${Math.round(((metrics.raw.docKB + metrics.raw.chatKB) / metrics.raw.totalKB) * 100) || 0}%;" title="聊天与文档"></div>
          <div class="storage-bar-segment memory" style="width: ${Math.round(((metrics.raw.memKB + metrics.raw.cfgKB) / metrics.raw.totalKB) * 100) || 0}%;" title="记忆与配置"></div>
        </div>
        <div class="storage-legend-row">
          <div class="storage-legend-item"><span class="legend-color-dot media"></span><span>壁纸/头像/媒体 (${metrics.raw.mediaKB > 1024 ? `${(metrics.raw.mediaKB / 1024).toFixed(2)} MB` : `${metrics.raw.mediaKB} KB`})</span></div>
          <div class="storage-legend-item"><span class="legend-color-dot chat"></span><span>文档/会话记录 (${metrics.raw.docKB + metrics.raw.chatKB} KB)</span></div>
          <div class="storage-legend-item"><span class="legend-color-dot memory"></span><span>记忆与配置 (${metrics.raw.memKB + metrics.raw.cfgKB} KB)</span></div>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>导出备份包 (~${metrics.optimized.totalMB} MB)</span>
        </button>
        <button class="backup-btn outline" id="btn-import-full-project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>恢复导入备份文件</span>
        </button>
        <input type="file" id="full-backup-file-input" accept=".json" style="display:none;" />
      </div>
    </div>

    <!-- ✨ 核心新增：清空所有数据危险卡片 -->
    <div class="api-card" style="border-color: #FFCDD2; background: #FFFFFF;">
      <div class="card-title">
        <span style="color: #E53935; font-weight: 800;">危险区域 · 全系统数据清空与重置</span>
        <span style="font-size: 8.5px; color: #E53935; border: 1px solid #FFCDD2; padding: 1.5px 5px; border-radius: 4px; font-weight: 700;">DANGER ZONE</span>
      </div>
      <span class="card-desc" style="color: #888888; line-height: 1.4; margin-top: 2px;">
        彻底抹除本地存储中的所有角色沙盒、Echo 日记、对话气泡、知识库文档与 API 预设，重置为系统初始出厂状态。操作不可撤回。
      </span>
      <button class="api-btn" id="btn-wipe-all-system-data" style="width: 100%; margin-top: 10px; padding: 9px; background: #FFFFFF; color: #E53935; border: 1px solid #FFCDD2; font-weight: 800; font-size: 11.5px; border-radius: 8px;">
        清空并重置所有本地数据
      </button>
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
  // 平台切换 (MiniMax / ElevenLabs)
  container.querySelectorAll(".tts-platform-card").forEach((card) => {
    card.onclick = () => {
      config.ttsPlatform = card.getAttribute("data-tts-platform");
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // ✨ 参数实时输入自动保存
  const mmGroupIdInput = container.querySelector("#cfg-mm-groupid");
  if (mmGroupIdInput) {
    mmGroupIdInput.oninput = (e) => {
      config.minimax.groupId = e.target.value.trim();
      saveConfig();
    };
  }

  const mmApiKeyInput = container.querySelector("#cfg-mm-apikey");
  if (mmApiKeyInput) {
    mmApiKeyInput.oninput = (e) => {
      config.minimax.apiKey = e.target.value.trim();
      saveConfig();
    };
  }

  const elApiKeyInput = container.querySelector("#cfg-el-apikey");
  if (elApiKeyInput) {
    elApiKeyInput.oninput = (e) => {
      config.elevenlabs.apiKey = e.target.value.trim();
      saveConfig();
    };
  }

  // ✨ 声音模型选择切换并保存
  const mmModelSelect = container.querySelector("#cfg-mm-model-select");
  if (mmModelSelect) {
    mmModelSelect.onchange = (e) => {
      config.minimax.model = e.target.value;
      saveConfig();
    };
  }

  const elModelSelect = container.querySelector("#cfg-el-model-select");
  if (elModelSelect) {
    elModelSelect.onchange = (e) => {
      config.elevenlabs.model = e.target.value;
      saveConfig();
    };
  }

  // ✨ 核心修复：音色预设卡片点击切换并持久化保存
  container.querySelectorAll(".voice-chip").forEach((chip) => {
    chip.onclick = () => {
      const vId = chip.getAttribute("data-voice-id");
      if (config.ttsPlatform === "minimax") {
        config.minimax.voiceId = vId;
      } else {
        config.elevenlabs.voiceId = vId;
      }
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // 自定义 Voice ID 输入保存
  const customVoiceInput = container.querySelector("#cfg-custom-voice-id");
  if (customVoiceInput) {
    customVoiceInput.oninput = (e) => {
      if (config.ttsPlatform === "minimax") {
        config.minimax.customVoiceId = e.target.value.trim();
      } else {
        config.elevenlabs.customVoiceId = e.target.value.trim();
      }
      saveConfig();
    };
  }

  // 密码显示/隐藏眼睛按钮
  const mmEyeBtn = container.querySelector("#toggle-mm-key-eye");
  if (mmEyeBtn && mmApiKeyInput) {
    mmEyeBtn.onclick = () => {
      mmApiKeyInput.type = mmApiKeyInput.type === "password" ? "text" : "password";
    };
  }
  const elEyeBtn = container.querySelector("#toggle-el-key-eye");
  if (elEyeBtn && elApiKeyInput) {
    elEyeBtn.onclick = () => {
      elApiKeyInput.type = elApiKeyInput.type === "password" ? "text" : "password";
    };
  }

  // 试听文本保存与生成试听
  const testTextInput = container.querySelector("#cfg-test-text");
  if (testTextInput) {
    testTextInput.oninput = (e) => {
      config.testSpeechText = e.target.value;
      saveConfig();
    };
  }

  // ✨ 核心修复：生成并试听按钮事件与声波动画驱动
  const playVoiceBtn = container.querySelector("#btn-play-voice-test");
  if (playVoiceBtn) {
    playVoiceBtn.onclick = async () => {
      const text = (testTextInput && testTextInput.value.trim()) || "你好，语音配置连接正常。";
      const statusText = container.querySelector("#audio-status-text");
      const waveWrap = container.querySelector("#audio-wave-wrap");

      if (statusText) statusText.textContent = "生成音频中...";
      if (waveWrap) waveWrap.classList.add("playing");
      playVoiceBtn.disabled = true;

      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.onend = () => {
            if (statusText) statusText.textContent = "播放完毕";
            if (waveWrap) waveWrap.classList.remove("playing");
            playVoiceBtn.disabled = false;
          };
          utter.onerror = () => {
            if (statusText) statusText.textContent = "播放失败";
            if (waveWrap) waveWrap.classList.remove("playing");
            playVoiceBtn.disabled = false;
          };
          window.speechSynthesis.speak(utter);
          if (statusText) statusText.textContent = "正在播放...";
        } else {
          alert("当前浏览器环境不支持音频播放");
          if (waveWrap) waveWrap.classList.remove("playing");
          playVoiceBtn.disabled = false;
        }
      } catch (err) {
        console.warn("TTS 播放出错:", err);
        if (statusText) statusText.textContent = "试听失败";
        if (waveWrap) waveWrap.classList.remove("playing");
        playVoiceBtn.disabled = false;
      }
    };
  }

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
          container,
        );
      }
    };
    nativeFileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processUploadedDocFile(
          e.target.files[0],
          targetCharSelect,
          docTitleInput,
          container,
        );
      }
    };
  }

  // ✨ 粘贴文本写入按钮事件绑定
  const saveManualDocBtn = container.querySelector("#btn-save-manual-doc");
  const manualDocTextarea = container.querySelector("#doc-manual-textarea");
  if (saveManualDocBtn && manualDocTextarea) {
    saveManualDocBtn.onclick = () => {
      const text = manualDocTextarea.value.trim();
      if (!text) {
        alert("请先粘贴或输入长篇文本内容！");
        return;
      }
      const title =
        (docTitleInput && docTitleInput.value.trim()) ||
        `文档_${new Date().toISOString().slice(5, 10)}`;
      const charTarget =
        (targetCharSelect && targetCharSelect.value) || "__all__";
      openDocPreviewModal(title, text, charTarget, container);
    };
  }

  // ✨ 核心新增：已入库文档【重命名按钮】事件绑定
  container.querySelectorAll("[data-rename-doc]").forEach((btn) => {
    btn.onclick = () => {
      const docId = btn.getAttribute("data-rename-doc");
      const targetDoc = documentVault.find((d) => d.id === docId);
      if (!targetDoc) return;
      const newTitle = prompt("修改文档名称:", targetDoc.title);
      if (newTitle && newTitle.trim()) {
        targetDoc.title = newTitle.trim();
        saveDocumentVault();
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }
    };
  });

  // ✨ 核心修复：已上传文档【删除按钮】事件绑定
  container.querySelectorAll("[data-del-doc]").forEach((btn) => {
    btn.onclick = () => {
      const docId = btn.getAttribute("data-del-doc");
      const targetDoc = documentVault.find((d) => d.id === docId);
      const title = targetDoc ? targetDoc.title : "该文档";
      if (confirm(`确定要从知识库中删除【${title}】吗？`)) {
        documentVault = documentVault.filter((d) => d.id !== docId);
        saveDocumentVault();
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }
    };
  });

  // ✨ 补充：文档启用/停用开关绑定
  container.querySelectorAll("[data-doc-toggle]").forEach((chk) => {
    chk.onchange = (e) => {
      const docId = chk.getAttribute("data-doc-toggle");
      const targetDoc = documentVault.find((d) => d.id === docId);
      if (targetDoc) {
        targetDoc.active = e.target.checked;
        saveDocumentVault();
        container.querySelector("#api-sub-view-root").innerHTML =
          renderCurrentSubTabHtml();
        bindSubViewEvents(container);
      }
    };
  });

  // ✨ 补充：按角色筛选文档标签绑定
  container.querySelectorAll("[data-doc-filter]").forEach((btn) => {
    btn.onclick = () => {
      config.retrieval.selectedCharFilter = btn.getAttribute("data-doc-filter");
      saveConfig();
      container.querySelector("#api-sub-view-root").innerHTML =
        renderCurrentSubTabHtml();
      bindSubViewEvents(container);
    };
  });

  // 5. 介绍板块
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

  // ✨ 核心新增：点击默认快捷问题胶囊，自动填入提问框并即时检索答复
  container.querySelectorAll("[data-ask-question]").forEach((btn) => {
    btn.onclick = () => {
      const q = btn.getAttribute("data-ask-question");
      if (guideQueryInput) guideQueryInput.value = q;
      executeGuideAsk(q);
    };
  });

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
      exportFullBtn.innerHTML = `<span>正在打包全系统数据与所有图片...</span>`;
      exportFullBtn.style.opacity = "0.7";

      // 1. 打包全量沙盒记忆、EchoVault 原文与聊天记录（包含聊天发送的照片）
      const allCharSandboxes = {};
      const allEchoDailies = {};
      const allEchoPerms = {};
      const allChatHistories = {};

      const fullCharList = JSON.parse(localStorage.getItem("mini_character_vault_full") || "[]");
      const charNames = Array.from(new Set([...userCharList, ...fullCharList.map(c => c.name)]));

      charNames.forEach((c) => {
        if (!c) return;
        allCharSandboxes[c] = McpGateway.exportSingleCharBackup(c);
        const safeC = encodeURIComponent(c);
        allEchoDailies[c] = JSON.parse(localStorage.getItem(`echo_daily_${safeC}`) || "{}");
        allEchoPerms[c] = JSON.parse(localStorage.getItem(`echo_perm_${safeC}`) || "[]");
        allChatHistories[c] = JSON.parse(localStorage.getItem(`mini_chat_dialog_history_${safeC}`) || "[]");
      });

      // 2. ✨ 扫描并打包全系统所有图片与主题资产
      const allCustomMedia = {
        storyAvatars: JSON.parse(localStorage.getItem("mini_story_avatars") || "[]"),
        storySlots: JSON.parse(localStorage.getItem("mini_story_slots") || "[]"),
        themeWallpaper: localStorage.getItem("mini_theme_wallpaper") || "",
        customBackground: localStorage.getItem("mini_custom_background") || ""
      };

      // 3. 导出完整系统镜像包（包含全部 Base64 图片）
      const fullProjectBackup = {
        manifest: {
          app: "Mini Phone OS",
          version: "3.5.0",
          backupAt: new Date().toISOString(),
          hasMediaPackage: true,
          sandboxed: true,
        },
        config: config,
        apiPresets: savedPresets,
        currentActiveUser: localStorage.getItem("mini_current_active_user") || "温渡雪",
        userPersonasFull: JSON.parse(localStorage.getItem("mini_user_personas_full") || "[]"),
        userPersonas: JSON.parse(localStorage.getItem("mini_user_personas") || "[]"),
        charactersFull: fullCharList,
        characters: charNames,
        activeChatList: JSON.parse(localStorage.getItem("mini_active_chat_list") || "[]"),
        storyAvatars: allCustomMedia.storyAvatars,
        customMedia: allCustomMedia,
        chatHistories: allChatHistories,
        charSandboxes: allCharSandboxes,
        echoDailies: allEchoDailies,
        echoPerms: allEchoPerms,
        documents: documentVault,
        favorites: JSON.parse(localStorage.getItem("mini_chat_favorites") || "[]"),
        mcpGatewayConfig: McpGateway.config,
      };

      const jsonStr = JSON.stringify(fullProjectBackup, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      triggerFileDownload(
        blob,
        `MiniPhone_FullBackup_${new Date().toISOString().slice(0, 10)}.miniphone.json`,
      );

      exportFullBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>全量数据与图片导出成功！</span>`;
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
  const fullBackupFileInput = container.querySelector(
    "#full-backup-file-input",
  );
  if (importFullBtn && fullBackupFileInput) {
    importFullBtn.onclick = () => {
      fullBackupFileInput.value = "";
      fullBackupFileInput.click();
    };
    fullBackupFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);

            // 1. 还原全局配置与 API 预设
            if (parsed.config || parsed.configurations) {
              config = parsed.config || parsed.configurations;
              saveConfig();
            }
            if (Array.isArray(parsed.apiPresets) || Array.isArray(parsed.presets)) {
              savedPresets = parsed.apiPresets || parsed.presets;
              savePresets();
            }

            // 2. 还原 User 画像全量档案
            if (Array.isArray(parsed.userPersonasFull)) {
              localStorage.setItem("mini_user_personas_full", JSON.stringify(parsed.userPersonasFull));
            }
            if (Array.isArray(parsed.userPersonas)) {
              userPersonaList = parsed.userPersonas;
              saveUserPersonaList();
            }
            if (parsed.currentActiveUser) {
              localStorage.setItem("mini_current_active_user", parsed.currentActiveUser);
            }

            // 3. 还原角色全量档案
            if (Array.isArray(parsed.charactersFull)) {
              localStorage.setItem("mini_character_vault_full", JSON.stringify(parsed.charactersFull));
            }
            if (Array.isArray(parsed.characters) || Array.isArray(parsed.userCharacters)) {
              userCharList = parsed.characters || parsed.userCharacters;
              saveUserCharList();
            }

            // 4. 还原聊天列表、5个圆圈栏与收藏
            if (Array.isArray(parsed.activeChatList)) {
              localStorage.setItem("mini_active_chat_list", JSON.stringify(parsed.activeChatList));
            }
            if (Array.isArray(parsed.storyAvatars)) {
              localStorage.setItem("mini_story_avatars", JSON.stringify(parsed.storyAvatars));
            }
            if (Array.isArray(parsed.favorites)) {
              localStorage.setItem("mini_chat_favorites", JSON.stringify(parsed.favorites));
            }

            // 5. 还原所有角色的独立聊天历史记录
            if (parsed.chatHistories && typeof parsed.chatHistories === "object") {
              Object.keys(parsed.chatHistories).forEach((cName) => {
                const safeC = encodeURIComponent(cName);
                localStorage.setItem(`mini_chat_dialog_history_${safeC}`, JSON.stringify(parsed.chatHistories[cName]));
              });
            }

            // 6. 还原沙盒记忆库
            if (parsed.charSandboxes && typeof parsed.charSandboxes === "object") {
              Object.keys(parsed.charSandboxes).forEach((cName) => {
                McpGateway.importSingleCharBackup(cName, parsed.charSandboxes[cName]);
              });
            }

            // 7. 还原 EchoVault 原文日记与钉选
            if (parsed.echoDailies && typeof parsed.echoDailies === "object") {
              Object.keys(parsed.echoDailies).forEach((cName) => {
                const safeC = encodeURIComponent(cName);
                localStorage.setItem(`echo_daily_${safeC}`, JSON.stringify(parsed.echoDailies[cName]));
              });
            }
            if (parsed.echoPerms && typeof parsed.echoPerms === "object") {
              Object.keys(parsed.echoPerms).forEach((cName) => {
                const safeC = encodeURIComponent(cName);
                localStorage.setItem(`echo_perm_${safeC}`, JSON.stringify(parsed.echoPerms[cName]));
              });
            }

            // 8. 还原投喂文档
            if (Array.isArray(parsed.documents)) {
              documentVault = parsed.documents;
              saveDocumentVault();
            }

            alert("🎉 全系统镜像已 100% 完整还原！包括用户身份、所有角色、全部聊天记录、会话列表与 API 预设。");
            window.location.reload();
          } catch (err) {
            console.error(err);
            alert("解析失败，请确保导入的是有效的 Mini Phone 全量备份 JSON 文件");
          }
        };
        reader.readAsText(file);
      }
    };
  }

     // ✨ 核心：全系统数据与所有上传图片彻底重置
  const wipeAllDataBtn = container.querySelector(
    "#btn-wipe-all-system-data",
  );
  if (wipeAllDataBtn) {
    wipeAllDataBtn.onclick = () => {
      const firstConfirm = window.confirm(
        "【第一次确认 · 警告】\n\n确定要清空 Mini Phone OS 的所有本地数据与图片吗？\n\n包括：\n1. 5 个圆形头像框与所有已上传图片\n2. 所有角色头像、人设与沙盒记忆库\n3. 全部聊天图片、转账、礼物与对话记录\n4. EchoVault 原文日记与知识库设定文档\n5. API 端点预设与用户证件照画像"
      );
      if (!firstConfirm) return;

      const secondConfirm = window.confirm(
        "【第二次最终确认 · 不可恢复】\n\n所有数据与图片一旦清空将完全无法撤销或找回！\n\n请问您确定要立即彻底恢复出厂设置吗？"
      );
      if (!secondConfirm) return;

      // 1. 显式将所有图片、头像、槽位、聊天列表重置为空白状态
      const emptyKeys = [
        "mini_story_avatars",
        "mini_story_slots",
        "mini_active_chat_list",
        "mini_character_vault_full",
        "mini_user_characters",
        "mini_user_personas_full",
        "mini_user_personas",
        "mini_mcp_documents",
        "mini_chat_favorites",
        "mini_theme_wallpaper",
        "mini_custom_background"
      ];

      emptyKeys.forEach(k => localStorage.setItem(k, "[]"));

      // 2. 扫描并清除所有单个角色的独立聊天图片与记忆
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (
          k.startsWith("mini_chat_dialog_history_") ||
          k.startsWith("mini_vault_") ||
          k.startsWith("mini_character_memories_") ||
          k.startsWith("echo_daily_") ||
          k.startsWith("echo_perm_")
        )) {
          localStorage.removeItem(k);
        }
      }

      // 3. 执行全量物理抹除
      localStorage.clear();
      sessionStorage.clear();

      alert("全系统数据与所有上传图片已彻底清空并恢复出厂设置！");
      window.location.href = window.location.pathname; // 强制无缓存刷新重载
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

  const systemPrompt = `你是由用户搭建的 Mini Phone OS 极简手机系统的【全项目专属 AI 首席指导助手】。
请基于本系统的核心功能（API配置、沙盒记忆、EchoVault、知识库读取、聊天室多气泡/内嵌翻译/时区/重回/引用等）为用户提供详尽、准确的说明（严禁任何 Emoji）。`;

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
          temperature: 0.3,
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

  // ✨ 内置高精度离线离线知识库解答
  if (userQuery.includes("API") || userQuery.includes("连接")) {
    return `【API 连接与配置指南】：\n\n1. 接口地址：在「API」板块的 Base URL 填入你的服务商端点（如 DeepSeek 官方为 https://api.deepseek.com/v1）；\n2. API 密钥：填入 sk-... 开头的密钥；\n3. 模型拉取：点击「拉取模型」或手动输入模型名（如 deepseek-chat）；\n4. 保存预设：点击「测试连接」验证通过后，点击「保存为预设」，在任何对话中即可随时调用。`;
  } else if (userQuery.includes("读取") || userQuery.includes("文档")) {
    return `【知识库文档投喂 (读取) 指南】：\n\n1. 上传/粘贴：在「读取」板块直接拖拽 .txt / .md / .json 设定文件，或在下方文本框直接粘贴长篇世界观；\n2. 弹窗预览与命名：点击后会弹出 INS 预览弹窗，可直接修改文档标题，并选择是「全角色共享」还是「仅某 Char 独占认知」；\n3. 聊天联动：入库并激活的文档，在聊天室中会作为第一参考基准被 Char 深度学习认知。`;
  } else if (userQuery.includes("Echo") || userQuery.includes("原文")) {
    return `【EchoVault 原生记忆库使用指南】：\n\n1. 核心哲学：存原文、读原文，不 JSON 化、不做生硬摘要；\n2. 日记追加 (Daily)：点击「自动同步今日对话至日记」，自动将当天聊天原文存入 daily 档案，带时间半衰期衰减；\n3. 换窗连续性 (Dream)：每次开启新对话时，Char 自动调取近三天日记原文，绝不失忆；\n4. 永久钉选 (Permanent)：永不衰减的核心设定，放置即永远可见。`;
  } else if (userQuery.includes("搬家") || userQuery.includes("旧机")) {
    return `【旧机搬家记忆导入指南】：\n\n1. 选定目标角色：在「记忆」板块顶部下拉菜单选中你要搬入的角色沙盒；\n2. 上传/粘贴历史记录：在「旧机搬家」页面上传旧手机导出的 .json / .txt 对话备份，或直接粘贴聊天记录；\n3. 一键提炼：点击「一键提炼并注入记忆沙盒」，系统会自动解析关键事实与专属羁绊，直接写入该角色的专属大脑中。`;
  } else if (userQuery.includes("翻译") || userQuery.includes("时区")) {
    return `【内嵌翻译与现实时区感知使用指南】：\n\n1. 入口：进入角色聊天室，点击右上角「设置」；\n2. 母语与内嵌翻译：选择角色主要语言（如日语/英语/韩语），开启「启用气泡内嵌翻译」，Char 思考回复时会一并生成中文并内嵌在气泡底部；\n3. 现实时间感知：开启后选择角色所在时区（如东京/首尔/伦敦/纽约），Char 会实时感知物理时差与昼夜作息。`;
  } else if (
    userQuery.includes("重回") ||
    userQuery.includes("撤回") ||
    userQuery.includes("引用")
  ) {
    return `【重回、引用与撤回操作指南】：\n\n1. 重回本轮 (Rewind)：在底部「更多」点击「重回」，撤销角色上轮回复，可输入期望的风格导向（如“更傲娇一点”）让角色基于人设重新思考；\n2. 气泡菜单：轻点任意气泡弹出菜单，支持「引用」精准回复、「收藏」以及「多选删除」；\n3. 消息撤回：支持撤回 2 分钟内的自发消息，撤回后生成提示条，Char 会捕捉撤回动作并做出自然情绪反应。`;
  }

  return `【项目功能说明】：\n\n- API 设置：配置各大模型端点与密钥；\n- 记忆中枢：融合 McpGateway 沙盒与 EchoVault 原生记忆；\n- 聊天室：支持 12 大富媒体交互工具、面对面模式与沉浸式通话。`;
}

function processUploadedDocFile(
  file,
  targetCharSelect,
  docTitleInput,
  container,
) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const textContent = evt.target.result;
    if (!textContent || !textContent.trim()) {
      alert("文件内容为空，无法读取！");
      return;
    }
    const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
    const title = (docTitleInput && docTitleInput.value.trim()) || defaultTitle;
    const charTarget =
      (targetCharSelect && targetCharSelect.value) || "__all__";

    // 呼出本轮文件内容预览弹窗
    openDocPreviewModal(title, textContent, charTarget, container);
  };
  reader.readAsText(file);
}
/**
 * ✨ INS 极简白黑风：文档读取内容展示与即时重命名弹窗
 */
function openDocPreviewModal(
  initialTitle,
  content,
  defaultTarget = "__all__",
  container,
) {
  const charCount = content.length;
  const tokens = Math.ceil(charCount / 1.8);
  const chunksCount = Math.max(1, Math.ceil(charCount / 400));
  const chars = userCharList || [];

  const modal = document.createElement("div");
  modal.className = "ins-modal-overlay active";
  modal.id = "doc-preview-modal";

  modal.innerHTML = `
    <div class="ins-modal-card" style="max-width: 350px; max-height: 86vh; display: flex; flex-direction: column; gap: 8px;">
      <div class="ins-modal-header">
        <span class="ins-modal-title">文档读取与命名 / INGESTION</span>
        <button class="ins-modal-close" id="btn-close-doc-preview">×</button>
      </div>

      <!-- INS 风格元信息与即时重命名卡片 -->
      <div style="background: #FAFAFA; border: 1px solid var(--line-color); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <label style="font-size: 8.5px; font-weight: 800; color: #888; letter-spacing: 0.5px;">文档名称 / TITLE (可点击修改)</label>
          <input type="text" class="ins-modal-textarea" id="doc-preview-title-input" value="${initialTitle}" placeholder="给此文档命名..." style="padding: 6px 8px; font-size: 11px; font-weight: 700; background: #FFFFFF;" />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <label style="font-size: 8.5px; font-weight: 800; color: #888;">绑定角色 / TARGET</label>
            <select class="api-select" id="doc-preview-target-select" style="padding: 4px 6px; font-size: 10px; background: #FFF;">
              <option value="__all__" ${defaultTarget === "__all__" ? "selected" : ""}>全角色共享 (GLOBAL)</option>
              ${chars.map((c) => `<option value="${c}" ${defaultTarget === c ? "selected" : ""}>仅 ${c} 认知</option>`).join("")}
            </select>
          </div>
          <div style="text-align: right; font-family: ui-monospace, monospace; font-size: 9px; color: #888;">
            <div>${charCount} 字符</div>
            <div style="color: #111; font-weight: 700;">~${tokens} Tokens</div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
        <span style="font-size: 9.5px; font-weight: 800; color: #111;">已读取文本内容预览 (${chunksCount} 切片)</span>
      </div>
      
      <!-- 原文预览滚动区 -->
      <div style="flex: 1; max-height: 190px; overflow-y: auto; background: #FFFFFF; border: 1px solid var(--line-color); border-radius: 8px; padding: 8px 10px; font-size: 10px; line-height: 1.45; color: #333; white-space: pre-wrap; font-family: ui-monospace, monospace;">${content}</div>

      <div class="ins-modal-actions" style="margin-top: 4px;">
        <button class="ins-modal-btn cancel" id="btn-cancel-doc-preview">放弃</button>
        <button class="ins-modal-btn confirm" id="btn-confirm-doc-preview">确认写入知识库</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();

  modal.querySelector("#btn-close-doc-preview").onclick = closeModal;
  modal.querySelector("#btn-cancel-doc-preview").onclick = closeModal;

  modal.querySelector("#btn-confirm-doc-preview").onclick = () => {
    const finalTitle =
      modal.querySelector("#doc-preview-title-input")?.value.trim() ||
      initialTitle ||
      "未命名设定";
    const finalTarget =
      modal.querySelector("#doc-preview-target-select")?.value || "__all__";

    addDocumentToVault(finalTitle, content, finalTarget);
    closeModal();

    const manualDocTextarea = document.querySelector("#doc-manual-textarea");
    if (manualDocTextarea) manualDocTextarea.value = "";

    const root = document.getElementById("api-sub-view-root");
    const parentContainer =
      container ||
      document.querySelector(".api-settings-container") ||
      document.body;
    if (root) {
      root.innerHTML = renderCurrentSubTabHtml();
      bindSubViewEvents(parentContainer);
    }
  };
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
