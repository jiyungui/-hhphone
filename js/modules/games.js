// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · SPICY MONOPOLY 辛辣大富翁 (MCP DUAL-MODE HUB)
// 原生 Python MCP 协议桥接 (spicy-monopoly) + 本地保底引擎 · 严禁 Emoji
// ═══════════════════════════════════════════════════════════════

import { McpGateway } from '../utils/mcpGateway.js';

const STORAGE_MONOPOLY_KEY = 'mini_spicy_monopoly_state';
const MCP_SERVER_URL = 'http://127.0.0.1:8765';

// 16 块闭环棋盘地块定义 (5x5 外圈周长)
export const BOARD_TILES = [
  { id: 0, name: '起点 (GO)', type: 'start', desc: '路过或停靠领取 200 资金' },
  { id: 1, name: '浅草街区', type: 'prop', price: 120, rent: 30 },
  { id: 2, name: '辛辣挑战', type: 'spicy', desc: '触发真心话大冒险惩罚' },
  { id: 3, name: '新宿商圈', type: 'prop', price: 160, rent: 45 },
  { id: 4, name: '命运卡片', type: 'chance', desc: '随机获得金钱奖励或扣除' },
  { id: 5, name: '涩谷十字', type: 'prop', price: 200, rent: 60 },
  { id: 6, name: '休息驿站', type: 'rest', desc: '在此停歇喝茶，跳过下回合' },
  { id: 7, name: '秋叶原', type: 'prop', price: 240, rent: 75 },
  { id: 8, name: '辛辣惩罚', type: 'spicy', desc: '强制执行对方提出的一个要求' },
  { id: 9, name: '银座大道', type: 'prop', price: 300, rent: 100 },
  { id: 10, name: '机会卡片', type: 'chance', desc: '触发突发事件' },
  { id: 11, name: '港区豪宅', type: 'prop', price: 350, rent: 120 },
  { id: 12, name: '税务稽查', type: 'tax', desc: '缴纳资产税 100' },
  { id: 13, name: '六本木', type: 'prop', price: 280, rent: 90 },
  { id: 14, name: '辛辣对决', type: 'spicy', desc: '向对方说一句符合此刻心情的真心话' },
  { id: 15, name: '表参道', type: 'prop', price: 220, rent: 70 }
];

// 辛辣挑战事件池 (同步 spicy-monopoly 规则)
export const SPICY_TASKS = [
  '向对方说一句傲娇的真心话，不许回避',
  '允许对方在设置中指定你更换一次头像',
  '无条件顺从对方下一句话提出的任性要求',
  '给对方转账 52 游戏币作为赔罪礼金',
  '用极其温柔的语气向对方发送一条晚安语音/消息',
  '交代你当前心中最在意对方的一件事',
  '下一轮掷骰子点数直接减半'
];

let gameState = null;
let isMcpOnline = false;

// 探测 Spicy Monopoly Python MCP 状态
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

// 调用 Python MCP 工具
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

function createNewGame(char) {
  const newState = {
    charInfo: {
      id: char.id,
      name: char.name,
      avatarUrl: char.avatarUrl || ''
    },
    userPos: 0,
    charPos: 0,
    userCash: 1500,
    charCash: 1500,
    ownership: {}, // { tileId: 'user' | 'char' }
    currentTurn: 'user', // 'user' | 'char'
    lastDice: 1,
    isRolling: false,
    logs: [`游戏开局：与 ${char.name} 的辛辣大富翁正式启动！`],
    isGameOver: false
  };

  // MCP 同步初始化战局
  callMonopolyMcpTool('init_game', { char_name: char.name, starting_cash: 1500 });
  saveGameState(newState);
  return newState;
}

// ════════════════════ 渲染游戏主视图 ════════════════════
export async function renderGamesCenterView(container) {
  await pingSpicyMonopolyMcp();
  gameState = getStoredGameState();

  if (!gameState) {
    renderGameSetupView(container);
  } else {
    renderGameBoardView(container);
  }
}

// 1. 游戏开局角色选择视图
function renderGameSetupView(container) {
  const charVault = JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');

  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 14px 14px 14px; overflow-y:auto; background:var(--chat-ui-bg, #FFF);">
      <div class="user-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--chat-ui-border, #111);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="user-header-title" style="font-size:15px; font-weight:900; color:var(--chat-ui-text-main, #111);">SPICY MONOPOLY</span>
          <span style="font-size:7.5px; font-family:ui-monospace, monospace; border:1px solid var(--chat-ui-border, #111); padding:1px 4px; border-radius:3px;">${isMcpOnline ? 'MCP CONNECTED' : 'LOCAL ENGINE'}</span>
        </div>
        <span class="user-count-badge" style="font-size:9px; font-weight:800;">大富翁中枢</span>
      </div>

      <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
        <div style="padding:12px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid var(--chat-ui-border, #111); border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:12px; font-weight:900; color:var(--chat-ui-text-main, #111);">辛辣大富翁 · 双人对决模式</span>
            <span style="font-size:8px; font-weight:800; color:${isMcpOnline ? '#2B8A3E' : '#888'};">● ${isMcpOnline ? 'MCP 服务在线 (8765)' : '本地沙盒模式'}</span>
          </div>
          <div style="font-size:9px; color:var(--chat-ui-text-sub, #666); line-height:1.45;">
            基于 spicy-monopoly 架构。买地收租与辛辣真心话大冒险。请从角色库选择一位角色开局：
          </div>
        </div>

        <div style="font-size:10px; font-weight:800; color:var(--chat-ui-text-main, #111); margin-top:4px;">选择对战角色</div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          ${charVault.length === 0 ? `
            <div style="padding:30px 0; text-align:center; font-size:10px; color:#888;">角色库暂无角色，请先前往角色库录入角色</div>
          ` : charVault.map(c => `
            <div class="char-card-item btn-select-game-char" data-id="${c.id}" style="padding:8px 10px; display:flex; align-items:center; justify-content:space-between; background:var(--chat-ui-card-bg, #FFF); border:1.2px solid var(--chat-ui-border, #111); border-radius:8px; cursor:pointer;">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:32px; height:32px; border-radius:6px; border:1px solid #111; overflow:hidden; background:#111; display:flex; align-items:center; justify-content:center;">
                  ${c.avatarUrl ? `<img src="${c.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:8px; color:#FFF; font-weight:800;">${c.name.slice(0,2)}</span>`}
                </div>
                <div style="display:flex; flex-direction:column;">
                  <span style="font-size:11.5px; font-weight:800; color:var(--chat-ui-text-main, #111);">${c.name}</span>
                  <span style="font-size:8px; color:var(--chat-ui-text-sub, #888);">${c.occupation || '沙盒角色就绪'}</span>
                </div>
              </div>
              <button class="ins-card-action-btn use" style="padding:4px 10px; font-size:9px; font-weight:800;">开局对战</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-select-game-char').forEach(el => {
    el.onclick = () => {
      const charId = el.getAttribute('data-id');
      const targetChar = charVault.find(c => c.id === charId);
      if (targetChar) {
        createNewGame(targetChar);
        renderGameBoardView(container);
      }
    };
  });
}

// 2. 5x5 经典闭环大富翁棋盘主视图
function renderGameBoardView(container) {
  const s = gameState;
  const isUserTurn = s.currentTurn === 'user';

  const getTileGridPos = (idx) => {
    if (idx >= 0 && idx <= 4) return { row: 1, col: idx + 1 };
    if (idx === 5) return { row: 2, col: 5 };
    if (idx === 6) return { row: 3, col: 5 };
    if (idx === 7) return { row: 4, col: 5 };
    if (idx >= 8 && idx <= 12) return { row: 5, col: 5 - (idx - 8) };
    if (idx === 13) return { row: 4, col: 1 };
    if (idx === 14) return { row: 3, col: 1 };
    if (idx === 15) return { row: 2, col: 1 };
    return { row: 1, col: 1 };
  };

  container.innerHTML = `
    <div class="user-container" style="display:flex; flex-direction:column; height:100%; padding:0 10px 10px 10px; overflow-y:auto; background:var(--chat-ui-bg, #FFF);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--chat-ui-border, #111);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:13px; font-weight:900; color:var(--chat-ui-text-main, #111);">SPICY MONOPOLY</span>
          <span style="font-size:7.5px; font-family:ui-monospace, monospace; background:#111; color:#FFF; padding:1px 4px; border-radius:3px;">VS ${s.charInfo.name}</span>
          <span style="font-size:7px; color:${isMcpOnline ? '#2B8A3E' : '#888'}; font-family:ui-monospace, monospace;">${isMcpOnline ? '[MCP]' : '[LOCAL]'}</span>
        </div>
        <button class="ins-card-action-btn" id="btn-restart-monopoly-game" style="padding:2px 6px; font-size:8px; background:#FFF; border:1px solid #CCC; color:#111;">
          重新开局
        </button>
      </div>

      <!-- 双方资产看板 -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin:6px 0;">
        <div style="padding:6px 8px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid ${isUserTurn ? '#111' : '#EAEAEA'}; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:8px; font-weight:800; color:#888;">[玩家] YOU ${isUserTurn ? '◀ 回合中' : ''}</div>
            <div style="font-size:12px; font-weight:900; color:#111;">¥ ${s.userCash}</div>
          </div>
          <div style="font-size:8px; font-weight:700; color:#666;">${Object.values(s.ownership).filter(v => v === 'user').length} 处物业</div>
        </div>

        <div style="padding:6px 8px; background:var(--chat-ui-card-bg, #FAFAFA); border:1.2px solid ${!isUserTurn ? '#111' : '#EAEAEA'}; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:8px; font-weight:800; color:#888;">[对手] ${s.charInfo.name} ${!isUserTurn ? '◀ 思考中' : ''}</div>
            <div style="font-size:12px; font-weight:900; color:#111;">¥ ${s.charCash}</div>
          </div>
          <div style="font-size:8px; font-weight:700; color:#666;">${Object.values(s.ownership).filter(v => v === 'char').length} 处物业</div>
        </div>
      </div>

      <!-- 5x5 棋盘 -->
      <div style="
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        grid-template-rows: repeat(5, 1fr);
        gap: 3px;
        width: 100%;
        aspect-ratio: 1;
        background: #111111;
        border: 1.5px solid #111111;
        border-radius: 10px;
        padding: 4px;
        box-sizing: border-box;
        position: relative;
      ">
        ${BOARD_TILES.map(tile => {
          const pos = getTileGridPos(tile.id);
          const owner = s.ownership[tile.id];
          const hasUser = s.userPos === tile.id;
          const hasChar = s.charPos === tile.id;

          let badgeColor = 'transparent';
          if (owner === 'user') badgeColor = '#111';
          if (owner === 'char') badgeColor = '#555';

          return `
            <div style="
              grid-row: ${pos.row};
              grid-column: ${pos.col};
              background: #FFFFFF;
              border-radius: 4px;
              padding: 2px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              position: relative;
              font-size: 7.5px;
              overflow: hidden;
            ">
              ${tile.type === 'prop' ? `
                <div style="width:100%; height:3px; background:${owner ? badgeColor : '#DDD'}; border-radius:1px;"></div>
              ` : `
                <div style="width:100%; height:3px; background:#111; border-radius:1px;"></div>
              `}

              <span style="font-weight:800; color:#111; text-align:center; line-height:1.1; font-size:7px; transform:scale(0.95);">
                ${tile.name}
              </span>

              <span style="font-size:6px; color:#888; transform:scale(0.85);">
                ${tile.type === 'prop' ? `¥${tile.price}` : tile.type.toUpperCase()}
              </span>

              <div style="display:flex; gap:2px; position:absolute; bottom:1px;">
                ${hasUser ? `<span style="width:7px; height:7px; border-radius:50%; background:#111; border:1px solid #FFF;" title="玩家"></span>` : ''}
                ${hasChar ? `<span style="width:7px; height:7px; border-radius:50%; background:#8E7CE8; border:1px solid #FFF;" title="${s.charInfo.name}"></span>` : ''}
              </div>
            </div>
          `;
        }).join('')}

        <!-- 棋盘中心控制台 -->
        <div style="
          grid-row: 2 / span 3;
          grid-column: 2 / span 3;
          background: #FAFAFA;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px;
          gap: 6px;
          box-shadow: inset 0 0 6px rgba(0,0,0,0.05);
        ">
          <div style="font-size:8px; font-weight:800; color:#888; letter-spacing:0.5px;">DICE STATION</div>

          <div style="
            width: 36px;
            height: 36px;
            background: #111111;
            color: #FFFFFF;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 900;
            box-shadow: 0 3px 8px rgba(0,0,0,0.15);
          ">
            ${s.lastDice}
          </div>

          ${isUserTurn ? `
            <button class="ins-card-action-btn use" id="btn-roll-dice" style="padding:5px 14px; font-size:9.5px; font-weight:800;">
              掷骰子 (ROLL)
            </button>
          ` : `
            <button class="ins-card-action-btn" style="padding:5px 14px; font-size:9.5px; font-weight:800; background:#EAEAEA; color:#888; border:none;" disabled>
              ${s.charInfo.name} 决策中...
            </button>
          `}
        </div>
      </div>

      <!-- 战局记录控制台 -->
      <div style="margin-top:6px; flex:1; display:flex; flex-direction:column; gap:4px; min-height:80px;">
        <div style="font-size:8.5px; font-weight:800; color:#888; display:flex; justify-content:space-between;">
          <span>战局日志 / GAME LOG</span>
          <span>当前位置: ${BOARD_TILES[s.userPos].name}</span>
        </div>
        <div style="
          flex:1;
          background: var(--chat-ui-card-bg, #FAFAFA);
          border: 1px solid var(--chat-ui-border, #EAEAEA);
          border-radius: 6px;
          padding: 6px 8px;
          overflow-y: auto;
          font-size: 8.5px;
          font-family: ui-monospace, monospace;
          line-height: 1.4;
          display: flex;
          flex-direction: column;
          gap: 2px;
        ">
          ${s.logs.slice().reverse().map((log, i) => `
            <div style="color:${i === 0 ? '#111' : '#777'}; font-weight:${i === 0 ? '700' : '400'};">
              › ${log}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-restart-monopoly-game').onclick = () => {
    localStorage.removeItem(STORAGE_MONOPOLY_KEY);
    renderGameSetupView(container);
  };

  const rollBtn = container.querySelector('#btn-roll-dice');
  if (rollBtn) {
    rollBtn.onclick = () => handleUserRoll(container);
  }

  if (!isUserTurn) {
    setTimeout(() => handleCharTurn(container), 900);
  }
}

// ════════════════════ 游戏流程引擎 (双模) ════════════════════

async function handleUserRoll(container) {
  const s = gameState;
  
  // 优先请求 MCP 工具计算
  const mcpRes = await callMonopolyMcpTool('roll_dice', { player: 'user', current_pos: s.userPos });
  const dice = (mcpRes.success && mcpRes.result.dice) ? mcpRes.result.dice : Math.floor(Math.random() * 6) + 1;
  s.lastDice = dice;

  const oldPos = s.userPos;
  let newPos = (oldPos + dice) % 16;
  s.userPos = newPos;

  if (newPos < oldPos) {
    s.userCash += 200;
    s.logs.push(`你路过了起点，领取 200 资金奖励`);
  }

  const currentTile = BOARD_TILES[newPos];
  s.logs.push(`你掷出了 ${dice} 点，前进至「${currentTile.name}」`);

  resolveTileEvent('user', currentTile, container, () => {
    s.currentTurn = 'char';
    saveGameState(s);
    renderGameBoardView(container);
  });
}

async function handleCharTurn(container) {
  const s = gameState;
  
  const mcpRes = await callMonopolyMcpTool('roll_dice', { player: 'char', current_pos: s.charPos });
  const dice = (mcpRes.success && mcpRes.result.dice) ? mcpRes.result.dice : Math.floor(Math.random() * 6) + 1;
  s.lastDice = dice;

  const oldPos = s.charPos;
  let newPos = (oldPos + dice) % 16;
  s.charPos = newPos;

  if (newPos < oldPos) {
    s.charCash += 200;
    s.logs.push(`${s.charInfo.name} 路过了起点，领取 200 资金`);
  }

  const currentTile = BOARD_TILES[newPos];
  s.logs.push(`${s.charInfo.name} 掷出了 ${dice} 点，移动至「${currentTile.name}」`);

  resolveTileEvent('char', currentTile, container, () => {
    s.currentTurn = 'user';
    saveGameState(s);
    renderGameBoardView(container);
  });
}

function resolveTileEvent(player, tile, container, onNext) {
  const s = gameState;
  const isUser = player === 'user';
  const opponent = isUser ? 'char' : 'user';
  const pName = isUser ? '你' : s.charInfo.name;

  if (tile.type === 'prop') {
    const owner = s.ownership[tile.id];
    if (!owner) {
      if (isUser) {
        openTileDecisionModal(tile, () => {
          if (s.userCash >= tile.price) {
            s.userCash -= tile.price;
            s.ownership[tile.id] = 'user';
            s.logs.push(`你花费 ¥${tile.price} 买下了「${tile.name}」！`);
            callMonopolyMcpTool('buy_property', { player: 'user', tile_id: tile.id, price: tile.price });
          } else {
            s.logs.push(`你的资金不足，无法购买「${tile.name}」`);
          }
          onNext();
        }, onNext);
        return;
      } else {
        if (s.charCash >= tile.price + 100) {
          s.charCash -= tile.price;
          s.ownership[tile.id] = 'char';
          s.logs.push(`${s.charInfo.name} 购入了「${tile.name}」`);
          callMonopolyMcpTool('buy_property', { player: 'char', tile_id: tile.id, price: tile.price });
        }
        onNext();
        return;
      }
    } else if (owner === opponent) {
      if (isUser) {
        s.userCash -= tile.rent;
        s.charCash += tile.rent;
        s.logs.push(`你踩中了对方的地产，支付过路费 ¥${tile.rent}`);
      } else {
        s.charCash -= tile.rent;
        s.userCash += tile.rent;
        s.logs.push(`${s.charInfo.name} 踩中了你的物业，向你支付过路费 ¥${tile.rent}`);
      }
    }
  } else if (tile.type === 'spicy') {
    const task = SPICY_TASKS[Math.floor(Math.random() * SPICY_TASKS.length)];
    s.logs.push(`[辛辣指令] ${pName} 触发挑战: ${task}`);
    callMonopolyMcpTool('trigger_spicy_event', { player, task });
    openSpicyTaskModal(pName, task, onNext);
    return;
  } else if (tile.type === 'tax') {
    if (isUser) s.userCash = Math.max(0, s.userCash - 100);
    else s.charCash = Math.max(0, s.charCash - 100);
    s.logs.push(`${pName} 缴纳税金 ¥100`);
  } else if (tile.type === 'chance') {
    const bonus = Math.random() > 0.5 ? 80 : -50;
    if (isUser) s.userCash += bonus;
    else s.charCash += bonus;
    s.logs.push(`${pName} 抽取命运卡：${bonus > 0 ? `获得奖励 ¥${bonus}` : `意外扣除 ¥${Math.abs(bonus)}`}`);
  }

  onNext();
}

function openTileDecisionModal(tile, onBuy, onSkip) {
  const overlay = document.createElement('div');
  overlay.className = 'sticker-modal-overlay';
  overlay.innerHTML = `
    <div class="sticker-modal-card">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">发现无主地产</span>
      </div>
      <div class="sticker-modal-body">
        <div style="font-size:12px; font-weight:800; color:#111;">「${tile.name}」</div>
        <div style="font-size:9px; color:#666;">售价: ¥${tile.price} | 基础过路费: ¥${tile.rent}</div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="ins-card-action-btn use" id="btn-buy-prop" style="flex:1; padding:8px 0;">购买地产</button>
          <button class="ins-card-action-btn" id="btn-skip-prop" style="flex:1; padding:8px 0; background:#FFF; border:1px solid #CCC; color:#111;">放弃</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-buy-prop').onclick = () => { overlay.remove(); onBuy(); };
  overlay.querySelector('#btn-skip-prop').onclick = () => { overlay.remove(); onSkip(); };
}

function openSpicyTaskModal(targetName, taskText, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'sticker-modal-overlay';
  overlay.innerHTML = `
    <div class="sticker-modal-card">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">SPICY CHALLENGE</span>
      </div>
      <div class="sticker-modal-body">
        <div style="font-size:9px; font-weight:800; color:#888;">辛辣挑战指定对象: ${targetName}</div>
        <div style="font-size:11px; font-weight:900; color:#111; padding:10px; background:#FAFAFA; border:1.2px solid #111; border-radius:6px; line-height:1.4;">
          ${taskText}
        </div>
        <button class="ins-card-action-btn use" id="btn-confirm-spicy" style="width:100%; padding:8px 0; margin-top:4px;">确认并继续</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-confirm-spicy').onclick = () => { overlay.remove(); onConfirm(); };
}
