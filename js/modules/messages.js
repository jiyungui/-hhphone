// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 信息 (MESSAGES / SMS MODULE)
// INS 白黑极简风格 · iOS 灵动排版 · 独立模块
// ═══════════════════════════════════════════════════════════════

let activeThreadSender = null; // null 表示在列表页，有值表示在会话详情页
let smsSearchKeyword = '';

export function getSmsThreads() {
  return JSON.parse(localStorage.getItem('mini_sms_messages_store') || JSON.stringify([
    {
      sender: '随便银行',
      time: '09:41',
      tag: 'OFFICIAL',
      messages: [
        {
          id: 'sms-init',
          role: 'incoming',
          content: '【随便银行】欢迎使用随便银行服务。预留手机号已接入快捷支付中心，所有账户动态将在此实时通知。',
          time: '09:41'
        }
      ]
    }
  ]));
}

export function saveSmsThreads(threads) {
  localStorage.setItem('mini_sms_messages_store', JSON.stringify(threads));
}

// 供外部调用发送短信（如银行卡验证码、转账通知、亲密付扣款）
export function sendSystemSms(senderName, content, autoFillCallback = null) {
  const threads = getSmsThreads();
  let thread = threads.find(t => t.sender === senderName);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const newMsg = {
    id: `sms-${Date.now()}`,
    role: 'incoming',
    content: content,
    time: nowTime
  };

  if (thread) {
    thread.time = nowTime;
    thread.messages.push(newMsg);
  } else {
    threads.unshift({
      sender: senderName,
      time: nowTime,
      tag: 'OFFICIAL',
      messages: [newMsg]
    });
  }

  saveSmsThreads(threads);

  // 立即弹出 iOS 风格顶部下弹短信横幅
  showIosSmsBanner(senderName, content, autoFillCallback);
}

// 顶部下弹 iOS 风格短信横幅（支持点击一键自动填入验证码）
export function showIosSmsBanner(senderName, content, autoFillCallback = null) {
  const oldBanner = document.getElementById('ios-sms-top-banner');
  if (oldBanner) oldBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'ios-sms-top-banner';
  banner.className = 'ios-sms-banner-container';

  // 提取可能的 6 位数字验证码用于提示
  const codeMatch = content.match(/验证码[：:]\s*([0-9]{4,6})/);
  const detectedCode = codeMatch ? codeMatch[1] : '';

  banner.innerHTML = `
    <div class="ios-sms-banner-header">
      <div class="ios-sms-banner-app">
        <span class="ios-sms-app-icon">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="ios-sms-app-name">${escapeHtml(senderName)}</span>
        <span class="ios-sms-verified-dot"></span>
      </div>
      <span class="ios-sms-time-now">刚刚</span>
    </div>
    <div class="ios-sms-banner-content">${escapeHtml(content)}</div>
    ${detectedCode ? `<div class="ios-sms-banner-action">点击此横幅一键填入验证码: <b>${detectedCode}</b></div>` : ''}
  `;

  document.body.appendChild(banner);

  setTimeout(() => banner.classList.add('active'), 20);

  const closeBanner = () => {
    banner.classList.remove('active');
    setTimeout(() => banner.remove(), 300);
  };

  banner.onclick = () => {
    if (autoFillCallback && detectedCode) {
      autoFillCallback(detectedCode);
    }
    closeBanner();
  };

  setTimeout(() => {
    if (document.body.contains(banner)) {
      closeBanner();
    }
  }, 6000);
}

// 渲染短信 App 根界面
export function renderMessagesView(container) {
  const threads = getSmsThreads();

  if (activeThreadSender) {
    const thread = threads.find(t => t.sender === activeThreadSender);
    renderThreadDetail(container, thread);
  } else {
    renderThreadsList(container, threads);
  }
}

// 1. 会话列表视图 (INS 白黑风极简卡片流)
function renderThreadsList(container, threads) {
  const filtered = threads.filter(t => {
    if (!smsSearchKeyword) return true;
    const lastMsg = t.messages[t.messages.length - 1]?.content || '';
    return t.sender.toLowerCase().includes(smsSearchKeyword.toLowerCase()) || lastMsg.toLowerCase().includes(smsSearchKeyword.toLowerCase());
  });

  container.innerHTML = `
    <div class="sms-container">
      <!-- 顶栏 -->
      <header class="sms-header">
        <div class="sms-header-left">
          <span class="sms-title">信息</span>
          <span class="sms-sub-tag">MESSAGES</span>
        </div>
        <div class="sms-count-badge">${threads.length} 条会话</div>
      </header>

      <!-- 极简白黑搜索栏 -->
      <div class="sms-search-wrap">
        <div class="sms-search-box">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="input-sms-search" placeholder="搜索短信内容或发件人..." value="${escapeHtml(smsSearchKeyword)}" />
        </div>
      </div>

      <!-- 会话流 -->
      <main class="sms-list-view">
        ${filtered.length === 0 ? `
          <div class="sms-empty-placeholder">
            <div class="sms-empty-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span class="sms-empty-title">暂无短信记录</span>
            <span class="sms-empty-desc">当有银行验证码、转账或亲密付变动时将在此送达</span>
          </div>
        ` : filtered.map(t => {
          const lastMsg = t.messages[t.messages.length - 1]?.content || '';
          return `
            <div class="sms-thread-card" data-sender="${escapeHtml(t.sender)}">
              <div class="sms-card-avatar">
                <span>${t.sender.slice(0, 1)}</span>
              </div>
              <div class="sms-card-body">
                <div class="sms-card-top-row">
                  <div class="sms-card-sender-group">
                    <span class="sms-sender-name">${escapeHtml(t.sender)}</span>
                    <span class="sms-verified-chip">官方通知</span>
                  </div>
                  <span class="sms-time-stamp">${t.time}</span>
                </div>
                <div class="sms-preview-snippet">${escapeHtml(lastMsg)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </main>
    </div>
  `;

  // 搜索监听
  const searchInput = container.querySelector('#input-sms-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      smsSearchKeyword = e.target.value.trim();
      renderThreadsList(container, threads);
    };
  }

  // 点击会话进入详情
  container.querySelectorAll('.sms-thread-card').forEach(item => {
    item.onclick = () => {
      activeThreadSender = item.getAttribute('data-sender');
      renderMessagesView(container);
    };
  });
}

// 2. 短信详情视图 (结构化卡片气泡)
function renderThreadDetail(container, thread) {
  if (!thread) {
    activeThreadSender = null;
    renderMessagesView(container);
    return;
  }

  container.innerHTML = `
    <div class="sms-container">
      <!-- 详情页顶栏 -->
      <header class="sms-detail-header">
        <button class="sms-back-btn" id="btn-sms-back" title="返回会话列表">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          <span>信息</span>
        </button>
        <div class="sms-sender-meta">
          <div class="sms-detail-avatar">${thread.sender.slice(0, 1)}</div>
          <div class="sms-detail-title-box">
            <span class="sms-detail-name">${escapeHtml(thread.sender)}</span>
            <span class="sms-detail-verified-tag">已通过系统安全校验</span>
          </div>
        </div>
        <div style="width: 48px;"></div>
      </header>

      <!-- 短信流 -->
      <main class="sms-bubble-scroll-area">
        <div class="sms-date-divider">
          <span>TODAY · 系统通知记录</span>
        </div>

        <div class="sms-bubble-list">
          ${thread.messages.map(m => {
            // 自动提取可能包含的验证码并高亮
            const codeMatch = m.content.match(/验证码[：:]\s*([0-9]{4,6})/);
            const detectedCode = codeMatch ? codeMatch[1] : '';

            return `
              <div class="sms-bubble-row ${m.role}">
                <div class="sms-bubble-card">
                  <div class="sms-bubble-card-header">
                    <span class="sms-bubble-sender-tag">${escapeHtml(thread.sender)}</span>
                    <span class="sms-bubble-time-top">${m.time}</span>
                  </div>
                  <div class="sms-bubble-text">${escapeHtml(m.content)}</div>
                  ${detectedCode ? `
                    <div class="sms-code-pill-highlight">
                      <span class="code-label">验证码</span>
                      <span class="code-number">${detectedCode}</span>
                    </div>
                  ` : ''}
                  <div class="sms-bubble-card-footer">
                    <span>安全验证通过</span>
                    <span>100% 官方端点</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </main>
    </div>
  `;

  container.querySelector('#btn-sms-back').onclick = () => {
    activeThreadSender = null;
    renderMessagesView(container);
  };
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
