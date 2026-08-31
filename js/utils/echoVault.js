/**
 * EchoVault 原生记忆引擎与 Python MCP 桥接器
 * 双模运行：优先连接 Python server.py (127.0.0.1:8765)，离线时自动切换本地引擎
 */

export const EchoVault = {
  config: {
    mcpServerUrl: "http://127.0.0.1:8765",
    isMcpConnected: false,
    lastPingTime: null
  },

  // ════════════ 0. 探测 Python MCP 服务状态 ════════════
  async pingPythonServer() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.config.mcpServerUrl}/tools`, { signal: controller.signal });
      clearTimeout(timeoutId);
      this.config.isMcpConnected = res.ok;
    } catch (e) {
      this.config.isMcpConnected = false;
    }
    this.config.lastPingTime = new Date().toLocaleTimeString();
    return this.config.isMcpConnected;
  },

  // 调用 Python MCP 服务的通用工具函数
  async callPythonTool(toolName, args = {}) {
    try {
      const res = await fetch(`${this.config.mcpServerUrl}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolName, arguments: args })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, data: data.result || data };
      }
    } catch (e) {
      this.config.isMcpConnected = false;
    }
    return { success: false };
  },

  // ════════════ 1. 本地存储命名空间 ════════════
  getStorageKeys(charName = "default") {
    const safe = encodeURIComponent(charName || "default");
    return {
      daily: `echo_daily_${safe}`,
      permanent: `echo_perm_${safe}`,
      archive: `echo_archive_${safe}`,
    };
  },

  getDailies(charName) {
    const keys = this.getStorageKeys(charName);
    return JSON.parse(localStorage.getItem(keys.daily) || "{}");
  },

  saveDailies(charName, data) {
    const keys = this.getStorageKeys(charName);
    localStorage.setItem(keys.daily, JSON.stringify(data));
  },

  getPermanents(charName) {
    const keys = this.getStorageKeys(charName);
    return JSON.parse(localStorage.getItem(keys.permanent) || "[]");
  },

  savePermanents(charName, list) {
    const keys = this.getStorageKeys(charName);
    localStorage.setItem(keys.permanent, JSON.stringify(list));
  },

  getArchives(charName) {
    const keys = this.getStorageKeys(charName);
    return JSON.parse(localStorage.getItem(keys.archive) || "[]");
  },

  saveArchives(charName, list) {
    const keys = this.getStorageKeys(charName);
    localStorage.setItem(keys.archive, JSON.stringify(list));
  },

  // ════════════ 2. 衰减计算引擎 ════════════
  calculateDecayScore(importance, hits, createdDateStr) {
    const imp = parseInt(importance || 5, 10);
    const h = parseInt(hits || 0, 10);
    const created = new Date(createdDateStr || Date.now());
    const now = new Date();
    const daysOld = Math.max((now - created) / (1000 * 60 * 60 * 24), 0);

    const halfLife = Math.max(imp * 10, 1);
    const decay = Math.exp((-Math.log(2) / halfLife) * daysOld);
    const bonus = 1 + 0.35 * Math.log(1 + h);
    return Number((imp * decay * bonus).toFixed(2));
  },

  // ════════════ 3. 8 大工具（支持 Python 后端与本地双模） ════════════

  // 工具 1：check
  check(charName) {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);
    const dailyCount = Object.keys(dailies).length;
    const permCount = perms.length;

    const greetings = [
      "欢迎回来。今天想翻翻哪段记忆？",
      "记忆库在等你。搜点什么，还是随便看看？",
      "旧日记在慢慢沉底，新故事还在写。想做什么？",
      "你有一整柜子的回忆。想打开哪一扇？",
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    return {
      dailyCount,
      permCount,
      greeting,
      isPythonConnected: this.config.isMcpConnected,
      displayText: `日记: ${dailyCount}篇 | 钉选: ${permCount}条 | ${greeting}`,
    };
  },

  // 工具 2：write
  async write(charName, content, type = "daily", importance = 5, tags = "", title = "") {
    if (!content || !content.trim()) return false;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(0, 19).replace("T", " ");

    // 如果 Python 在线，同步发给 Python 写入真实 .md 文件
    if (this.config.isMcpConnected) {
      this.callPythonTool("write", { content, type, importance, tags, title });
    }

    // 本地缓存双写
    if (type === "daily") {
      const dailies = this.getDailies(charName);
      if (!dailies[dateStr]) {
        dailies[dateStr] = {
          meta: {
            type: "daily",
            created: timeStr,
            importance: parseInt(importance, 10) || 5,
            tags: tags || "日常",
            hits: 0,
          },
          content: content.trim(),
          comments: [],
        };
      } else {
        dailies[dateStr].content += `\n\n---\n\n${content.trim()}`;
        if (importance > dailies[dateStr].meta.importance) {
          dailies[dateStr].meta.importance = importance;
        }
      }
      this.saveDailies(charName, dailies);
      return { success: true, date: dateStr, type: "daily" };
    } else {
      const perms = this.getPermanents(charName);
      const permItem = {
        id: `perm-${Date.now()}`,
        title: title || content.slice(0, 12) || "未命名钉选",
        meta: {
          type: "permanent",
          created: timeStr,
          importance: 10,
          tags: tags || "核心设定",
          hits: 0,
        },
        content: content.trim(),
      };
      perms.unshift(permItem);
      this.savePermanents(charName, perms);
      return { success: true, id: permItem.id, type: "permanent" };
    }
  },

  // 工具 3：recall
  recall(charName, query = "", id = "") {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);

    if (id) {
      if (dailies[id]) {
        dailies[id].meta.hits = (dailies[id].meta.hits || 0) + 1;
        this.saveDailies(charName, dailies);
        return { found: true, type: "daily", data: dailies[id] };
      }
      const perm = perms.find((p) => p.id === id || p.title === id);
      if (perm) {
        perm.meta.hits = (perm.meta.hits || 0) + 1;
        this.savePermanents(charName, perms);
        return { found: true, type: "permanent", data: perm };
      }
      return { found: false, msg: `未找到 ID 为 [${id}] 的记忆` };
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const matchedPerms = perms.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.meta.tags && p.meta.tags.toLowerCase().includes(q)),
      );
      const matchedDailies = [];

      Object.keys(dailies).forEach((dKey) => {
        const item = dailies[dKey];
        if (
          item.content.toLowerCase().includes(q) ||
          dKey.includes(q) ||
          (item.meta.tags && item.meta.tags.toLowerCase().includes(q))
        ) {
          matchedDailies.push({ date: dKey, ...item });
        }
      });

      return { query, matchedPerms, matchedDailies };
    }

    const shuffledPerms = [...perms].sort(() => 0.5 - Math.random()).slice(0, 5);

    const scoredDailies = Object.keys(dailies)
      .map((dKey) => {
        const d = dailies[dKey];
        const score = this.calculateDecayScore(
          d.meta.importance,
          d.meta.hits,
          d.meta.created,
        );
        return { date: dKey, score, ...d };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      pinned: shuffledPerms,
      recommendedDailies: scoredDailies,
    };
  },

  // 工具 4：dream
  dream(charName, limit = 3) {
    const dailies = this.getDailies(charName);
    const sortedDates = Object.keys(dailies).sort().reverse().slice(0, limit);
    return sortedDates.map((dKey) => ({
      date: dKey,
      ...dailies[dKey],
    }));
  },

  // 工具 5：comment
  comment(charName, dateStr, commentText) {
    if (!commentText || !commentText.trim()) return false;
    const dailies = this.getDailies(charName);
    if (!dailies[dateStr]) return false;

    if (!dailies[dateStr].comments) dailies[dateStr].comments = [];
    if (dailies[dateStr].comments.length >= 10) {
      return { success: false, msg: "批注已达 10 条上限，该写新日记啦" };
    }

    const timeStr = new Date().toISOString().slice(0, 16).replace("T", " ");
    dailies[dateStr].comments.push({
      time: timeStr,
      text: commentText.trim(),
    });

    this.saveDailies(charName, dailies);
    return { success: true, date: dateStr };
  },

  // 工具 6：archive
  archive(charName, idOrDate, restore = false) {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);
    let archives = this.getArchives(charName);

    if (!restore) {
      if (dailies[idOrDate]) {
        archives.unshift({ id: idOrDate, originType: "daily", data: dailies[idOrDate] });
        delete dailies[idOrDate];
        this.saveDailies(charName, dailies);
        this.saveArchives(charName, archives);
        return { success: true, action: "archived" };
      }
      const permIdx = perms.findIndex((p) => p.id === idOrDate);
      if (permIdx >= 0) {
        archives.unshift({ id: idOrDate, originType: "permanent", data: perms[permIdx] });
        perms.splice(permIdx, 1);
        this.savePermanents(charName, perms);
        this.saveArchives(charName, archives);
        return { success: true, action: "archived" };
      }
    } else {
      const arcIdx = archives.findIndex((a => a.id === idOrDate));
      if (arcIdx >= 0) {
        const item = archives[arcIdx];
        if (item.originType === "daily") {
          dailies[item.id] = item.data;
          this.saveDailies(charName, dailies);
        } else {
          perms.unshift(item.data);
          this.savePermanents(charName, perms);
        }
        archives.splice(arcIdx, 1);
        this.saveArchives(charName, archives);
        return { success: true, action: "restored" };
      }
    }
    return { success: false };
  },

  // 工具 7：trace
  trace(charName, idOrDate, newContent = "", isDelete = false) {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);

    if (dailies[idOrDate]) {
      if (isDelete) {
        delete dailies[idOrDate];
      } else {
        dailies[idOrDate].content = newContent.trim();
      }
      this.saveDailies(charName, dailies);
      return { success: true };
    }

    const permIdx = perms.findIndex((p) => p.id === idOrDate);
    if (permIdx >= 0) {
      if (isDelete) {
        perms.splice(permIdx, 1);
      } else {
        perms[permIdx].content = newContent.trim();
      }
      this.savePermanents(charName, perms);
      return { success: true };
    }

    return { success: false };
  },

  // 工具 8：remind
  remind(charName) {
    const dailies = this.getDailies(charName);
    const keys = Object.keys(dailies);
    if (keys.length === 0) return null;

    const list = keys
      .map((k) => {
        const d = dailies[k];
        const score = this.calculateDecayScore(
          d.meta.importance,
          d.meta.hits,
          d.meta.created,
        );
        return { date: k, score, ...d };
      })
      .sort((a, b) => a.score - b.score);

    const pool = list.slice(0, 3);
    const picked = pool[Math.floor(Math.random() * pool.length)];

    if (picked) {
      dailies[picked.date].meta.hits = (dailies[picked.date].meta.hits || 0) + 1;
      this.saveDailies(charName, dailies);
    }

    return picked;
  },

  // 格式化输出给 System Prompt
  getFormattedPromptContext(charName) {
    const dreamLogs = this.dream(charName, 3);
    const recallData = this.recall(charName, "", "");

    let text = "";

    if (recallData.pinned && recallData.pinned.length > 0) {
      text += `\n【EchoVault 永久钉选记忆】:\n`;
      recallData.pinned.forEach((p) => {
        text += `▪ [${p.title}]: ${p.content}\n`;
      });
    }

    if (dreamLogs && dreamLogs.length > 0) {
      text += `\n【EchoVault 最近连续日记】:\n`;
      dreamLogs.forEach((d) => {
        text += `[日期: ${d.date}] (${d.meta.tags || "日常"})\n${d.content}\n`;
        if (d.comments && d.comments.length > 0) {
          text += `  批注:\n${d.comments.map((c) => `  - [${c.time}] ${c.text}`).join("\n")}\n`;
        }
        text += `\n`;
      });
    }

    return text.trim();
  },
};

// 初始化时自动探测一次本地 Python MCP 服务
EchoVault.pingPythonServer();
