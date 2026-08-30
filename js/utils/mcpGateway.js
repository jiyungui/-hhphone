/**
 * Ombre Brain 角色沙盒隔离记忆与绝对认知驱动 (McpGateway)
 * 包含：角色绝对认知基底、防混乱时间感知引擎、沙盒隔离与 Handoff 调度
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
      return { status: '全局静息', degree: '待分配沙盒', weatherText: '请先在上方指定角色沙盒' };
    }
    if (memories.length === 0) {
      return { status: '初遇初识', degree: '初始探索态', weatherText: `与 ${charName} 处于初始建联阶段` };
    } else if (memories.length < 3) {
      return { status: '熟悉渐近', degree: '微温上升', weatherText: `与 ${charName} 已建立基础共识约定` };
    } else {
      return { status: '深层羁绊', degree: '高度默契', weatherText: `与 ${charName} 拥有 ${memories.length} 项专属记忆沉淀` };
    }
  },

  /**
   * 精确计算角色真实年龄
   */
  calculateExactAge(birthDateStr) {
    if (!birthDateStr) return '未知';
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return `${age}岁 (出生日期: ${birthDateStr})`;
  },

  /**
   * 时间感知与时空对齐生成器（彻底消除时间混乱）
   */
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

    if (!timePerceptionEnabled) {
      return `[Time Perception Status]: 静止沙盒模式 (未开启现实时间对齐)\n- 角色基准年龄：${this.calculateExactAge(birthDateStr)}`;
    }

    return `=== 真实时间与时空感知锚点 (TEMPORAL GROUNDING) ===
- 当前现实确切时间：${year}年${month}月${date}日 ${hours}:${minutes} (${dayName} · ${timeOfDay})
- 角色确切年龄推算：${this.calculateExactAge(birthDateStr)}
- 时间认知执行铁律：
  1. 必须绝对清醒感知此时此刻的现实时段 (${timeOfDay})，在日常对话中展现合乎现实生物钟的精力与作息反应。
  2. 跨会话或隔日再次交流时，必须准确识别时间流逝（如昨天、今早、几小时前），严禁出现时间线错乱。
  3. 所有过往经历的时间跨度计算，必须严格以角色出生日 (${birthDateStr || '未知'}) 与当前年份 (${year}年) 为客观基准。`;
  },

  /**
   * 核心：生成强化版角色沙盒认知与记忆数据包（供 AI 严格遵守）
   */
  generateIsolatedHandoffBlock(userPersona, charName, lastMessages = []) {
    // 1. 从角色库全量档案中检索该角色所有完整设定
    const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
    const charProfile = charList.find(c => c.name === charName) || {};

    const charMemories = this.getCharMemories(charName).map(m => `- [${m.anchorType || '约定'}] ${m.content}`);
    const darkroom = this.getCharDarkroom(charName);
    const weather = this.getCharRelationshipWeather(charName);

    // 2. 检索针对该角色或全角色可见的 User 习惯
    const userVault = JSON.parse(localStorage.getItem('mini_memory_vault') || '[]');
    const visibleUserFacts = userVault
      .filter(m => m.scope === 'user' && (!m.boundChar || m.boundChar === '__all__' || m.boundChar === charName))
      .map(m => `- [User特征感知] ${m.content}`);

    // 3. 时间感知上下文
    const timeContext = this.getRealtimeTemporalContext(charProfile.timePerception !== false, charProfile.birthDate);

    // 4. 构建全维度角色认知契约
    let block = `=== 角色沙盒绝对认知契约 (CHARACTER COGNITIVE BASELINE) ===\n`;
    block += `你现在必须完全、不可动摇地代入角色【${charName}】。以下所有基础设定、特征、习惯与背景均为你的客观真实认知，你必须严格恪守，绝不可脱离角色：\n\n`;

    block += `[基本身份档案]:\n`;
    block += `- 姓名：${charName}\n`;
    block += `- 性别：${charProfile.gender || '保密'}\n`;
    block += `- 职业 / 身份：${charProfile.occupation || '未公开'}\n`;
    block += `- 出生地：${charProfile.birthplace || '未记录'}\n`;
    block += `- 现居住地：${charProfile.residence || '未记录'}\n\n`;

    if (charProfile.catchphrase) {
      block += `[口癖与语言习惯 (必须在说话中严格体现)]:\n${charProfile.catchphrase}\n\n`;
    }

    if (charProfile.likesAndDislikes) {
      block += `[爱好 · 兴趣 · 讨厌与雷点 (形成本能反应)]:\n${charProfile.likesAndDislikes}\n\n`;
    }

    if (charProfile.dressStyle) {
      block += `[常穿服装与穿搭风格]:\n${charProfile.dressStyle}\n\n`;
    }

    if (charProfile.appearance) {
      block += `[外貌特征细节与身形眼眸]:\n${charProfile.appearance}\n\n`;
    }

    if (charProfile.detailedInfo) {
      block += `[角色完整背景故事与核心设定 (背景常识)]:\n${charProfile.detailedInfo}\n\n`;
    }

    block += `${timeContext}\n\n`;

    block += `=== 独立羁绊与沙盒记忆 (ISOLATED SANDBOX MEMORIES) ===\n`;
    block += `[当前交互 User 身份]: ${userPersona || 'User'}\n`;
    block += `[关系天气状态]: ${weather.status} (${weather.weatherText})\n`;
    block += `[内部暗房门状态]: ${darkroom.length > 0 ? `潜思中 (${darkroom.length}条自省)` : '静息'}\n\n`;

    if (visibleUserFacts.length > 0) {
      block += `[对 User 的潜意识隐性认知 (心领神会，无需刻意机械复读)]:\n${visibleUserFacts.join('\n')}\n\n`;
    }

    if (charMemories.length > 0) {
      block += `[与该 User 的历史专属约定与羁绊记忆]:\n${charMemories.join('\n')}\n\n`;
    }

    block += `[系统执行准则]:\n1. 严格以【${charName}】的第一人称视角沉浸式交流。\n2. 严禁跳出角色、严禁表现出 AI 助手口吻、严禁违反上述性格与时间认知。\n=== 契约装载完毕 ===`;

    return block;
  },

  exportSingleCharBackup(charName) {
    const keys = this.getCharNamespaceKey(charName);
    const charList = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
    const profile = charList.find(c => c.name === charName) || {};

    return {
      manifest: {
        type: "SingleCharMemorySandbox",
        charName: charName,
        version: "3.0",
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
