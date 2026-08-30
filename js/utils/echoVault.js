/**
 * EchoVault 原生记忆引擎与 MCP 桥接器
 * 核心哲学：存原文，读原文。不 JSON 化、不做生硬摘要。
 * 结构：daily (日记衰减) / permanent (永久钉选) / archive (归档)
 * 工具：check / write / recall / dream / comment / archive / trace / remind
 */

export const EchoVault = {
  config: {
    mcpServerUrl: "http://127.0.0.1:8765",
    useRemoteMcpIfAvailable: true,
    isMcpConnected: false,
  },

  // ════════════ 1. 本地存储命名空间 ════════════
  getStorageKeys(charName = "default") {
    const safe = encodeURIComponent(charName || "default");
    return {
      daily: `echo_daily_${safe}`, // 存放日记 Map { "2026-08-31": { meta, content, comments } }
      permanent: `echo_perm_${safe}`, // 存放钉选 Array [ { title, meta, content } ]
      archive: `echo_archive_${safe}`, // 存放归档 Array [ { id, originType, data } ]
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

  // ════════════ 3. EchoVault 8 大原生工具 ════════════

  // 工具 1：check —— 查看系统状态与问候语
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
      displayText: `日记: ${dailyCount}篇 | 钉选: ${permCount}条 | ${greeting}`,
    };
  },

  // 工具 2：write —— 存记忆（日记按天追加，钉选永久保留）
  write(
    charName,
    content,
    type = "daily",
    importance = 5,
    tags = "",
    title = "",
  ) {
    if (!content || !content.trim()) return false;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(0, 19).replace("T", " ");

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
        // 同一天追加内容，用 --- 分隔
        dailies[dateStr].content += `\n\n---\n\n${content.trim()}`;
        if (importance > dailies[dateStr].meta.importance) {
          dailies[dateStr].meta.importance = importance;
        }
      }
      this.saveDailies(charName, dailies);
      return { success: true, date: dateStr, type: "daily" };
    } else {
      // permanent 钉选
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

  // 工具 3：recall —— 三种检索（空查 5+3 比例 / 按ID查 / 关键词查）
  recall(charName, query = "", id = "") {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);

    // 1. 按 ID 查
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

    // 2. 关键词搜索
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

      return {
        query,
        matchedPerms,
        matchedDailies,
      };
    }

    // 3. 空查：5 条随机钉选 + 3 条带衰减推荐日记（5+3 经典比例）
    const shuffledPerms = [...perms]
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

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

  // 工具 4：dream —— 换窗连续性必备（回看最近 3 天日记完整原文）
  dream(charName, limit = 3) {
    const dailies = this.getDailies(charName);
    const sortedDates = Object.keys(dailies).sort().reverse().slice(0, limit);
    return sortedDates.map((dKey) => ({
      date: dKey,
      ...dailies[dKey],
    }));
  },

  // 工具 5：comment —— 对过去的日记写批注（上限 10 条）
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

  // 工具 6：archive —— 归档与恢复（可逆）
  archive(charName, idOrDate, restore = false) {
    const dailies = this.getDailies(charName);
    const perms = this.getPermanents(charName);
    let archives = this.getArchives(charName);

    if (!restore) {
      // 归档
      if (dailies[idOrDate]) {
        archives.unshift({
          id: idOrDate,
          originType: "daily",
          data: dailies[idOrDate],
        });
        delete dailies[idOrDate];
        this.saveDailies(charName, dailies);
        this.saveArchives(charName, archives);
        return { success: true, action: "archived" };
      }
      const permIdx = perms.findIndex((p) => p.id === idOrDate);
      if (permIdx >= 0) {
        archives.unshift({
          id: idOrDate,
          originType: "permanent",
          data: perms[permIdx],
        });
        perms.splice(permIdx, 1);
        this.savePermanents(charName, perms);
        this.saveArchives(charName, archives);
        return { success: true, action: "archived" };
      }
    } else {
      // 恢复
      const arcIdx = archives.findIndex((a) => a.id === idOrDate);
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

  // 工具 7：trace —— 修改或直接删除
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

  // 工具 8：remind —— 漂流瓶（加权捞取最快沉底的旧日记）
  remind(charName) {
    const dailies = this.getDailies(charName);
    const keys = Object.keys(dailies);
    if (keys.length === 0) return null;

    // 按照分数升序（沉得越深的越优先被捡起）
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

    // 选取前三篇沉底日记中随机捞取一本
    const pool = list.slice(0, 3);
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // 捞起后增加一次 hit 续命
    if (picked) {
      dailies[picked.date].meta.hits =
        (dailies[picked.date].meta.hits || 0) + 1;
      this.saveDailies(charName, dailies);
    }

    return picked;
  },

  // ════════════ 4. 生成供 Prompt 注入的纯原文块 ════════════
  getFormattedPromptContext(charName) {
    const dreamLogs = this.dream(charName, 3);
    const recallData = this.recall(charName, "", ""); // 获取钉选

    let text = "";

    // 1. 钉选核心记忆（永不磨灭）
    if (recallData.pinned && recallData.pinned.length > 0) {
      text += `\n【EchoVault 永久钉选记忆（花园里的石头·永不磨灭）】:\n`;
      recallData.pinned.forEach((p) => {
        text += `▪ [${p.title}]: ${p.content}\n`;
      });
    }

    // 2. 最近 3 天日记原文（换窗连续性）
    if (dreamLogs && dreamLogs.length > 0) {
      text += `\n【EchoVault 最近连续日记（近三天真实原文）】:\n`;
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
