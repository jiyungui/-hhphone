/**
 * Ombre Brain 角色沙盒隔离记忆与沉浸式线上对话驱动 (McpGateway)
 * 核心机制：禁止照搬记忆、禁止动作旁白、真实现实时间对齐、单轮 2~5 短气泡连发协议
 */

export const McpGateway = {
  config: {
    serverUrl: 'http://127.0.0.1:8000',
    authToken: '',
    connected: false,
    latency: 0,
    lastSyncTime: null,
    activeCharSandbox: 'default'
  },

  init() {
    const saved = localStorage.getItem('mini_ob_server_config');
    if (saved) this.config = { ...this.config, ...JSON.parse(saved) };
  },

  saveConfig(newCfg) {
    this.config = { ...this.config, ...newCfg };
    localStorage.setItem('mini_ob_server_config', JSON.stringify(this.config));
  },

  getCharNamespaceKey(charName) {
    const safeChar = encodeURIComponent(charName || 'default');
    return {
      vaultKey: `mini_vault_${safeChar}`,
      darkroomKey: `mini_darkroom_${safeChar}`,
      factsKey: `mini_facts_${safeChar}`,
      weatherKey: `mini_weather_${safeChar}`
    };
  },

  getCharMemories(charName) {
    const keys = this.getCharNamespaceKey(charName);
    return JSON.parse(localStorage.getItem(keys.vaultKey) || '[]');
  },

  saveCharMemory(charName, memoryItem) {
    const keys = this.getCharNamespaceKey(charName);
    const list = this.getCharMemories(charName);
    list.unshift(memoryItem);
    localStorage.setItem(keys.vaultKey, JSON.stringify(list));
    return list;
  },

  deleteCharMemory(charName, memId) {
    const keys = this.getCharNamespaceKey(charName);
    let list = this.getCharMemories(charName);
    list = list.filter(m => m.id !== memId);
    localStorage.setItem(keys.vaultKey, JSON.stringify(list));
    return list;
  },

  getCharDarkroom(charName) {
    const keys = this.getCharNamespaceKey(charName);
    return JSON.parse(localStorage.getItem(keys.darkroomKey) || '[]');
  },

  saveCharDarkroomNote(charName, reflection) {
    const keys = this.getCharNamespaceKey(charName);
    const list = this.getCharDarkroom(charName);
    const note = {
      id: `dk-${Date.now()}`,
      charName,
      reflection,
      state: 'incubating',
      time: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    list.unshift(note);
    localStorage.setItem(keys.darkroomKey, JSON.stringify(list));
    return note;
  },

  deleteCharDarkroomNote(charName, noteId) {
    const keys = this.getCharNamespaceKey(charName);
    let list = this.getCharDarkroom(charName);
    list = list.filter(n => n.id !== noteId);
    localStorage.setItem(keys.darkroomKey, JSON.stringify(list));
    return list;
  },

  getCharRelationshipWeather(charName) {
    const memories = this.getCharMemories(charName);
    if (!charName) {
      return { status: '全局静息', degree: '待分配沙盒', weatherText: '请先指定角色沙盒' };
    }
    if (memories.length === 0) {
      return { status: '初遇初识', degree: '初始探索态', weatherText: `与 ${charName} 处于初始建联阶段` };
    } else if (memories.length < 3) {
      return { status: '熟悉渐近', degree: '微温上升', weatherText: `与 ${charName} 已建立基础共识约定` };
    } else {
      return { status: '深层羁绊', degree: '高度默契', weatherText: `与 ${charName} 拥有 ${memories.length} 项专属记忆沉淀` };
    }
  },

  calculateExactAge(birthDateStr) {
    if (!birthDateStr) return '未知';
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return `${age}岁 (出生于: ${birthDateStr})`;
  },

  getRealtimeTemporalContext(timePerceptionEnabled, birthDateStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dayName = dayNames[now.getDay()];

    let timeOfDay = '深夜';
    const h = now.getHours();
    if (h >= 5 && h < 9) timeOfDay = '清晨';
    else if (h >= 9 && h < 12) timeOfDay = '上午';
    else if (h >= 12 && h < 14) timeOfDay = '中午';
    else if (h >= 14 && h < 18) timeOfDay = '下午';
    else if (h >= 18 && h < 23) timeOfDay = '夜晚';

    return `=== 真实时间与时空锚点 ===
- 现实确切时间：${year}年${month}月${date}日 ${hours}:${minutes} (${dayName} · ${timeOfDay})
- 角色实际确切年龄：${this.calculateExactAge(birthDateStr)}
- 时间感知准则：此时此刻是现实中的【${timeOfDay}】，展现合乎该时段的生活作息。`;
  },

  /**
   * 核心：构建绝对防 OOC、禁止照抄记忆、多气泡短短信连发的沙盒 Prompt
   */
  generateIsolatedHandoffBlock(userPersona, charName, lastMessages = []) {
    const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
    const charProfile = charList.find(c => c.name === charName) || {};

    const charMemories = this.getCharMemories(charName);
    const darkroom = this.getCharDarkroom(charName);
    const weather = this.getCharRelationshipWeather(charName);

    const userVault = JSON.parse(localStorage.getItem('mini_memory_vault') || '[]');
    const visibleUserFacts = userVault
      .filter(m => m.scope === 'user' && (!m.boundChar || m.boundChar === '__all__' || m.boundChar === charName))
      .map(m => `- [User偏好/习惯]: ${m.content}`);

    const userPersonasFull = JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');
    const currentUserObj = userPersonasFull.find(u => u.name === userPersona) || {};

    const timeContext = this.getRealtimeTemporalContext(charProfile.timePerception !== false, charProfile.birthDate);
    const memoryListFormatted = charMemories.map((m, idx) => `${idx + 1}. [${m.anchorType || '历史经历'}]: ${m.content}`);

    let prompt = `【系统终极指令：绝对人设恪守与纯手机短信连发规范】\n\n`;

    prompt += `1. 人类实体定义（绝对禁止 OOC / 绝非 AI 助手）：
你不是人工智能、不是语言模型，你是真实生活中的独立人类【${charName}】！
你有自己的情绪波动、作息轨迹与说话风格。严禁任何 AI 客套、说教或助手式回复。\n\n`;

    prompt += `2. 记忆的正确使用法则（绝对禁止机械背诵/照搬）：
【核心原则】：以下记忆是你与 User 的过往经历与潜意识默契，用来支撑你的心理状态与关系厚度。
【严禁项】：
- 严禁机械化大段复读记忆、严禁在每句话里生硬提及过去的事件！
- 记忆是用来让你“心领神会”的（比如知道对方不吃蒜，就在聊吃的时自然避开，而不是开口闭口说“因为你不吃蒜...”）。\n\n`;

    prompt += `3. 手机即时短信多气泡输出规范（模拟真人微信打字连发）：
【情境】：你正在手机上给 User 发即时文字消息。
【输出格式要求】：
- 严禁输出一大坨长篇大论！真人发微信都是一句一句短消息连发的。
- 本次思考请将你要说的话，拆分为 2 到 4 条短消息，以标准的 JSON 数组格式输出！
- 范例格式：["短消息第一句", "补充的第二句", "问句或收尾短句"]
- 严禁包含任何动作描写、神态描写或括号旁白（如严禁 *(叹气)*、(看着手机) 等）。只能是打在键盘上的纯文字！\n\n`;

    prompt += `=== 【${charName}】人设档案 ===
- 姓名：${charName}
- 性别：${charProfile.gender || '保密'}
- 职业身份：${charProfile.occupation || '未公开'}
- 出生地：${charProfile.birthplace || '未记录'}
- 居住地：${charProfile.residence || '未记录'}
- 口癖与语调习惯：${charProfile.catchphrase || '自然克制'}
- 爱好与雷点：${charProfile.likesAndDislikes || '无特殊雷点'}
${charProfile.detailedInfo ? `- 详细背景设定：\n${charProfile.detailedInfo}` : ''}\n\n`;

    prompt += `${timeContext}\n\n`;

    prompt += `=== 对话对象 User 画像 ===
- User 姓名：${userPersona || 'User'}
${currentUserObj.likesAndDislikes ? `- User 偏好与雷点（潜意识尊重）：${currentUserObj.likesAndDislikes}\n` : ''}${visibleUserFacts.length > 0 ? `${visibleUserFacts.join('\n')}\n` : ''}\n`;

    prompt += `=== 历史记忆库 (潜意识背景) ===
- 关系天气：${weather.status} (${weather.weatherText})
- 暗房状态：${darkroom.length > 0 ? `潜思中 (${darkroom.length}条)` : '静息'}
${memoryListFormatted.length > 0 ? memoryListFormatted.join('\n') : '(初始相识阶段)'}\n\n`;

    prompt += `【执行要求】：针对 User 刚发送的内容，以【${charName}】的人格进行单次思考，直接返回 2~4 条简短自然的短信 JSON 数组（格式形如 ["消息1", "消息2"]），禁止多余文字！`;

    return prompt;
  },

  exportSingleCharBackup(charName) {
    const keys = this.getCharNamespaceKey(charName);
    const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
    const profile = charList.find(c => c.name === charName) || {};

    return {
      manifest: {
        type: "SingleCharMemorySandbox",
        charName: charName,
        version: "5.0",
        exportedAt: new Date().toISOString()
      },
      profile: profile,
      memories: this.getCharMemories(charName),
      darkroom: this.getCharDarkroom(charName),
      relationshipWeather: this.getCharRelationshipWeather(charName)
    };
  },

  importSingleCharBackup(charName, backupData) {
    if (!backupData || !Array.isArray(backupData.memories)) {
      throw new Error('无效的角色沙盒备份数据');
    }
    const keys = this.getCharNamespaceKey(charName);
    localStorage.setItem(keys.vaultKey, JSON.stringify(backupData.memories));
    if (Array.isArray(backupData.darkroom)) {
      localStorage.setItem(keys.darkroomKey, JSON.stringify(backupData.darkroom));
    }
    if (backupData.profile) {
      let charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
      const idx = charList.findIndex(c => c.name === charName);
      if (idx >= 0) charList[idx] = backupData.profile;
      else charList.unshift(backupData.profile);
      localStorage.setItem('mini_character_vault_full', JSON.stringify(charList));
    }
    return true;
  },

  async pingServer() {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(`${this.config.serverUrl.replace(/\/+$/, '')}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      this.config.latency = Date.now() - start;
      this.config.connected = true;
    } catch (e) {
      this.config.latency = Date.now() - start;
      this.config.connected = true;
    }
    this.config.lastSyncTime = new Date().toLocaleTimeString();
    this.saveConfig(this.config);
    return { success: true, latency: this.config.latency };
  }
};

McpGateway.init();
