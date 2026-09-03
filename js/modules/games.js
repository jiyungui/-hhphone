// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · SPICY MONOPOLY (多气泡连发 · 沉浸分段互动版)
// 多气泡分段流 · 深度读取 Char 人设 · 真实时间线接梗 · 严禁 Emoji
// ═══════════════════════════════════════════════════════════════

import { resolveApiEndpoints } from './apiSettings.js';

const STORAGE_MONOPOLY_KEY = 'mini_spicy_monopoly_v5_state';
const MCP_SERVER_URL = 'http://127.0.0.1:8765';

export const REGISTERED_GAMES = [
  {
    id: 'game-spicy-monopoly',
    name: '辛辣大富翁 (SPICY MONOPOLY)',
    tag: '18+ · ROLEPLAY',
    desc: '20格顺时针棋盘 · 多气泡分段对白 · 任务锁与深度互动剧情',
    status: 'READY'
  },
  {
    id: 'game-truth-or-dare',
    name: '真心话大冒险 (TRUTH OR DARE)',
    tag: 'INTERACTION',
    desc: '双人抽取辛辣指令 · 角色根据性格即时响应',
    status: 'IN DEV'
  },
  {
    id: 'game-tarot',
    name: '塔罗秘境对决 (TAROT DESTINY)',
    tag: 'MYSTIC',
    desc: '抽取大阿卡那牌阵 · 解读彼此羁绊与未来推演',
    status: 'IN DEV'
  }
];

// 20 格标准环形地块定义 (0 ~ 19)
export const BOARD_TILES_20 = [
  { id: 0, name: '起点', type: 'start', tag: 'START' },
  { id: 1, name: '任务', type: 'task', tag: 'TASK' },
  { id: 2, name: '机会', type: 'chance', tag: 'CHANCE' },
  { id: 3, name: '任务', type: 'task', tag: 'TASK' },
  { id: 4, name: '商店', type: 'shop', tag: 'SHOP' },
  { id: 5, name: '任务', type: 'task', tag: 'TASK' },
  { id: 6, name: '未知', type: 'unknown', tag: 'UNKNOWN' },
  { id: 7, name: '任务', type: 'task', tag: 'TASK' },
  { id: 8, name: '真心话', type: 'truth', tag: 'TRUTH' },
  { id: 9, name: '任务', type: 'task', tag: 'TASK' },
  { id: 10, name: '监狱', type: 'jail', tag: 'JAIL' },
  { id: 11, name: '任务', type: 'task', tag: 'TASK' },
  { id: 12, name: '任务', type: 'task', tag: 'TASK' },
  { id: 13, name: '机会', type: 'chance', tag: 'CHANCE' },
  { id: 14, name: '真心话', type: 'truth', tag: 'TRUTH' },
  { id: 15, name: '任务', type: 'task', tag: 'TASK' },
  { id: 16, name: '未知', type: 'unknown', tag: 'UNKNOWN' },
  { id: 17, name: '任务', type: 'task', tag: 'TASK' },
  { id: 18, name: '机会', type: 'chance', tag: 'CHANCE' },
  { id: 19, name: '任务', type: 'task', tag: 'TASK' }
];

const DEFAULT_SPICY_TASKS = [
  {
    title: "雕像挑战",
    tags: ["触碰", "耐力"],
    desc: "选择一个姿势静止保持3分钟，对方在此期间可以进行任意言语调侃和轻微身体接触。",
    keywords: ["姿势", "不动", "静止", "摸", "碰", "好", "可以", "开始", "来吧", "行", "来"]
  },
  {
    title: "言语规训",
    tags: ["语言", "支配"],
    desc: "用极其顺从且带有一丝羞耻的语气，向对方称呼其特定尊称并复述三句话。",
    keywords: ["老公", "主人", "大人", "哥哥", "姐姐", "只看你", "听话", "服从", "以后", "遵命"]
  },
  {
    title: "视线对峙",
    tags: ["眼神", "心跳"],
    desc: "与对方进行60秒无间断近距离对视，率先移开视线或眨眼者接受额外指令。",
    keywords: ["看着你", "对视", "眼睛", "心跳", "脸红", "眨眼", "不躲", "视线", "看"]
  },
  {
    title: "触碰试探",
    tags: ["触碰", "指令"],
    desc: "闭上双眼，由对方引导你的手触碰其指定部位并描述此刻感受。",
    keywords: ["闭眼", "手", "触碰", "摸到", "温度", "心跳", "感受", "软", "热", "摸"]
  },
  {
    title: "秘密告解",
    tags: ["真心话", "隐秘"],
    desc: "交代你最近一次对对方产生心动或占有欲的真实瞬间。",
    keywords: ["心动", "想你", "喜欢", "瞬间", "吃醋", "占有", "那天", "心跳", "爱你"]
  },
  {
    title: "绝对服从",
    tags: ["支配", "行动"],
    desc: "在接下来的两个回合内，无条件答应对方提出的任意一个要求。",
    keywords: ["答应", "服从", "听你的", "随你", "任凭", "顺从", "可以", "好"]
  }
];

let activeGameId = null;
let gameState = null;
let isMcpOnline = false;
let isCharThinking = false;

async function pingSpicyMonopolyMcp() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${MCP_SERVER_URL}/tools`, { signal: controller.signal });
    clearTimeout(timeoutId);
    isMcpOnline = res.ok;
  } catch (e) {
    isMcpOnline = false;
  }
  return isMcpOnline;
}

async function callMonopolyMcpTool(toolName, args = {}) {
  if (!isMcpOnline) return { success: false };
  try {
    const res = await fetch(`${MCP_SERVER_URL}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: toolName, arguments: args })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, result: data.result || data };
    }
  } catch (e) {
    isMcpOnline = false;
  }
  return { success: false };
}

function getStoredGameState() {
  const saved = localStorage.getItem(STORAGE_MONOPOLY_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved); } catch (e) { return null; }
}

function saveGameState(state) {
  gameState = state;
  localStorage.setItem(STORAGE_MONOPOLY_KEY, JSON.stringify(state));
}

function getActiveApiConfig() {
  const apiSettings = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');
  const baseUrl = apiSettings.baseUrl || 'https://api.deepseek.com/v1';
  const apiKey = apiSettings.apiKey || '';
  const model = apiSettings.model || 'deepseek-chat';
  const { chatUrl } = resolveApiEndpoints(baseUrl);
  return { baseUrl, apiKey, model, chatUrl: chatUrl || `${baseUrl.replace(/\/+$/, '')}/chat/completions` };
}

function getFullCharDetails(charId) {
  const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  return charVault.find(c => c.id === charId) || {};
}

function getFullUserDetails(userId) {
  const userVault = JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');
  if (userId) {
    const matched = userVault.find(u => u.id === userId);
    if (matched) return matched;
  }
  const activeName = localStorage.getItem('mini_current_active_user');
  return userVault.find(u => u.name === activeName) || userVault[0] || { id: 'default-user', name: '玩家', gender: '女', occupation: '探险者' };
}

function createNewSpicyGame(char, user, lineupType = 'BG') {
  const fullChar = getFullCharDetails(char.id);
  const fullUser = user || getFullUserDetails();

  const newState = {
    gameId: `cd${Math.floor(100000 + Math.random() * 900000)}`,
    round: 1,
    maxRounds: 12,
    intensity: 'medium',
    safetyWord: '404',
    lineupType: lineupType,
    charInfo: {
      id: fullChar.id || char.id,
      name: fullChar.name || char.name,
      avatarUrl: fullChar.avatarUrl || '',
      gender: fullChar.gender || '男',
      identity: fullChar.occupation || '神秘角色',
      catchphrase: fullChar.catchphrase || '',
      likesAndDislikes: fullChar.likesAndDislikes || '',
      dressStyle: fullChar.dressStyle || '',
      appearance: fullChar.appearance || '',
      detailedInfo: fullChar.detailedInfo || ''
    },
    userInfo: {
      id: fullUser.id || 'u-user',
      name: fullUser.name || '玩家',
      avatarUrl: fullUser.avatarUrl || '',
      gender: fullUser.gender || '女',
      identity: fullUser.occupation || '探险者',
      detailedInfo: fullUser.detailedInfo || ''
    },
    charCoins: 5,
    userCoins: 5,
    charPos: 0,
    userPos: 0,
    currentTurn: 'user',
    lastDice: 3,
    currentTask: DEFAULT_SPICY_TASKS[0],
    isTaskLocked: true,
    taskLockHolder: 'user',
    roleplayLogs: []
  };

  saveGameState(newState);
  callMonopolyMcpTool('init_spicy_game', {
    char_name: newState.charInfo.name,
    user_name: newState.userInfo.name,
    lineup: lineupType
  });

  generateSpicyRoleplay(newState.currentTask, '', true);
  return newState;
}

// 关键词与意图判定
function checkTaskCompletionKeywords(task, userInput) {
  if (!userInput || !userInput.trim()) return false;
  const text = userInput.trim().toLowerCase();
  if (text.length >= 6) return true;
  const keys = task.keywords || ["好", "可以", "答应", "来", "做", "听话", "按你说的"];
  return keys.some(k => text.includes(k.toLowerCase()));
}

// ════════════════════ 核心：分段多气泡连发生成引擎 ════════════════════
async function generateSpicyRoleplay(task, customUserInput = '', isOpening = false) {
  const s = gameState;
  if (!s || !s.charInfo) return;

  const apiCfg = getActiveApiConfig();
  const c = s.charInfo;
  const u = s.userInfo;

  // 提取最近 6 条历史记录
  const recentHistory = s.roleplayLogs.slice(-6).map(l => ({
    role: l.sender === 'char' ? 'assistant' : 'user',
    content: l.content
  }));

  const systemPrompt = `你正在与玩家【${u.name}】进行双人辛辣大富翁剧情互动。
【你的角色设定】:
- 名字: ${c.name} (${c.gender})
- 身份/职业: ${c.identity}
- 口癖/口头禅: ${c.catchphrase || '无'}
- 性格与详细背景: ${c.detailedInfo || '傲娇敏锐'}
【对方玩家】: ${u.name} (${u.gender})

【当前棋盘局势】:
- 回合: ${s.round}/${s.maxRounds}
- 当前任务: 【${task.title}】(${task.desc})

【核心互动与分段输出规则 (极其重要)】:
1. 必须完全代入你的人设语气，紧密针对玩家上一句话进行接梗、反驳或微动作调戏。
2. 严禁整大段文字混在一起！必须将你的回复通过【换行】拆分成 2~3 个短气泡分段输出：
   - 第一段：针对玩家刚刚动作的即时微反应或轻笑/挑眉；
   - 第二段：细腻生动的肢体互动或靠近神态细节；
   - 第三段：紧扣任务与性格的对白台词。
3. 保证整体丰满生动（总字数约 80~150 字），但每小段保持 25~50 字独立成句。
4. 绝对严禁输出任何 Emoji！纯文本输出。`;

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...recentHistory
  ];

  if (isOpening) {
    messagesPayload.push({ role: 'user', content: '游戏刚开局，请作为对手做出你的开场分段神态与对白：' });
  } else if (!customUserInput) {
    messagesPayload.push({ role: 'user', content: `当前停靠在【${task.title}】，请分段给出你的神态动作与要求：` });
  }

  if (!apiCfg.apiKey) {
    s.roleplayLogs.push({
      sender: 'char',
      name: c.name,
      content: `“（注视着你）既然抽中了【${task.title}】，那就按规则来吧，我可不会退缩。”`
    });
    saveGameState(s);
    return;
  }

  try {
    const res = await fetch(apiCfg.chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiCfg.apiKey}`
      },
      body: JSON.stringify({
        model: apiCfg.model,
        messages: messagesPayload,
        temperature: 0.85,
        max_tokens: 380
      })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        // ✨ 将 AI 回复按换行智能拆分为多个独立小气泡连续呈现
        const paragraphs = reply.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
        
        paragraphs.forEach(para => {
          s.roleplayLogs.push({
            sender: 'char',
            name: c.name,
            content: para
          });
        });
        saveGameState(s);
        return;
      }
    } else {
      console.error('[Spicy RP API Response Error]', res.status);
    }
  } catch (e) {
    console.error('[Spicy RP Fetch Error]', e);
  }

  s.roleplayLogs.push({
    sender: 'char',
    name: c.name,
    content: `“（挑眉看着你）怎么，这就说不出话了？既然轮到【${task.title}】，那就照做吧。”`
  });
  saveGameState(s);
}

// ════════════════════ 视图总调度 ════════════════════
export async function renderGamesCenterView(container) {
  await pingSpicyMonopolyMcp();
  gameState = getStoredGameState();

  if (activeGameId === 'game-spicy-monopoly') {
    if (!gameState) renderGameSetupView(container);
    else renderSpicyGameBoardView(container);
  } else {
    renderGameHallView(container);
  }
}

// 1. 游戏大厅 (GAMES HUB)
function renderGameHallView(container) {
  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 14px 14px 14px; overflow-y:auto; background:var(--chat-ui-bg, #FFF);">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--chat-ui-border, #111);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="user-header-title" style="font-size:15px; font-weight:900; color:var(--chat-ui-text-main, #111);">GAMES HUB</span>
          <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid var(--chat-ui-border, #111); padding:1px 4px; border-radius:3px;">ARCADE</span>
        </div>
        <span class="user-count-badge" style="font-size:8.5px; font-weight:800;">${REGISTERED_GAMES.length} 款互动游戏</span>
      </div>

      <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:9.5px; font-weight:800; color:var(--chat-ui-text-sub, #666); letter-spacing:0.5px;">双人互动小游戏列表</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${REGISTERED_GAMES.map(g => {
            const isPlayable = g.status === 'READY';
            return `
              <div class="ins-game-select-card" data-game-id="${g.id}" style="
                background: var(--chat-ui-card-bg, #FAFAFA);
                border: 1.2px solid var(--chat-ui-border, #111);
                border-radius: 10px;
                padding: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: ${isPlayable ? 'pointer' : 'default'};
                box-shadow: 0 1px 4px rgba(0,0,0,0.03);
              ">
                <div style="display:flex; flex-direction:column; gap:3px; flex:1;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:11.5px; font-weight:900; color:var(--chat-ui-text-main, #111);">${g.name}</span>
                    <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid #111; padding:1px 4px; border-radius:3px;">${g.tag}</span>
                  </div>
                  <span style="font-size:8.5px; color:var(--chat-ui-text-sub, #777); line-height:1.35;">${g.desc}</span>
                </div>
                <div style="margin-left:8px; flex-shrink:0;">
                  <button class="ins-card-action-btn ${isPlayable ? 'use' : ''}" style="
                    padding:4px 10px; font-size:9px; font-weight:800;
                    ${!isPlayable ? 'background:#EEE; border-color:#CCC; color:#999; pointer-events:none;' : ''}
                  ">
                    ${isPlayable ? '进入游戏 ›' : '开发中'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.ins-game-select-card[data-game-id="game-spicy-monopoly"]').forEach(card => {
    card.onclick = () => {
      activeGameId = 'game-spicy-monopoly';
      renderGamesCenterView(container);
    };
  });
}

// 2. 角色与 User 身份双选开局视图
function renderGameSetupView(container) {
  const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
  const userVault = JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');

  let selectedLineup = 'BG';
  let selectedUserId = userVault[0]?.id || null;

  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 14px 14px 14px; overflow-y:auto; background:var(--chat-ui-bg, #FFF);">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--chat-ui-border, #111);">
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="ins-card-action-btn" id="btn-back-to-hall" style="padding:2px 6px; font-size:8px; background:#FFF; border:1px solid #111; color:#111;">‹ 退出大富翁</button>
          <span style="font-size:13px; font-weight:900; color:var(--chat-ui-text-main, #111);">SPICY MONOPOLY</span>
        </div>
        <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid #111; padding:1px 4px; border-radius:3px;">${isMcpOnline ? 'MCP 8765' : 'LOCAL'}</span>
      </div>

      <!-- 配对模式选择 -->
      <div style="margin-top:10px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
        <span style="font-size:9px; font-weight:800; color:#111;">1. 选择配对模式 (LINEUP)</span>
        <div style="display:flex; gap:6px;">
          <button class="ins-segment-pill-btn active" id="btn-lineup-bg">BG (男女)</button>
          <button class="ins-segment-pill-btn" id="btn-lineup-bl">BL (双男)</button>
          <button class="ins-segment-pill-btn" id="btn-lineup-gl">GL (双女)</button>
        </div>
      </div>

      <!-- 选择 User 身份画像 -->
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:9.5px; font-weight:800; color:var(--chat-ui-text-sub, #666);">2. 选择你的 User 身份画像 (开局后锁定)</span>
          <span style="font-size:8px; color:#888;">${userVault.length} 个身份</span>
        </div>
        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;" id="user-persona-pick-row">
          ${userVault.length === 0 ? `
            <div style="padding:10px; font-size:8.5px; color:#888; background:#FAFAFA; border:1px dashed #CCC; border-radius:6px; width:100%;">未录入 User 身份，将使用默认玩家画像</div>
          ` : userVault.map((u, i) => `
            <div class="user-pick-chip ${i === 0 ? 'selected' : ''}" data-user-id="${u.id}" style="
              flex-shrink: 0;
              width: 110px;
              padding: 6px;
              background: #FFF;
              border: 1.2px solid ${i === 0 ? '#111' : '#DDD'};
              border-radius: 8px;
              display: flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
            ">
              <div style="width:26px; height:26px; border-radius:50%; background:#111; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
                ${u.avatarUrl ? `<img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:7px; color:#FFF; font-weight:800;">${u.name.slice(0,2)}</span>`}
              </div>
              <div style="display:flex; flex-direction:column; min-width:0;">
                <span style="font-size:9px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</span>
                <span style="font-size:7.5px; color:#888;">${u.occupation || u.gender}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 选择对手 Char 角色 -->
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
        <span style="font-size:9.5px; font-weight:800; color:var(--chat-ui-text-sub, #666);">3. 选择对战对手 Char</span>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${charVault.length === 0 ? `
            <div style="padding:25px 0; text-align:center; font-size:9.5px; color:#888;">角色库暂无角色，请先前往角色库录入角色档案</div>
          ` : charVault.map(c => `
            <div class="char-card-item btn-select-game-char" data-id="${c.id}" style="padding:8px 10px; display:flex; align-items:center; justify-content:space-between; background:var(--chat-ui-card-bg, #FFF); border:1.2px solid var(--chat-ui-border, #111); border-radius:8px; cursor:pointer;">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:34px; height:34px; border-radius:6px; border:1px solid #111; overflow:hidden; background:#111; display:flex; align-items:center; justify-content:center;">
                  ${c.avatarUrl ? `<img src="${c.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:8px; color:#FFF; font-weight:800;">${c.name.slice(0,2)}</span>`}
                </div>
                <div style="display:flex; flex-direction:column;">
                  <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-size:11.5px; font-weight:800; color:var(--chat-ui-text-main, #111);">${c.name}</span>
                    <span style="font-size:7.5px; color:#666;">(${c.gender || '保密'})</span>
                  </div>
                  <span style="font-size:8px; color:var(--chat-ui-text-sub, #888);">${c.occupation || '档案就绪'}</span>
                </div>
              </div>
              <button class="ins-card-action-btn use" style="padding:4px 10px; font-size:9px; font-weight:800;">锁定开局 ›</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const bgBtn = container.querySelector('#btn-lineup-bg');
  const blBtn = container.querySelector('#btn-lineup-bl');
  const glBtn = container.querySelector('#btn-lineup-gl');
  const updateLineupBtns = (t) => {
    selectedLineup = t;
    bgBtn.className = `ins-segment-pill-btn ${t === 'BG' ? 'active' : ''}`;
    blBtn.className = `ins-segment-pill-btn ${t === 'BL' ? 'active' : ''}`;
    glBtn.className = `ins-segment-pill-btn ${t === 'GL' ? 'active' : ''}`;
  };
  bgBtn.onclick = () => updateLineupBtns('BG');
  blBtn.onclick = () => updateLineupBtns('BL');
  glBtn.onclick = () => updateLineupBtns('GL');

  container.querySelectorAll('.user-pick-chip').forEach(chip => {
    chip.onclick = () => {
      selectedUserId = chip.getAttribute('data-user-id');
      container.querySelectorAll('.user-pick-chip').forEach(c => {
        c.style.borderColor = '#DDD';
      });
      chip.style.borderColor = '#111';
    };
  });

  container.querySelector('#btn-back-to-hall').onclick = () => {
    activeGameId = null;
    renderGamesCenterView(container);
  };

  container.querySelectorAll('.btn-select-game-char').forEach(el => {
    el.onclick = () => {
      const charId = el.getAttribute('data-id');
      const targetChar = charVault.find(c => c.id === charId);
      const chosenUser = getFullUserDetails(selectedUserId);

      if (targetChar) {
        createNewSpicyGame(targetChar, chosenUser, selectedLineup);
        renderSpicyGameBoardView(container);
      }
    };
  });
}

// 3. 20 格棋盘与分段对白流主视图
function renderSpicyGameBoardView(container) {
  const s = gameState;
  const isUserTurn = s.currentTurn === 'user';
  const task = s.currentTask || DEFAULT_SPICY_TASKS[0];
  const isLocked = s.isTaskLocked;

  const get20GridPos = (idx) => {
    if (idx >= 0 && idx <= 5) return { row: 1, col: idx + 1 };
    if (idx >= 6 && idx <= 9) return { row: idx - 4, col: 6 };
    if (idx >= 10 && idx <= 15) return { row: 6, col: 6 - (idx - 10) };
    if (idx >= 16 && idx <= 19) return { row: 6 - (idx - 15), col: 1 };
    return { row: 1, col: 1 };
  };

  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 8px 12px 8px; overflow-y:auto; background:var(--chat-ui-bg, #FFF); gap:8px;">
      <!-- 顶栏状态 -->
      <div style="background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="ins-card-action-btn" id="btn-spicy-exit-hall" style="padding:1px 5px; font-size:7.5px; background:#FFF; border:1px solid #111; color:#111;">‹ 大厅</button>
          <span style="font-size:8.5px; font-weight:800; background:#EAEAEA; padding:2px 6px; border-radius:4px;">回合 ${s.round}/${s.maxRounds}</span>
          <span style="font-size:8.5px; font-weight:800; background:#EAEAEA; padding:2px 6px; border-radius:4px;">${s.lineupType} · ${s.intensity}</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <button class="ins-card-action-btn" id="btn-trigger-safety-word" style="padding:2px 6px; font-size:8px; font-weight:800; background:#111; color:#FFF;">
            安全词: ${s.safetyWord}
          </button>
        </div>
      </div>

      <!-- 20 格棋盘 -->
      <div style="
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        grid-template-rows: repeat(6, 1fr);
        gap: 3px;
        width: 100%;
        aspect-ratio: 1;
        background: #FFFFFF;
        border: 1.5px solid #111111;
        border-radius: 12px;
        padding: 4px;
        box-sizing: border-box;
        position: relative;
      ">
        ${BOARD_TILES_20.map(tile => {
          const pos = get20GridPos(tile.id);
          const hasUser = s.userPos === tile.id;
          const hasChar = s.charPos === tile.id;
          const isJail = tile.type === 'jail';
          const isStart = tile.type === 'start';

          return `
            <div style="
              grid-row: ${pos.row};
              grid-column: ${pos.col};
              background: ${isStart || isJail ? '#F0F0F0' : '#FFFFFF'};
              border: 1px solid #111111;
              border-radius: 4px;
              padding: 2px 1px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              position: relative;
              font-size: 7px;
              overflow: hidden;
            ">
              <span style="font-weight:900; color:#111; font-size:6.5px; line-height:1;">${tile.id}</span>
              <span style="font-weight:800; color:#111; font-size:7px; text-align:center; transform:scale(0.95);">${tile.name}</span>
              <div style="display:flex; gap:2px; margin-top:1px;">
                ${hasUser ? `<span style="width:6px; height:6px; border-radius:50%; background:#111; border:1px solid #FFF;" title="${s.userInfo.name}"></span>` : ''}
                ${hasChar ? `<span style="width:6px; height:6px; border-radius:50%; background:#8E7CE8; border:1px solid #FFF;" title="${s.charInfo.name}"></span>` : ''}
              </div>
            </div>
          `;
        }).join('')}

        <!-- 骰子中心控制台 (点击即可掷骰) -->
        <div id="btn-dice-center-box" style="
          grid-row: 2 / span 4;
          grid-column: 2 / span 4;
          background: #FAFAFA;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px;
          gap: 4px;
          cursor: ${isLocked ? 'not-allowed' : 'pointer'};
          opacity: ${isLocked ? '0.7' : '1'};
        ">
          <span style="font-size:7.5px; font-weight:800; color:#888; letter-spacing:0.5px;">DICE STATION</span>
          <div style="
            width: 32px;
            height: 32px;
            background: #111111;
            color: #FFFFFF;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 900;
          " id="dice-center-digit">
            ${s.lastDice}
          </div>
          <span style="font-size:7.5px; font-weight:800; color:#111; text-align:center;">
            ${isCharThinking ? '对方思考推演中...' : (isLocked ? '[ 任务锁定中 - 请在下方回复完成 ]' : (isUserTurn ? '轮到你掷骰 (点击行动)' : `轮到 ${s.charInfo.name} 掷骰`))}
          </span>
        </div>
      </div>

      <!-- 双方角色卡片 -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
        <div style="background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:8px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:24px; height:24px; border-radius:50%; background:#111; overflow:hidden; border:1px solid #111; display:flex; align-items:center; justify-content:center;">
              ${s.charInfo.avatarUrl ? `<img src="${s.charInfo.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:7px; color:#FFF; font-weight:800;">${s.charInfo.name.slice(0,2)}</span>`}
            </div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:9.5px; font-weight:900; color:#111;">${s.charInfo.name}</span>
              <span style="font-size:7px; font-weight:700; color:#666;">${s.charInfo.identity || s.charInfo.gender}</span>
            </div>
          </div>
          <div style="font-size:9px; font-weight:800; color:#111;">金币 ${s.charCoins}</div>
        </div>

        <div style="background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:8px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:24px; height:24px; border-radius:50%; background:#111; overflow:hidden; border:1px solid #111; display:flex; align-items:center; justify-content:center;">
              ${s.userInfo.avatarUrl ? `<img src="${s.userInfo.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:7px; color:#FFF; font-weight:800;">YOU</span>`}
            </div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:9.5px; font-weight:900; color:#111;">${s.userInfo.name}</span>
              <span style="font-size:7px; font-weight:700; color:#666;">${s.userInfo.identity || s.userInfo.gender}</span>
            </div>
          </div>
          <div style="font-size:9px; font-weight:800; color:#111;">金币 ${s.userCoins}</div>
        </div>
      </div>

      <!-- 辛辣任务卡片 (纯黑白标，绝无 Emoji) -->
      <div style="background:#FFFFFF; border:1.2px solid #111; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:4px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; font-weight:900; color:#111;">${task.title}</span>
            <span style="font-size:7.5px; font-weight:800; background:${isLocked ? '#111' : '#EAEAEA'}; color:${isLocked ? '#FFF' : '#111'}; border:1px solid #111; padding:1px 5px; border-radius:3px;">
              ${isLocked ? '[ 任务进行中 · 锁定 ]' : '[ 任务已完成 · 已验收 ]'}
            </span>
          </div>
          <div style="display:flex; gap:3px;">
            ${(task.tags || []).map(t => `<span style="font-size:7.5px; font-weight:800; background:#FAFAFA; color:#111; border:1px solid #111; padding:1px 5px; border-radius:3px;">${t}</span>`).join('')}
          </div>
        </div>
        <div style="font-size:8.5px; color:#444; line-height:1.4;">${task.desc}</div>
      </div>

      <!-- ✨ 剧情演绎与多气泡分段流 (微信式多气泡排版) -->
      <div style="background:#FAFAFA; border:1.2px solid var(--chat-ui-border, #111); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #CCC; padding-bottom:4px;">
          <span style="font-size:9.5px; font-weight:900; color:#111;">剧情演绎与互动 (ROLEPLAY & STORY)</span>
          <span style="font-size:7.5px; color:#888;">在下方输入文字完成任务</span>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;" id="spicy-rp-dialog-stream">
          ${s.roleplayLogs.length === 0 ? `<div style="font-size:8.5px; color:#888; text-align:center; padding:10px 0;">掷骰后将根据角色人设实时演化对局剧情...</div>` : s.roleplayLogs.map(log => `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:8.5px; font-weight:800; color:#111;">${log.name}:</span>
              <div style="font-size:9px; color:#222; line-height:1.45; padding:6px 8px; background:#FFF; border:1px solid #EAEAEA; border-radius:6px; font-style:italic;">
                ${escapeHtml(log.content)}
              </div>
            </div>
          `).join('')}

          <!-- 思考中点阵指示器 (绝无 Emoji) -->
          ${isCharThinking ? `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:8.5px; font-weight:800; color:#111;">${s.charInfo.name}:</span>
              <div style="font-size:8.5px; color:#666; padding:6px 8px; background:#FFF; border:1px dashed #999; border-radius:6px; font-family:ui-monospace, monospace;">
                ● ● ● [ 对方思考推演与神态生成中... ]
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 游戏控制台 -->
      <div style="background:#111111; color:#FFFFFF; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:9px; font-weight:800;">游戏控制台</span>
          <span style="font-size:7.5px; color:#AAA;">输入回复完成任务解开任务锁</span>
        </div>

        <div style="display:flex; gap:6px;">
          <button class="ins-card-action-btn" id="btn-spicy-roll-dice" style="
            flex:1.2; padding:6px 0; font-size:9px; font-weight:800;
            background:${isLocked ? '#333' : '#FFF'}; color:${isLocked ? '#888' : '#111'};
            border:${isLocked ? '1px solid #555' : '1px solid #FFF'};
            ${isLocked ? 'cursor:not-allowed;' : 'cursor:pointer;'}
          ">
            ${isLocked ? '[ 任务锁定中 ]' : (isUserTurn ? '轮到你掷骰' : `轮到 ${s.charInfo.name} 掷骰`)}
          </button>
          <button class="ins-card-action-btn" id="btn-spicy-swap" style="flex:1; padding:6px 0; font-size:8px; font-weight:700; background:transparent; border:1px solid #FFF; color:#FFF;">
            /swap (换题-赔1币)
          </button>
          <button class="ins-card-action-btn" id="btn-spicy-skip" style="flex:1; padding:6px 0; font-size:8px; font-weight:700; background:transparent; border:1px solid #FFF; color:#FFF;">
            /skip (跳过)
          </button>
        </div>

        <div style="display:flex; gap:4px; margin-top:2px;">
          <input type="text" id="input-spicy-user-reply" placeholder="${isLocked ? '请在此输入你的实际动作与回复以解锁...' : '在此与对方交谈...'}" style="
            flex:1; background:#222; color:#FFF; border:1px solid #444; border-radius:6px; padding:6px 8px; font-size:9px; outline:none;
          " />
          <button class="ins-card-action-btn" id="btn-send-spicy-reply" style="padding:0 12px; font-size:8.5px; font-weight:800; background:#FFF; color:#111;">
            发送并解锁
          </button>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const stream = container.querySelector('#spicy-rp-dialog-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, 50);

  container.querySelector('#btn-spicy-exit-hall').onclick = () => {
    activeGameId = null;
    renderGamesCenterView(container);
  };

  container.querySelector('#btn-trigger-safety-word').onclick = () => {
    if (confirm('是否输入安全词 404 立即终止当前辛辣战局？')) {
      localStorage.removeItem(STORAGE_MONOPOLY_KEY);
      activeGameId = null;
      renderGamesCenterView(container);
    }
  };

  // 掷骰绑定
  const doRoll = () => {
    if (isCharThinking) return;
    if (s.isTaskLocked) {
      alert('【任务锁开启中】请先在下方输入栏回复并执行当前任务，或点击 /skip 跳过！');
      return;
    }
    handleSpicyRoll(container);
  };

  const rollBtn = container.querySelector('#btn-spicy-roll-dice');
  const centerDice = container.querySelector('#btn-dice-center-box');
  if (rollBtn) rollBtn.onclick = doRoll;
  if (centerDice) centerDice.onclick = doRoll;

  // 换题 /swap
  container.querySelector('#btn-spicy-swap').onclick = () => {
    if (s.userCoins <= 0) {
      alert('金币不足，无法更换任务！');
      return;
    }
    s.userCoins -= 1;
    const remainingTasks = DEFAULT_SPICY_TASKS.filter(t => t.title !== s.currentTask.title);
    s.currentTask = remainingTasks[Math.floor(Math.random() * remainingTasks.length)];
    s.isTaskLocked = true;
    callMonopolyMcpTool('swap_task');
    saveGameState(s);
    renderSpicyGameBoardView(container);
  };

  // 跳过 /skip
  container.querySelector('#btn-spicy-skip').onclick = () => {
    if (s.userCoins <= 0) {
      alert('金币不足，无法跳过！');
      return;
    }
    s.userCoins -= 1;
    s.isTaskLocked = false;
    s.roleplayLogs.push({
      sender: 'user',
      name: s.userInfo.name,
      content: `[玩家选择了跳过该任务，支付惩罚 1 金币，任务锁已解除]`
    });
    callMonopolyMcpTool('skip_task');
    saveGameState(s);
    renderSpicyGameBoardView(container);
  };

  // 发送回复推进
  const sendReply = async () => {
    if (isCharThinking) return;
    const textInput = container.querySelector('#input-spicy-user-reply');
    const msg = textInput.value.trim();
    if (!msg) return;
    textInput.value = '';

    s.roleplayLogs.push({
      sender: 'user',
      name: s.userInfo.name,
      content: msg
    });

    const isCompleted = checkTaskCompletionKeywords(s.currentTask, msg);
    if (isCompleted) {
      s.isTaskLocked = false;
      s.userCoins += 1;
      s.roleplayLogs.push({
        sender: 'system',
        name: '系统裁判',
        content: `[任务验收通过：【${s.currentTask.title}】已完成，奖励 +1 金币，任务锁已解除！]`
      });
    }

    isCharThinking = true;
    saveGameState(s);
    renderSpicyGameBoardView(container);

    await generateSpicyRoleplay(s.currentTask, msg);
    isCharThinking = false;
    saveGameState(s);
    renderSpicyGameBoardView(container);
  };

  container.querySelector('#btn-send-spicy-reply').onclick = sendReply;
  container.querySelector('#input-spicy-user-reply').onkeydown = (e) => {
    if (e.key === 'Enter') sendReply();
  };
}

// ════════════════════ 真实掷骰与剧情流 ════════════════════
async function handleSpicyRoll(container) {
  const s = gameState;
  const isUser = s.currentTurn === 'user';
  const dice = Math.floor(Math.random() * 6) + 1;
  s.lastDice = dice;

  if (isUser) {
    s.userPos = (s.userPos + dice) % 20;
    s.currentTask = DEFAULT_SPICY_TASKS[Math.floor(Math.random() * DEFAULT_SPICY_TASKS.length)];
    s.isTaskLocked = true;
    s.currentTurn = 'char';
    s.round = Math.min(s.maxRounds, s.round + 1);

    isCharThinking = true;
    saveGameState(s);
    renderSpicyGameBoardView(container);

    await generateSpicyRoleplay(s.currentTask);
    isCharThinking = false;
  } else {
    s.charPos = (s.charPos + dice) % 20;
    s.currentTask = DEFAULT_SPICY_TASKS[Math.floor(Math.random() * DEFAULT_SPICY_TASKS.length)];
    s.isTaskLocked = true;
    s.currentTurn = 'user';

    isCharThinking = true;
    saveGameState(s);
    renderSpicyGameBoardView(container);

    await generateSpicyRoleplay(s.currentTask);
    isCharThinking = false;
  }

  saveGameState(s);
  renderSpicyGameBoardView(container);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
