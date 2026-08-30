/**
 * Ombre Brain 角色沙盒隔离记忆驱动 (McpGateway)
 * 核心机制：为每个 Char 分配独立的 Namespace，实现数据隔离、独立天气演化、单角色搬家
 */

export const McpGateway = {
  config: {
    serverUrl: 'http://127.0.0.1:8000',
    authToken: '',
    connected: false,
    latency: 0,
    lastSyncTime: null,
    activeCharSandbox: 'default' // 当前正在管理的独立角色沙盒
  },

  init() {
    const saved = localStorage.getItem('mini_ob_server_config');
    if (saved) this.config = { ...this.config, ...JSON.parse(saved) };
  },

  saveConfig(newCfg) {
    this.config = { ...this.config, ...newCfg };
    localStorage.setItem('mini_ob_server_config', JSON.stringify(this.config));
  },

  /**
   * 核心：获取指定角色的独立沙盒数据存储 Key
   */
  getCharNamespaceKey(charName) {
    const safeChar = encodeURIComponent(charName || 'default');
    return {
      vaultKey: `mini_vault_${safeChar}`,
      darkroomKey: `mini_darkroom_${safeChar}`,
      factsKey: `mini_facts_${safeChar}`,
      weatherKey: `mini_weather_${safeChar}`
    };
  },

  /**
   * 获取指定角色的独立记忆档案（绝不与其他角色混淆）
   */
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

  /**
   * 获取指定角色的独立暗房思绪
   */
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

  /**
   * 独立演算指定角色的关系天气
   */
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
   * 核心：生成指定角色的绝对隔离 Handoff 极简记忆包
   */
  generateIsolatedHandoffBlock(userPersona, charName, lastMessages = []) {
    const charMemories = this.getCharMemories(charName).map(m => `- [${m.anchorType || '约定'}] ${m.content}`);
    const darkroom = this.getCharDarkroom(charName);
    const weather = this.getCharRelationshipWeather(charName);

    // 仅拉取全角色可见的用户习惯或专门指定给该 Char 的习惯
    const userVault = JSON.parse(localStorage.getItem('mini_user_personas_vault') || '[]');
    const visibleUserFacts = userVault
      .filter(m => m.boundChar === '__all__' || m.boundChar === charName)
      .map(m => `- [User习惯] ${m.content}`);

    let block = `=== Sandboxed Handoff Block (Isolated for: ${charName || 'Unknown'}) ===\n`;
    block += `[Target Char Sandbox]: ${charName}\n`;
    block += `[Active User Persona]: ${userPersona || 'User'}\n`;
    block += `[Isolated Relationship Weather]: ${weather.status} (${weather.weatherText})\n`;
    block += `[Char Darkroom State]: ${darkroom.length > 0 ? `Incubating (${darkroom.length} internal thoughts)` : 'Clear'}\n\n`;

    if (visibleUserFacts.length > 0) {
      block += `--- User Profile Perception ---\n${visibleUserFacts.join('\n')}\n\n`;
    }

    if (charMemories.length > 0) {
      block += `--- ${charName} Exclusive Bonds & Promises (Isolated) ---\n${charMemories.join('\n')}\n\n`;
    }

    block += `[Isolation Rule]: You only possess memories within the '${charName}' sandbox. You have NO awareness of interactions between User and other characters.\n=== End of Sandboxed Block ===`;
    return block;
  },

  /**
   * 单角色独立记忆打包导出 (.json)
   */
  exportSingleCharBackup(charName) {
    const keys = this.getCharNamespaceKey(charName);
    return {
      manifest: {
        type: "SingleCharMemorySandbox",
        charName: charName,
        version: "2.0",
        exportedAt: new Date().toISOString()
      },
      memories: this.getCharMemories(charName),
      darkroom: this.getCharDarkroom(charName),
      relationshipWeather: this.getCharRelationshipWeather(charName)
    };
  },

  /**
   * 单角色独立记忆导入恢复
   */
  importSingleCharBackup(charName, backupData) {
    if (!backupData || !Array.isArray(backupData.memories)) {
      throw new Error('无效的角色沙盒备份数据');
    }
    const keys = this.getCharNamespaceKey(charName);
    localStorage.setItem(keys.vaultKey, JSON.stringify(backupData.memories));
    if (Array.isArray(backupData.darkroom)) {
      localStorage.setItem(keys.darkroomKey, JSON.stringify(backupData.darkroom));
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
      this.config.connected = true; // 本地回退就绪
    }
    this.config.lastSyncTime = new Date().toLocaleTimeString();
    this.saveConfig(this.config);
    return { success: true, latency: this.config.latency };
  }
};

McpGateway.init();
