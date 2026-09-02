// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 随便钱包 (WALLET MODULE)
// 白黑 INS 风格 · 独立模块 · 亲密付双向管理 / 聊天室卡片联动
// ═══════════════════════════════════════════════════════════════
import { sendSystemSms } from './messages.js';

let activeWalletTab = 'balance'; // 'balance' | 'bills' | 'cards' | 'intimate'
let activeCurrencyCode = 'CNY';
let activeBillFilter = 'all';
let activeIntimateSubTab = 'user_to_char'; // 'user_to_char' | 'char_to_user'

export const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: '人民币', full: 'CNY · 人民币 (¥)' },
  { code: 'USD', symbol: '$', name: '美元', full: 'USD · 美元 ($)' },
  { code: 'JPY', symbol: '円', name: '日元', full: 'JPY · 日元 (円)' },
  { code: 'KRW', symbol: '₩', name: '韩元', full: 'KRW · 韩元 (₩)' },
  { code: 'GBP', symbol: '£', name: '英镑', full: 'GBP · 英镑 (£)' },
  { code: 'EUR', symbol: '€', name: '欧元', full: 'EUR · 欧元 (€)' },
];

const FX_RATES_BASE_USD = {
  USD: 1.0,
  CNY: 7.20,
  JPY: 150.0,
  KRW: 1350.0,
  GBP: 0.79,
  EUR: 0.92
};

export function convertCurrency(amount, fromCurr = 'CNY', toCurr = 'CNY') {
  if (fromCurr === toCurr) return amount;
  const rateFrom = FX_RATES_BASE_USD[fromCurr] || 1.0;
  const rateTo = FX_RATES_BASE_USD[toCurr] || 1.0;
  const inUsd = amount / rateFrom;
  return inUsd * rateTo;
}

function categorizeBill(bill) {
  const title = bill.title || '';
  const typeText = bill.typeText || '';
  if (title.includes('转账') || typeText.includes('转账')) return { key: 'transfer', name: '转账汇款' };
  if (title.includes('闲鱼') || typeText.includes('闲鱼') || title.includes('集市')) return { key: 'market', name: '闲鱼交易' };
  if (title.includes('购物') || title.includes('商城') || title.includes('买') || title.includes('礼物')) return { key: 'shopping', name: '商城购物' };
  if (title.includes('充值') || typeText.includes('充值') || title.includes('存入')) return { key: 'recharge', name: '充值转入' };
  if (title.includes('提现') || typeText.includes('提现')) return { key: 'withdraw', name: '账户提现' };
  if (title.includes('亲密付')) return { key: 'intimate', name: '亲密付扣款' };
  return { key: 'other', name: '其他日常支出' };
}

export function getWalletData() {
  const defaultData = {
    balance: 0.00,
    balances: { CNY: 0.00, USD: 0.00, JPY: 0.00, KRW: 0.00, GBP: 0.00, EUR: 0.00 },
    phone: '',
    boundUserName: '',
    cards: [],
    bills: [],
    intimatePay: {
      userToChar: [], // User 赠送给 Char 的
      charToUser: []  // Char 赠送给 User 的
    }
  };

  const stored = JSON.parse(localStorage.getItem('mini_user_wallet_data') || 'null');
  if (!stored) return defaultData;

  if (!stored.balances) {
    stored.balances = { CNY: stored.balance || 0.00, USD: 0.00, JPY: 0.00, KRW: 0.00, GBP: 0.00, EUR: 0.00 };
  }

  // 兼容老版本 intimatePay 为数组的情况
  if (Array.isArray(stored.intimatePay)) {
    const oldArr = stored.intimatePay;
    stored.intimatePay = {
      userToChar: oldArr,
      charToUser: []
    };
  }

  if (Array.isArray(stored.cards)) {
    stored.cards.forEach(c => {
      if (!c.currency) c.currency = 'CNY';
      if (!c.currencySymbol) c.currencySymbol = '¥';
      if (c.balance === undefined) c.balance = 0.00;
    });
  }

  return stored;
}

export function saveWalletData(data) {
  if (data.balances && data.balances.CNY !== undefined) {
    data.balance = data.balances.CNY;
  }
  localStorage.setItem('mini_user_wallet_data', JSON.stringify(data));
}

export function renderWalletView(container) {
  const data = getWalletData();

  container.innerHTML = `
    <div class="wallet-container">
      <header class="wallet-header">
        <div class="wallet-header-title-box">
          <span class="wallet-title">随便钱包</span>
          <span class="wallet-tag">WALLET OS</span>
        </div>
        <div class="wallet-header-badge">${data.cards.length > 0 ? `已激活 ${data.cards.length} 张卡` : '未绑定银行卡'}</div>
      </header>

      <nav class="wallet-nav-tabs">
        <button class="wallet-nav-btn ${activeWalletTab === 'balance' ? 'active' : ''}" data-tab="balance">余额</button>
        <button class="wallet-nav-btn ${activeWalletTab === 'bills' ? 'active' : ''}" data-tab="bills">账单</button>
        <button class="wallet-nav-btn ${activeWalletTab === 'cards' ? 'active' : ''}" data-tab="cards">银行卡 (${data.cards.length})</button>
        <button class="wallet-nav-btn ${activeWalletTab === 'intimate' ? 'active' : ''}" data-tab="intimate">亲密付</button>
      </nav>

      <main class="wallet-content-pane">
        ${renderActiveTabContent(data)}
      </main>
    </div>
  `;

  bindWalletEvents(container);
}

function renderActiveTabContent(data) {
  switch (activeWalletTab) {
    case 'balance': return renderBalanceSection(data);
    case 'bills': return renderBillsSection(data);
    case 'cards': return renderCardsSection(data);
    case 'intimate': return renderIntimateSection(data);
    default: return renderBalanceSection(data);
  }
}

// 1. 余额
function renderBalanceSection(data) {
  const hasCard = data.cards && data.cards.length > 0;
  const currentCurrObj = CURRENCIES.find(c => c.code === activeCurrencyCode) || CURRENCIES[0];
  const currentVal = (data.balances && data.balances[activeCurrencyCode] !== undefined)
    ? data.balances[activeCurrencyCode]
    : 0.00;

  return `
    <div class="wallet-balance-master-card">
      <div class="balance-card-header-row">
        <div class="balance-title-group">
          <span class="balance-meta-tag">VAULT ASSET</span>
          <span class="balance-currency-title">${currentCurrObj.name} · 可用总额</span>
        </div>
        <span class="balance-code-pill">${currentCurrObj.code}</span>
      </div>

      <div class="balance-display-row">
        <span class="balance-symbol-large">${currentCurrObj.symbol}</span>
        <span class="balance-number-large">${currentVal.toFixed(2)}</span>
      </div>

      <div class="balance-action-grid">
        <button class="balance-main-btn primary-solid" id="btn-wallet-recharge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>从卡充值</span>
        </button>
        <button class="balance-main-btn outline-solid" id="btn-wallet-withdraw">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>提现到卡</span>
        </button>
      </div>

      ${!hasCard ? `
        <div class="balance-card-footer-alert">
          <span class="alert-dot"></span>
          <span>尚未激活银行卡，请至「银行卡」板块完成卡片激活方可存取资金。</span>
        </div>
      ` : ''}
    </div>

    <div class="wallet-section-box">
      <div class="section-box-header">
        <span class="section-box-title">币种资产分账户 / CURRENCY VAULTS</span>
        <span class="section-box-desc">点击切换币种看板</span>
      </div>

      <div class="currency-vault-grid">
        ${CURRENCIES.map(curr => {
          const val = (data.balances && data.balances[curr.code] !== undefined) ? data.balances[curr.code] : 0.00;
          const isSelected = curr.code === activeCurrencyCode;
          return `
            <div class="currency-vault-card ${isSelected ? 'selected' : ''}" data-currency="${curr.code}">
              <div class="currency-vault-top">
                <span class="curr-name">${curr.name}</span>
                <span class="curr-symbol-badge">${curr.code}</span>
              </div>
              <div class="currency-vault-amount">
                <span class="curr-sym">${curr.symbol}</span>
                <span class="curr-val">${val.toFixed(2)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 2. 账单
function renderBillsSection(data) {
  const bills = data.bills || [];

  let totalExpense = 0;
  let totalIncome = 0;
  const categoryMap = {};

  bills.forEach(b => {
    const amt = parseFloat(b.amount) || 0;
    if (b.type === 'expense') {
      totalExpense += amt;
      const cat = categorizeBill(b);
      if (!categoryMap[cat.key]) {
        categoryMap[cat.key] = { name: cat.name, total: 0, count: 0 };
      }
      categoryMap[cat.key].total += amt;
      categoryMap[cat.key].count += 1;
    } else {
      totalIncome += amt;
    }
  });

  const expenseRanks = Object.keys(categoryMap).map(k => ({
    key: k,
    name: categoryMap[k].name,
    total: categoryMap[k].total,
    count: categoryMap[k].count,
    percent: totalExpense > 0 ? Math.round((categoryMap[k].total / totalExpense) * 100) : 0
  })).sort((a, b) => b.total - a.total);

  const filteredBills = bills.filter(b => {
    if (activeBillFilter === 'all') return true;
    if (activeBillFilter === 'expense') return b.type === 'expense';
    if (activeBillFilter === 'income') return b.type === 'income';
    const cat = categorizeBill(b);
    return cat.key === activeBillFilter;
  });

  return `
    <div class="wallet-bills-summary-card">
      <div class="bills-summary-header">
        <span class="bills-summary-title">收支汇总分析 / FINANCIAL SUMMARY</span>
        <button class="ins-clear-bills-pill" id="btn-clear-wallet-bills" title="清空全部账单流水">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span>清空记录</span>
        </button>
      </div>

      <div class="bills-summary-stats-grid">
        <div class="summary-stat-box expense">
          <span class="stat-label">总支出 (EXPENSE)</span>
          <span class="stat-amount">-¥${totalExpense.toFixed(2)}</span>
        </div>
        <div class="summary-stat-box income">
          <span class="stat-label">总入账 (INCOME)</span>
          <span class="stat-amount">+¥${totalIncome.toFixed(2)}</span>
        </div>
        <div class="summary-stat-box net">
          <span class="stat-label">净流动结余</span>
          <span class="stat-amount">¥${(totalIncome - totalExpense).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="wallet-section-box">
      <div class="section-box-header">
        <span class="section-box-title">支出类目排行 / EXPENSE RANKING</span>
        <span class="section-box-desc">${expenseRanks.length > 0 ? '按金额由高到低排序' : '暂无支出'}</span>
      </div>

      <div class="expense-rank-list">
        ${expenseRanks.length === 0 ? `
          <div class="ins-empty-hint" style="padding:14px 0;">暂无支出消费分类数据</div>
        ` : expenseRanks.map((r, idx) => `
          <div class="expense-rank-item">
            <div class="expense-rank-top">
              <div class="expense-rank-left">
                <span class="rank-index-badge">${idx + 1}</span>
                <span class="rank-name">${r.name}</span>
                <span class="rank-count-tag">${r.count} 笔</span>
              </div>
              <div class="expense-rank-right">
                <span class="rank-amount">¥${r.total.toFixed(2)}</span>
                <span class="rank-percent">${r.percent}%</span>
              </div>
            </div>
            <div class="expense-progress-track">
              <div class="expense-progress-bar" style="width: ${Math.max(r.percent, 4)}%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="wallet-section-box" style="margin-top: 4px;">
      <div class="section-box-header">
        <span class="section-box-title">收支明细记录 (${filteredBills.length})</span>
        <span class="section-box-desc">点击卡片查看凭证</span>
      </div>

      <div class="bills-filter-bar">
        <button class="bill-filter-chip ${activeBillFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
        <button class="bill-filter-chip ${activeBillFilter === 'expense' ? 'active' : ''}" data-filter="expense">仅支出</button>
        <button class="bill-filter-chip ${activeBillFilter === 'income' ? 'active' : ''}" data-filter="income">仅入账</button>
        <button class="bill-filter-chip ${activeBillFilter === 'transfer' ? 'active' : ''}" data-filter="transfer">转账</button>
        <button class="bill-filter-chip ${activeBillFilter === 'shopping' ? 'active' : ''}" data-filter="shopping">购物</button>
        <button class="bill-filter-chip ${activeBillFilter === 'market' ? 'active' : ''}" data-filter="market">闲鱼</button>
      </div>

      <div class="wallet-bill-list">
        ${filteredBills.length === 0 ? `
          <div class="ins-empty-hint" style="padding: 24px 0;">当前筛选下暂无明细记录</div>
        ` : filteredBills.map(b => {
          const cat = categorizeBill(b);
          return `
            <div class="wallet-bill-item-card" data-bid="${b.id}">
              <div class="bill-card-left">
                <div class="bill-icon-box ${b.type}">
                  ${b.type === 'income' ? `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  ` : `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  `}
                </div>
                <div class="bill-meta-info">
                  <div class="bill-title-row">
                    <span class="bill-main-title">${escapeHtml(b.title)}</span>
                    <span class="bill-cat-chip">${cat.name}</span>
                  </div>
                  <span class="bill-timestamp">${b.time} · ${b.typeText || '账单明细'}</span>
                </div>
              </div>
              <div class="bill-card-right">
                <span class="bill-amount-num ${b.type === 'income' ? 'income' : 'expense'}">
                  ${b.type === 'income' ? '+' : '-'}${parseFloat(b.amount).toFixed(2)}
                </span>
                <span class="bill-currency-tag">${b.currency || 'CNY'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 3. 银行卡
function renderCardsSection(data) {
  const cards = data.cards || [];
  return `
    <div class="wallet-card cards-section-card">
      <div class="cards-section-header">
        <div class="cards-header-info">
          <span class="cards-main-title">我的卡片 / CARDS</span>
          <span class="cards-count-tag">已激活 ${cards.length} 张</span>
        </div>
        <button class="ins-add-card-pill-btn" id="btn-open-add-card-modal" title="激活并绑定新银行卡">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>激活新卡</span>
        </button>
      </div>

      <div class="cards-grid-list">
        ${cards.length === 0 ? `
          <div class="wallet-empty-card-placeholder" id="btn-empty-card-add">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>点击上方「激活新卡」绑定第一张储蓄卡</span>
          </div>
        ` : cards.map(c => `
          <div class="bank-card-item" data-card-id="${c.id}">
            <div class="bank-card-top">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="bank-name">随便银行 · 储蓄卡</span>
                <span class="bank-currency-tag">${c.currency || 'CNY'}</span>
              </div>
              <span class="bank-user-chip">${escapeHtml(c.boundUserName)}</span>
            </div>

            <div class="bank-card-middle">
              <div class="bank-card-number">•••• •••• •••• ${c.cardNo.slice(-4)}</div>
              <div class="bank-card-balance-display">
                <span class="card-balance-lbl">卡内可用余额</span>
                <span class="card-balance-num">${c.currencySymbol || '¥'} ${(c.balance || 0).toFixed(2)}</span>
              </div>
            </div>

            <div class="bank-card-actions-bar single-action">
              <button class="bank-action-btn primary-card-btn btn-card-recharge" data-cid="${c.id}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>卡内快速充值 (${c.currency})</span>
              </button>
            </div>

            <div class="bank-card-bottom">
              <span>预留手机: ${c.phone.slice(0, 3)}****${c.phone.slice(-4)}</span>
              <span class="bank-status-dot">已激活使用中</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 4. ✨ 深度重构：亲密付 (分为 User给Char / Char给User 两个子板块)
function renderIntimateSection(data) {
  const intimateObj = data.intimatePay || { userToChar: [], charToUser: [] };
  const userToCharList = intimateObj.userToChar || [];
  const charToUserList = intimateObj.charToUser || [];

  return `
    <div class="wallet-card intimate-master-card">
      <div class="intimate-header-row">
        <div class="intimate-title-group">
          <span class="intimate-main-title">亲密付中枢 / INTIMATE PAY</span>
          <span class="intimate-sub-badge">AUTO DEBIT</span>
        </div>
        <button class="ins-add-card-pill-btn" id="btn-open-grant-intimate-modal">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>赠送亲密付</span>
        </button>
      </div>

      <!-- 子板块切换 Pills -->
      <div class="intimate-sub-nav">
        <button class="intimate-sub-tab-btn ${activeIntimateSubTab === 'user_to_char' ? 'active' : ''}" data-subtab="user_to_char">
          我赠送给 TA 的 (${userToCharList.length})
        </button>
        <button class="intimate-sub-tab-btn ${activeIntimateSubTab === 'char_to_user' ? 'active' : ''}" data-subtab="char_to_user">
          TA 赠送给我的 (${charToUserList.length})
        </button>
      </div>

      <!-- 列表内容区 -->
      <div class="intimate-content-list">
        ${activeIntimateSubTab === 'user_to_char' ? `
          ${userToCharList.length === 0 ? `
            <div class="ins-empty-hint" style="padding:24px 0;">
              暂未向任何 Char 赠送亲密付。<br/>点击右上角「赠送亲密付」选择扣款源与额度为TA开通！
            </div>
          ` : userToCharList.map(item => `
            <div class="intimate-card-item">
              <div class="intimate-item-top">
                <div class="intimate-char-info">
                  <div class="intimate-avatar-circle">${escapeHtml(item.charName.slice(0, 1))}</div>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <span class="intimate-target-name">${escapeHtml(item.charName)}</span>
                    <span class="intimate-source-tag">扣款源: ${escapeHtml(item.sourceName)}</span>
                  </div>
                </div>
                <div class="intimate-limit-badge">
                  <span class="limit-num">${item.limitText || '无限额度'}</span>
                  <span class="limit-lbl">可用额度</span>
                </div>
              </div>
              <div class="intimate-item-bottom">
                <span>开通时间: ${item.createTime || '近期'}</span>
                <button class="intimate-revoke-btn" data-char="${escapeHtml(item.charName)}">关闭授权</button>
              </div>
            </div>
          `).join('')}
        ` : `
          ${charToUserList.length === 0 ? `
            <div class="ins-empty-hint" style="padding:24px 0;">
              暂无角色主动赠送你的亲密付。<br/>当与 Char 羁绊加深时，TA 会在通讯中主动为你开通亲密付副卡！
            </div>
          ` : charToUserList.map(item => `
            <div class="intimate-card-item from-char">
              <div class="intimate-item-top">
                <div class="intimate-char-info">
                  <div class="intimate-avatar-circle from-char">${escapeHtml(item.charName.slice(0, 1))}</div>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <span class="intimate-target-name">${escapeHtml(item.charName)} 赠送的亲密付</span>
                    <span class="intimate-source-tag">TA的专属账户自动扣划</span>
                  </div>
                </div>
                <div class="intimate-limit-badge">
                  <span class="limit-num">${item.limitText || '无限额度'}</span>
                  <span class="limit-lbl">TA提供的额度</span>
                </div>
              </div>
              <div class="intimate-item-bottom">
                <span>赠送时间: ${item.createTime || '近期'}</span>
                <span style="font-size:8px; font-weight:800; color:#10B981;">已激活生效中</span>
              </div>
            </div>
          `).join('')}
        `}
      </div>
    </div>
  `;
}

// 事件绑定
function bindWalletEvents(container) {
  container.querySelectorAll('.wallet-nav-btn').forEach(btn => {
    btn.onclick = () => {
      activeWalletTab = btn.getAttribute('data-tab');
      renderWalletView(container);
    };
  });

  const walletData = getWalletData();

  // 亲密付子板块切换
  container.querySelectorAll('.intimate-sub-tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeIntimateSubTab = btn.getAttribute('data-subtab');
      renderWalletView(container);
    };
  });

  // 打开赠送亲密付弹窗
  const openGrantBtn = container.querySelector('#btn-open-grant-intimate-modal');
  if (openGrantBtn) {
    openGrantBtn.onclick = () => openGrantIntimatePayModal(container);
  }

  // 关闭/解绑亲密付
  container.querySelectorAll('.intimate-revoke-btn').forEach(btn => {
    btn.onclick = () => {
      const charName = btn.getAttribute('data-char');
      if (confirm(`确定要关闭对【${charName}】的亲密付授权吗？`)) {
        walletData.intimatePay.userToChar = walletData.intimatePay.userToChar.filter(i => i.charName !== charName);
        saveWalletData(walletData);
        showWalletToast(`已关闭对「${charName}」的亲密付`);
        renderWalletView(container);
      }
    };
  });

  // 币种切换
  container.querySelectorAll('.currency-vault-card').forEach(cardEl => {
    cardEl.onclick = () => {
      activeCurrencyCode = cardEl.getAttribute('data-currency') || 'CNY';
      renderWalletView(container);
    };
  });

  // 账单筛选
  container.querySelectorAll('.bill-filter-chip').forEach(chip => {
    chip.onclick = () => {
      activeBillFilter = chip.getAttribute('data-filter') || 'all';
      renderWalletView(container);
    };
  });

  // 点击账单弹出凭证详情
  container.querySelectorAll('.wallet-bill-item-card').forEach(cardEl => {
    cardEl.onclick = () => {
      const bid = cardEl.getAttribute('data-bid');
      const targetBill = walletData.bills.find(b => b.id === bid);
      if (targetBill) {
        openBillDetailReceiptModal(targetBill, (billToDelete) => {
          walletData.bills = walletData.bills.filter(b => b.id !== billToDelete.id);
          saveWalletData(walletData);
          showWalletToast('已删除此笔账单凭据');
          renderWalletView(container);
        });
      }
    };
  });

  // 从卡充值
  const rechargeBtn = container.querySelector('#btn-wallet-recharge');
  if (rechargeBtn) {
    rechargeBtn.onclick = () => {
      if (!walletData.cards || walletData.cards.length === 0) {
        showWalletToast('请先在「银行卡」板块激活银行卡再进行充值');
        return;
      }
      openFxCardModal('recharge', activeCurrencyCode, walletData.cards, (card, targetAmount, deductAmount) => {
        if ((card.balance || 0) < deductAmount) {
          showWalletToast(`该卡内余额不足以支付 ${deductAmount.toFixed(2)} ${card.currency}`);
          return;
        }

        card.balance -= deductAmount;
        if (!walletData.balances) walletData.balances = {};
        walletData.balances[activeCurrencyCode] = (walletData.balances[activeCurrencyCode] || 0) + targetAmount;

        const isFx = card.currency !== activeCurrencyCode;
        const fxDetailText = isFx ? ` (按汇率扣除 ${deductAmount.toFixed(2)} ${card.currency})` : '';

        walletData.bills.unshift({
          id: `bill-${Date.now()}`,
          title: `卡 (${card.cardNo.slice(-4)}) 转入钱包 ${activeCurrencyCode}${fxDetailText}`,
          type: 'income',
          typeText: '余额充值',
          currency: activeCurrencyCode,
          amount: targetAmount,
          payer: `随便银行卡 (尾号 ${card.cardNo.slice(-4)})`,
          recipient: '随便钱包可用余额',
          time: new Date().toISOString().slice(0, 16).replace('T', ' ')
        });
        saveWalletData(walletData);

        const smsFxNotice = isFx ? `，已按实时汇率折合扣除 ${deductAmount.toFixed(2)} ${card.currency}` : '';
        sendSystemSms('随便银行', `【随便银行】您尾号 ${card.cardNo.slice(-4)} 的账户成功向随便钱包充值 ${targetAmount.toFixed(2)} ${activeCurrencyCode}${smsFxNotice}。当前卡内剩余可用余额为：${card.balance.toFixed(2)} ${card.currency}。`);

        showWalletToast(`已成功充入 ${targetAmount.toFixed(2)} ${activeCurrencyCode} 到钱包`);
        renderWalletView(container);
      });
    };
  }

  // 提现到卡
  const withdrawBtn = container.querySelector('#btn-wallet-withdraw');
  if (withdrawBtn) {
    withdrawBtn.onclick = () => {
      if (!walletData.cards || walletData.cards.length === 0) {
        showWalletToast('请先在「银行卡」板块激活银行卡再进行提现');
        return;
      }
      const currentCurrBalance = (walletData.balances && walletData.balances[activeCurrencyCode] !== undefined)
        ? walletData.balances[activeCurrencyCode]
        : 0.00;

      if (currentCurrBalance <= 0) {
        showWalletToast(`当前 ${activeCurrencyCode} 钱包余额为 0，无法提现`);
        return;
      }

      openFxCardModal('withdraw', activeCurrencyCode, walletData.cards, (card, targetAmount, depositAmount) => {
        if (targetAmount > currentCurrBalance) {
          showWalletToast(`提现金额超出当前 ${activeCurrencyCode} 钱包可用余额！`);
          return;
        }

        walletData.balances[activeCurrencyCode] -= targetAmount;
        card.balance = (card.balance || 0) + depositAmount;

        const isFx = card.currency !== activeCurrencyCode;
        const fxDetailText = isFx ? ` (按汇率存入 ${depositAmount.toFixed(2)} ${card.currency})` : '';

        walletData.bills.unshift({
          id: `bill-${Date.now()}`,
          title: `钱包 (${activeCurrencyCode}) 提现到卡 (${card.cardNo.slice(-4)})${fxDetailText}`,
          type: 'expense',
          typeText: '余额提现',
          currency: activeCurrencyCode,
          amount: targetAmount,
          payer: '随便钱包可用余额',
          recipient: `随便银行卡 (尾号 ${card.cardNo.slice(-4)})`,
          time: new Date().toISOString().slice(0, 16).replace('T', ' ')
        });
        saveWalletData(walletData);

        const smsFxNotice = isFx ? `，已按实时汇率折合入账 ${depositAmount.toFixed(2)} ${card.currency}` : '';
        sendSystemSms('随便银行', `【随便银行】您尾号 ${card.cardNo.slice(-4)} 的账户收到随便钱包提现 ${targetAmount.toFixed(2)} ${activeCurrencyCode}${smsFxNotice}，当前卡内可用余额为：${card.balance.toFixed(2)} ${card.currency}。`);

        showWalletToast(`成功提现 ${targetAmount.toFixed(2)} ${activeCurrencyCode} 到卡`);
        renderWalletView(container);
      });
    };
  }

  // 银行卡自身充值
  container.querySelectorAll('.btn-card-recharge').forEach(btn => {
    btn.onclick = () => {
      const cid = btn.getAttribute('data-cid');
      const card = walletData.cards.find(c => c.id === cid);
      if (!card) return;

      openDedicatedCardRechargeModal(card, (amount) => {
        card.balance = (card.balance || 0) + amount;
        walletData.bills.unshift({
          id: `bill-${Date.now()}`,
          title: `银行卡 (${card.cardNo.slice(-4)}) 资金存入`,
          type: 'income',
          typeText: '账户入账',
          currency: card.currency,
          amount: amount,
          payer: '现金存入 / 网银电汇',
          recipient: `随便银行储蓄卡 (尾号 ${card.cardNo.slice(-4)})`,
          time: new Date().toISOString().slice(0, 16).replace('T', ' ')
        });
        saveWalletData(walletData);

        sendSystemSms('随便银行', `【随便银行】您尾号 ${card.cardNo.slice(-4)} 的账户于今日完成资金存入 ${amount.toFixed(2)} ${card.currency}，当前卡内可用余额为：${card.balance.toFixed(2)} ${card.currency}。`);

        showWalletToast(`卡内成功存入 ${card.currencySymbol} ${amount.toFixed(2)}`);
        renderWalletView(container);
      });
    };
  });

  const openAddCardBtn = container.querySelector('#btn-open-add-card-modal');
  const emptyCardAddBtn = container.querySelector('#btn-empty-card-add');
  if (openAddCardBtn) openAddCardBtn.onclick = () => openAddCardModal(container);
  if (emptyCardAddBtn) emptyCardAddBtn.onclick = () => openAddCardModal(container);

  const clearBillsBtn = container.querySelector('#btn-clear-wallet-bills');
  if (clearBillsBtn) {
    clearBillsBtn.onclick = () => {
      if (!walletData.bills || walletData.bills.length === 0) {
        showWalletToast('暂无账单记录需要清空');
        return;
      }
      walletData.bills = [];
      saveWalletData(walletData);
      showWalletToast('已成功清空全部交易记录');
      renderWalletView(container);
    };
  }
}

// ✨ 核心新增：向指定 Char 赠送亲密付弹窗并发送聊天室卡片
function openGrantIntimatePayModal(container) {
  const walletData = getWalletData();
  const charList = JSON.parse(localStorage.getItem('mini_user_characters') || '[]');

  if (charList.length === 0) {
    showWalletToast('系统内尚未创建任何 Char 角色，请先至角色库添加');
    return;
  }

  // 构造可选扣款源选项
  const sourceOptions = [];
  // 1. 银行卡选项
  if (walletData.cards && walletData.cards.length > 0) {
    walletData.cards.forEach(c => {
      sourceOptions.push({
        id: `card_${c.id}`,
        type: 'card',
        name: `银行卡 · 尾号 ${c.cardNo.slice(-4)} (${c.currency} 余额: ${(c.balance||0).toFixed(2)})`,
        currSymbol: c.currencySymbol || '¥',
        currCode: c.currency
      });
    });
  }
  // 2. 货币钱包余额选项
  CURRENCIES.forEach(curr => {
    const bVal = (walletData.balances && walletData.balances[curr.code] !== undefined) ? walletData.balances[curr.code] : 0.00;
    sourceOptions.push({
      id: `balance_${curr.code}`,
      type: 'balance',
      name: `${curr.name} 钱包可用余额 (余额: ${bVal.toFixed(2)})`,
      currSymbol: curr.symbol,
      currCode: curr.code
    });
  });

  const modal = document.createElement('div');
  modal.className = 'wallet-modal-overlay active';

  modal.innerHTML = `
    <div class="wallet-modal-card" style="max-width:320px;">
      <div class="wallet-modal-header">
        <div style="display:flex; flex-direction:column; gap:1px;">
          <span class="wallet-modal-title">赠送亲密付 / GRANT INTIMATE</span>
          <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">DIRECT CHAT CARD INJECTION</span>
        </div>
        <button class="wallet-modal-close" id="btn-close-grant-intimate">×</button>
      </div>

      <div class="wallet-form-pane">
        <!-- 1. 选择目标角色 -->
        <div class="wallet-form-group">
          <label class="wallet-form-label">赠送目标角色 / CHAR</label>
          <select class="wallet-select" id="input-grant-char-name">
            ${charList.map(cName => `<option value="${escapeHtml(cName)}">${escapeHtml(cName)}</option>`).join('')}
          </select>
        </div>

        <!-- 2. 选择绑定扣款源 (银行卡或指定货币余额) -->
        <div class="wallet-form-group">
          <label class="wallet-form-label">指定扣款账户 / SOURCE ACCOUNT</label>
          <select class="wallet-select" id="input-grant-source-id">
            ${sourceOptions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>

        <!-- 3. 设置赠送额度 -->
        <div class="wallet-form-group">
          <label class="wallet-form-label">设置可用额度 / LIMIT</label>
          <div style="display:flex; gap:6px;">
            <input type="number" class="wallet-input" id="input-grant-limit-amount" placeholder="留空或0表示无限额度" style="flex:1; font-weight:800;" />
            <button class="wallet-btn secondary-btn" id="btn-set-unlimited" style="padding:0 8px; font-size:9.5px; white-space:nowrap;">无限额度</button>
          </div>
        </div>

        <button class="wallet-btn primary-btn" id="btn-confirm-grant-action" style="width:100%; margin-top:6px; padding:10px 0;">赠送并注入聊天室卡片</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-grant-intimate').onclick = close;

  const limitInput = modal.querySelector('#input-grant-limit-amount');
  modal.querySelector('#btn-set-unlimited').onclick = () => {
    limitInput.value = '';
    showWalletToast('已设为无限额度');
  };

  modal.querySelector('#btn-confirm-grant-action').onclick = () => {
    const charName = modal.querySelector('#input-grant-char-name').value;
    const sourceId = modal.querySelector('#input-grant-source-id').value;
    const selectedSource = sourceOptions.find(s => s.id === sourceId) || sourceOptions[0];
    const limitNum = parseFloat(limitInput.value);
    const limitText = (!isNaN(limitNum) && limitNum > 0) ? `${selectedSource.currSymbol} ${limitNum.toFixed(2)} / 月` : '无限额度';

    const nowTimeStr = new Date().toTimeString().slice(0, 5);
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. 存入钱包亲密付授权列表
    if (!walletData.intimatePay) walletData.intimatePay = { userToChar: [], charToUser: [] };
    // 移除之前同名角色的授权
    walletData.intimatePay.userToChar = walletData.intimatePay.userToChar.filter(i => i.charName !== charName);
    walletData.intimatePay.userToChar.unshift({
      charName: charName,
      sourceId: selectedSource.id,
      sourceName: selectedSource.name,
      limitText: limitText,
      createTime: dateStr
    });
    saveWalletData(walletData);

    // 2. ✨ 在该 Char 的聊天室历史中注入【亲密付卡片消息】
    const chatStorageKey = `mini_chat_dialog_history_${encodeURIComponent(charName)}`;
    const charChatMsgs = JSON.parse(localStorage.getItem(chatStorageKey) || '[]');

    const intimateCardMessage = {
      role: 'user',
      cardType: 'intimate_pay', // 专属亲密付卡片类型
      content: `[亲密付开通凭据] 为你开通了专属亲密付`,
      targetChar: charName,
      sourceText: selectedSource.name,
      limitText: limitText,
      time: nowTimeStr,
      timestamp: Date.now()
    };

    charChatMsgs.push(intimateCardMessage);
    localStorage.setItem(chatStorageKey, JSON.stringify(charChatMsgs));

    showWalletToast(`已成功为【${charName}】开通亲密付并发送至聊天室！`);
    close();
    renderWalletView(container);
  };
}

// 专属卡内充值弹窗
function openDedicatedCardRechargeModal(card, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'wallet-modal-overlay active';
  modal.innerHTML = `
    <div class="wallet-modal-card" style="max-width:290px;">
      <div class="wallet-modal-header">
        <div style="display:flex; flex-direction:column; gap:1px;">
          <span class="wallet-modal-title">卡内充值 / DEPOSIT</span>
          <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">FIXED CURRENCY · ${card.currency}</span>
        </div>
        <button class="wallet-modal-close" id="btn-close-card-recharge">×</button>
      </div>

      <div class="wallet-form-pane">
        <div class="wallet-form-group">
          <label class="wallet-form-label">目标银行卡 / CARD</label>
          <div style="background:#FAFAFA; border:1px solid #EAEAEA; border-radius:6px; padding:7px 10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:10.5px; font-weight:800; color:#111;">随便银行 (尾号 ${card.cardNo.slice(-4)})</span>
            <span class="bank-currency-tag" style="background:#111; color:#FFF;">${card.currency}</span>
          </div>
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">存入金额 (${card.currency}) - 币种已锁定</label>
          <div class="ins-amount-input-box">
            <span class="ins-amount-curr-prefix">${card.currencySymbol || card.currency}</span>
            <input type="number" class="wallet-input ins-amount-num-input" id="input-card-recharge-amount" placeholder="0.00" autofocus />
          </div>
        </div>

        <button class="wallet-btn primary-btn" id="btn-confirm-card-recharge" style="width:100%; margin-top:4px; padding:9px 0;">确认存入</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-card-recharge').onclick = close;

  modal.querySelector('#btn-confirm-card-recharge').onclick = () => {
    const val = parseFloat(modal.querySelector('#input-card-recharge-amount').value);
    if (isNaN(val) || val <= 0) {
      showWalletToast('请输入有效的充值金额');
      return;
    }
    onConfirm(val);
    close();
  };
}

// 微信级账单凭据详情弹窗
function openBillDetailReceiptModal(bill, onDelete) {
  const cat = categorizeBill(bill);
  const isIncome = bill.type === 'income';
  const txid = bill.id.replace('bill-', 'TX') + Math.floor(1000 + Math.random() * 9000);

  const modal = document.createElement('div');
  modal.className = 'wallet-modal-overlay active';

  modal.innerHTML = `
    <div class="wallet-modal-card receipt-modal-card">
      <div class="receipt-header-row">
        <span class="receipt-sub-tag">TRANSACTION RECEIPT</span>
        <button class="wallet-modal-close" id="btn-close-receipt">×</button>
      </div>

      <div class="receipt-hero-section">
        <div class="receipt-hero-icon ${bill.type}">
          ${isIncome ? `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          ` : `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          `}
        </div>
        <span class="receipt-title-text">${escapeHtml(bill.title)}</span>
        <div class="receipt-amount-display ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '-'}${parseFloat(bill.amount).toFixed(2)} <span class="receipt-curr-label">${bill.currency || 'CNY'}</span>
        </div>
        <span class="receipt-status-badge">${isIncome ? '交易成功 · 已入账' : '支付成功 · 已扣款'}</span>
      </div>

      <div class="receipt-details-list">
        <div class="receipt-detail-item">
          <span class="detail-label">交易类型</span>
          <span class="detail-val">${cat.name} (${bill.typeText || (isIncome ? '入账' : '支出')})</span>
        </div>
        <div class="receipt-detail-item">
          <span class="detail-label">付款方式</span>
          <span class="detail-val">${escapeHtml(bill.payer || '随便银行储蓄卡 / 钱包余额')}</span>
        </div>
        <div class="receipt-detail-item">
          <span class="detail-label">收款方 / 目标</span>
          <span class="detail-val">${escapeHtml(bill.recipient || '随便系统内部清算')}</span>
        </div>
        <div class="receipt-detail-item">
          <span class="detail-label">交易时间</span>
          <span class="detail-val">${bill.time}</span>
        </div>
        <div class="receipt-detail-item">
          <span class="detail-label">交易单号</span>
          <span class="detail-val mono">${txid}</span>
        </div>
        <div class="receipt-detail-item">
          <span class="detail-label">记账机构</span>
          <span class="detail-val">随便银行 (SUIBIAN BANK OS)</span>
        </div>
      </div>

      <div class="receipt-action-row">
        <button class="receipt-del-btn" id="btn-delete-single-bill">删除此笔记录</button>
        <button class="wallet-btn primary-btn" id="btn-confirm-receipt-close" style="flex:2; padding:8px 0; font-size:11px;">完成</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-receipt').onclick = close;
  modal.querySelector('#btn-confirm-receipt-close').onclick = close;

  modal.querySelector('#btn-delete-single-bill').onclick = () => {
    onDelete(bill);
    close();
  };
}

// 卡片式多币种汇率充提弹窗
function openFxCardModal(mode, currentWalletCurr, cards, onConfirm) {
  const isRecharge = mode === 'recharge';
  const modalTitle = isRecharge ? `充值 ${currentWalletCurr} 到钱包` : `提现 ${currentWalletCurr} 到银行卡`;

  let selectedCardId = cards[0]?.id || '';

  const modal = document.createElement('div');
  modal.className = 'wallet-modal-overlay active';

  const renderCardSelectorHtml = () => {
    return cards.map((c) => {
      const isSelected = c.id === selectedCardId;
      const isFx = c.currency !== currentWalletCurr;
      return `
        <div class="ins-select-card-item ${isSelected ? 'selected' : ''}" data-cid="${c.id}">
          <div class="ins-card-item-left">
            <div class="ins-card-item-radio">
              <span class="ins-radio-dot"></span>
            </div>
            <div class="ins-card-item-meta">
              <div class="ins-card-item-title-row">
                <span class="ins-card-item-title">随便银行 · 尾号 ${c.cardNo.slice(-4)}</span>
                <span class="ins-card-item-curr-chip ${isFx ? 'fx-chip' : ''}">${c.currency}</span>
              </div>
              <span class="ins-card-item-sub">持卡人: ${escapeHtml(c.boundUserName || '用户')}</span>
            </div>
          </div>
          <div class="ins-card-item-right">
            <span class="ins-card-balance-num">${c.currencySymbol || '¥'} ${(c.balance || 0).toFixed(2)}</span>
            <span class="ins-card-balance-lbl">可用余额</span>
          </div>
        </div>
      `;
    }).join('');
  };

  modal.innerHTML = `
    <div class="wallet-modal-card fx-modal-card">
      <div class="wallet-modal-header">
        <div style="display:flex; flex-direction:column; gap:1px;">
          <span class="wallet-modal-title">${modalTitle}</span>
          <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">SECURE TRANSACTION</span>
        </div>
        <button class="wallet-modal-close" id="btn-close-fx-modal">×</button>
      </div>

      <div class="wallet-form-pane">
        <div class="wallet-form-group">
          <label class="wallet-form-label">选择结算银行卡 / SELECT CARD</label>
          <div class="ins-card-selector-list" id="ins-card-selector-container">
            ${renderCardSelectorHtml()}
          </div>
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">${isRecharge ? '充入钱包金额' : '提现钱包金额'} (${currentWalletCurr})</label>
          <div class="ins-amount-input-box">
            <span class="ins-amount-curr-prefix">${currentWalletCurr}</span>
            <input type="number" class="wallet-input ins-amount-num-input" id="input-fx-amount" placeholder="0.00" autofocus />
          </div>
        </div>

        <div class="ins-fx-calculation-box" id="ins-fx-calc-box">
          <div class="ins-fx-calc-row">
            <span class="ins-fx-calc-label">${isRecharge ? '预计从该卡扣除:' : '预计卡内实际到账:'}</span>
            <span class="ins-fx-calc-value" id="ins-fx-deduct-val">0.00</span>
          </div>
          <div class="ins-fx-rate-hint" id="ins-fx-rate-hint">汇率计算已就绪 (1:1 同币种结算)</div>
        </div>

        <button class="wallet-btn primary-btn" id="btn-submit-fx-action" style="width:100%; padding:10px 0; font-size:11px; margin-top:2px;">确认${isRecharge ? '充值' : '提现'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-fx-modal').onclick = close;

  const cardListContainer = modal.querySelector('#ins-card-selector-container');
  const amountInput = modal.querySelector('#input-fx-amount');
  const deductValEl = modal.querySelector('#ins-fx-deduct-val');
  const rateHintEl = modal.querySelector('#ins-fx-rate-hint');

  const updateFxPreview = () => {
    const amountVal = parseFloat(amountInput.value) || 0;
    const currentCard = cards.find(c => c.id === selectedCardId) || cards[0];
    if (!currentCard) return;

    if (isRecharge) {
      const deductInCardCurrency = convertCurrency(amountVal, currentWalletCurr, currentCard.currency);
      deductValEl.textContent = `${currentCard.currencySymbol || ''} ${deductInCardCurrency.toFixed(2)} ${currentCard.currency}`;

      if (currentCard.currency === currentWalletCurr) {
        rateHintEl.textContent = `同币种直充结算 (1 ${currentWalletCurr} = 1 ${currentCard.currency})`;
      } else {
        const unitRate = convertCurrency(1, currentWalletCurr, currentCard.currency);
        rateHintEl.textContent = `当前汇率：1 ${currentWalletCurr} ≈ ${unitRate.toFixed(4)} ${currentCard.currency}`;
      }
    } else {
      const depositInCardCurrency = convertCurrency(amountVal, currentWalletCurr, currentCard.currency);
      deductValEl.textContent = `${currentCard.currencySymbol || ''} ${depositInCardCurrency.toFixed(2)} ${currentCard.currency}`;

      if (currentCard.currency === currentWalletCurr) {
        rateHintEl.textContent = `同币种直提结算 (1 ${currentWalletCurr} = 1 ${currentCard.currency})`;
      } else {
        const unitRate = convertCurrency(1, currentWalletCurr, currentCard.currency);
        rateHintEl.textContent = `当前汇率：1 ${currentWalletCurr} ≈ ${unitRate.toFixed(4)} ${currentCard.currency}`;
      }
    }
  };

  const bindCardItemsClick = () => {
    modal.querySelectorAll('.ins-select-card-item').forEach(item => {
      item.onclick = () => {
        selectedCardId = item.getAttribute('data-cid');
        cardListContainer.innerHTML = renderCardSelectorHtml();
        bindCardItemsClick();
        updateFxPreview();
      };
    });
  };
  bindCardItemsClick();

  amountInput.oninput = updateFxPreview;
  updateFxPreview();

  modal.querySelector('#btn-submit-fx-action').onclick = () => {
    const amountVal = parseFloat(amountInput.value);
    if (isNaN(amountVal) || amountVal <= 0) {
      showWalletToast('请输入有效的金额');
      return;
    }

    const currentCard = cards.find(c => c.id === selectedCardId) || cards[0];
    if (!currentCard) return;

    if (isRecharge) {
      const deductInCardCurrency = convertCurrency(amountVal, currentWalletCurr, currentCard.currency);
      onConfirm(currentCard, amountVal, deductInCardCurrency);
    } else {
      const depositInCardCurrency = convertCurrency(amountVal, currentWalletCurr, currentCard.currency);
      onConfirm(currentCard, amountVal, depositInCardCurrency);
    }
    close();
  };
}

// 激活银行卡弹窗
function openAddCardModal(container) {
  const walletData = getWalletData();
  const userList = JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');
  const activeUserName = localStorage.getItem('mini_current_active_user') || (userList[0]?.name || '用户');
  const fixedPhone = walletData.phone || '';

  const modal = document.createElement('div');
  modal.className = 'wallet-modal-overlay active';
  modal.innerHTML = `
    <div class="wallet-modal-card">
      <div class="wallet-modal-header">
        <span class="wallet-modal-title">激活随便银行卡 / ACTIVATE</span>
        <button class="wallet-modal-close" id="btn-close-card-modal">×</button>
      </div>

      <div class="wallet-form-pane">
        <div class="wallet-form-group">
          <label class="wallet-form-label">持卡用户画像 / USER</label>
          <select class="wallet-select" id="input-card-user">
            ${userList.length === 0 ? `<option value="${escapeHtml(activeUserName)}">${escapeHtml(activeUserName)}</option>` : userList.map(u => `
              <option value="${escapeHtml(u.name)}" ${u.name === activeUserName ? 'selected' : ''}>${escapeHtml(u.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">预留手机号 / PHONE ${fixedPhone ? '(已锁定)' : ''}</label>
          <input type="tel" class="wallet-input" id="input-card-phone" value="${fixedPhone}" placeholder="输入 11 位手机号码" ${fixedPhone ? 'readonly style="background:#F5F5F5;"' : ''} />
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">短信验证码 / SMS CODE</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="wallet-input" id="input-card-code" placeholder="6 位验证码" maxlength="6" style="flex:1;" />
            <button class="wallet-btn secondary-btn" id="btn-send-sms-code" style="padding:0 10px; font-size:10px; white-space:nowrap;">获取验证码</button>
          </div>
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">卡片主货币 / CURRENCY</label>
          <select class="wallet-select" id="input-card-currency">
            ${CURRENCIES.map(c => `<option value="${c.code}" data-symbol="${c.symbol}">${c.full}</option>`).join('')}
          </select>
        </div>

        <div class="wallet-form-group">
          <label class="wallet-form-label">基础初始储存金额 (指定货币)</label>
          <input type="number" class="wallet-input" id="input-card-init-balance" value="5000" placeholder="0.00" style="font-weight:800;" />
        </div>

        <button class="wallet-btn primary-btn" id="btn-submit-activate-card" style="width:100%; margin-top:6px; padding:10px 0;">激活并开户</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let generatedCode = '';
  const close = () => modal.remove();
  modal.querySelector('#btn-close-card-modal').onclick = close;

  const sendCodeBtn = modal.querySelector('#btn-send-sms-code');
  const phoneInput = modal.querySelector('#input-card-phone');
  const userInput = modal.querySelector('#input-card-user');

  sendCodeBtn.onclick = () => {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 11) {
      showWalletToast('请输入正确的 11 位预留手机号');
      return;
    }

    generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const smsContent = `【随便银行】验证码：${generatedCode}，您正在绑定验证随便银行卡（若非本人操作，请删除本短信）。`;

    const codeInput = modal.querySelector('#input-card-code');
    sendSystemSms('随便银行', smsContent, (receivedCode) => {
      if (codeInput) {
        codeInput.value = receivedCode;
        showWalletToast(`已自动填入验证码: ${receivedCode}`);
      }
    });

    showWalletToast('验证码短信已发送');

    let countdown = 60;
    sendCodeBtn.disabled = true;
    const timer = setInterval(() => {
      countdown--;
      sendCodeBtn.textContent = `${countdown}s 后重发`;
      if (countdown <= 0) {
        clearInterval(timer);
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '获取验证码';
      }
    }, 1000);
  };

  modal.querySelector('#btn-submit-activate-card').onclick = () => {
    const phone = phoneInput.value.trim();
    const code = modal.querySelector('#input-card-code').value.trim();
    const selectedUser = userInput.value;
    const currSelect = modal.querySelector('#input-card-currency');
    const selectedCurr = currSelect.value;
    const currObj = CURRENCIES.find(c => c.code === selectedCurr) || CURRENCIES[0];
    const initBalance = parseFloat(modal.querySelector('#input-card-init-balance').value) || 0;

    if (!phone || phone.length < 11) {
      showWalletToast('手机号格式不正确');
      return;
    }
    if (!generatedCode || code !== generatedCode) {
      showWalletToast('验证码不正确或未获取！');
      return;
    }

    const randomCardNo = '622202' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
    if (!walletData.phone) walletData.phone = phone;

    const newCard = {
      id: `card-${Date.now()}`,
      cardNo: randomCardNo,
      phone: phone,
      boundUserName: selectedUser,
      currency: currObj.code,
      currencySymbol: currObj.symbol,
      balance: initBalance,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    walletData.cards.push(newCard);
    saveWalletData(walletData);

    sendSystemSms('随便银行', `【随便银行】您尾号 ${randomCardNo.slice(-4)} 的储蓄卡已成功激活开户！初始可用余额为：${initBalance.toFixed(2)} ${currObj.code}。感谢您选择随便银行。`);

    showWalletToast('银行卡开户激活成功！');
    close();
    renderWalletView(container);
  };
}

function showWalletToast(text) {
  const toast = document.createElement('div');
  toast.className = 'wallet-ins-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ════════════════════ ✨ Char 亲密付联动核心执行引擎 ════════════════════

/**
 * 1. 当 Char 消费 User 的亲密付时触发
 */
export function executeCharIntimateSpend(charName, amount, itemDesc = '日常消费') {
  const walletData = getWalletData();
  const intimateList = walletData.intimatePay?.userToChar || [];
  const intimateSetting = intimateList.find(i => i.charName === charName);

  if (!intimateSetting) return false;

  const spendAmt = parseFloat(amount) || 0;
  if (spendAmt <= 0) return false;

  const nowTime = new Date().toISOString().slice(0, 16).replace('T', ' ');
  let currency = 'CNY';
  let smsDetail = '';

  // 判断扣款源
  if (intimateSetting.sourceId && intimateSetting.sourceId.startsWith('card_')) {
    const cardId = intimateSetting.sourceId.replace('card_', '');
    const card = walletData.cards.find(c => c.id === cardId);
    if (card) {
      currency = card.currency || 'CNY';
      card.balance = Math.max(0, (card.balance || 0) - spendAmt);
      smsDetail = `您尾号 ${card.cardNo.slice(-4)} 的银行卡发生亲密付代扣支出 ${spendAmt.toFixed(2)} ${currency}，交易对象：${charName}（用途：${itemDesc}），当前卡内剩余可用余额为：${card.balance.toFixed(2)} ${currency}。`;
      
      // 触发真实银行短信与 iOS 顶部横幅
      sendSystemSms('随便银行', `【随便银行】${smsDetail}`);
    }
  } else {
    // 余额扣款
    const currCode = intimateSetting.sourceId ? intimateSetting.sourceId.replace('balance_', '') : 'CNY';
    currency = currCode;
    if (!walletData.balances) walletData.balances = {};
    walletData.balances[currCode] = Math.max(0, (walletData.balances[currCode] || 0) - spendAmt);
  }

  // 写入 User 账单明细
  walletData.bills.unshift({
    id: `bill-${Date.now()}`,
    title: `${charName} 亲密付代付 (${itemDesc})`,
    type: 'expense',
    typeText: '亲密付代扣',
    currency: currency,
    amount: spendAmt,
    payer: intimateSetting.sourceName || '我的钱包/银行卡',
    recipient: `${charName} (亲密付消费)`,
    time: nowTime
  });

  saveWalletData(walletData);
  return true;
}

/**
 * 2. 当 Char 主动向 User 赠送亲密付时触发
 */
export function executeCharGrantIntimatePay(charName, limitText = '无限额度', remark = '') {
  const walletData = getWalletData();
  if (!walletData.intimatePay) {
    walletData.intimatePay = { userToChar: [], charToUser: [] };
  }

  // 移除旧的同角色授权
  walletData.intimatePay.charToUser = walletData.intimatePay.charToUser.filter(i => i.charName !== charName);
  walletData.intimatePay.charToUser.unshift({
    charName: charName,
    sourceName: `${charName} 的专属主账户`,
    limitText: limitText || '无限额度',
    remark: remark,
    createTime: new Date().toISOString().slice(0, 10)
  });

  saveWalletData(walletData);

  // 发送开卡通知短信
  sendSystemSms('随便银行', `【随便银行】角色【${charName}】已为您开通专属亲密付（额度：${limitText}）！您在后续通讯与消费中可直接由对方专属账户代付。`);
  return true;
}

/**
 * 3. 当 Char 拒收转账时：资金原路全额退还给 User
 */
export function executeTransferRefund(charName, amount, currency = 'CNY', paySource = '') {
  const walletData = getWalletData();
  const refundAmt = parseFloat(amount) || 0;
  if (refundAmt <= 0) return false;

  const nowTime = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (paySource && paySource.includes('银行卡')) {
    // 提取卡号并退还到卡
    const match = paySource.match(/尾号\s*([0-9]{4})/);
    const last4 = match ? match[1] : '';
    const card = walletData.cards.find(c => c.cardNo.endsWith(last4)) || walletData.cards[0];
    if (card) {
      card.balance = (card.balance || 0) + refundAmt;
      sendSystemSms('随便银行', `【随便银行】您向【${charName}】发起的 ${refundAmt.toFixed(2)} ${currency} 转账已被对方拒收退回。资金已全额原路退回至您尾号 ${card.cardNo.slice(-4)} 的卡中，当前卡内余额为：${card.balance.toFixed(2)} ${card.currency}。`);
    }
  } else if (!paySource.includes('亲密付')) {
    // 退还到钱包余额
    if (!walletData.balances) walletData.balances = {};
    walletData.balances[currency] = (walletData.balances[currency] || 0) + refundAmt;
  }

  // 记录退款账单流水
  walletData.bills.unshift({
    id: `bill-${Date.now()}`,
    title: `转账退款 (${charName} 已拒收)`,
    type: 'income',
    typeText: '转账退回',
    currency: currency,
    amount: refundAmt,
    payer: `${charName} (拒收退回)`,
    recipient: paySource || '原支付账户',
    time: nowTime
  });

  saveWalletData(walletData);
  return true;
}

/**
 * 4. 当 Char 拒收亲密付时：撤销该授权
 */
export function executeIntimatePayDecline(charName) {
  const walletData = getWalletData();
  if (walletData.intimatePay?.userToChar) {
    walletData.intimatePay.userToChar = walletData.intimatePay.userToChar.filter(i => i.charName !== charName);
    saveWalletData(walletData);
  }
  return true;
}
