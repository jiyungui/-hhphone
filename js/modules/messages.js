// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 信息 (MESSAGES / SMS MODULE)
// iOS 极简白黑风格 · 独立模块
// ═══════════════════════════════════════════════════════════════

let activeThreadSender = null; // null 表示在列表页，有值表示在会话详情页

export function getSmsThreads() {
  return JSON.parse(localStorage.getItem('mini_sms_messages_store') || JSON.stringify([
    {
      sender: '随便银行',
      time: '09:41',
      messages: [
        {
          id: 'sms-init',
          role: 'incoming',
          content: '【随便银行】欢迎使用随便银行服务。预留手机号已接入快捷支付中心。',
          time: '09:41'
        }
      ]
    }
  ]));
}

export function saveSmsThreads(threads) {
  localStorage.setItem('mini_sms_messages_store', JSON.stringify(threads));
}

// 供外部调用发送短信（如银行卡验证码）
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
      messages: [newMsg]
    });
  }

  saveSmsThreads(threads);

  // ✨ 核心新增：立即弹出 iOS 风格顶部下弹短信横幅
  showIosSmsBanner(senderName, content, autoFillCallback);
}

// ✨ 顶部下弹 iOS 风格短信横幅（支持点击一键自动填入验证码）
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
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="ios-sms-app-name">信息 · ${escapeHtml(senderName)}</span>
      </div>
      <span class="ios-sms-time-now">现在</span>
    </div>
    <div class="ios-sms-banner-content">${escapeHtml(content)}</div>
    ${detectedCode ? `<div class="ios-sms-banner-action">点击此横幅一键填入验证码: <b>${detectedCode}</b></div>` : ''}
  `;

  document.body.appendChild(banner);

  // 触发入场动画
  setTimeout(() => banner.classList.add('active'), 20);

  const closeBanner = () => {
    banner.classList.remove('active');
    setTimeout(() => banner.remove(), 300);
  };

  // 点击横幅：自动填入验证码并收起
  banner.onclick = () => {
    if (autoFillCallback && detectedCode) {
      autoFillCallback(detectedCode);
    }
    closeBanner();
  };

  // 6 秒后自动收起
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

function renderThreadsList(container, threads) {
  container.innerHTML = `
    <div class="sms-container">
      <header class="sms-header">
        <span class="sms-title">信息</span>
        <span class="sms-count-chip">${threads.length} 条会话</span>
      </header>
      <main class="sms-list-view">
        ${threads.length === 0 ? `<div class="sms-empty">无信息</div>` : threads.map(t => {
          const lastMsg = t.messages[t.messages.length - 1]?.content || '';
          return `
            <div class="sms-thread-item" data-sender="${escapeHtml(t.sender)}">
              <div class="sms-avatar-circle">${t.sender.slice(0, 1)}</div>
              <div class="sms-thread-body">
                <div class="sms-thread-top">
                  <span class="sms-sender-name">${escapeHtml(t.sender)}</span>
                  <span class="sms-time-tag">${t.time}</span>
                </div>
                <div class="sms-preview-text">${escapeHtml(lastMsg)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </main>
    </div>
  `;

  container.querySelectorAll('.sms-thread-item').forEach(item => {
    item.onclick = () => {
      activeThreadSender = item.getAttribute('data-sender');
      renderMessagesView(container);
    };
  });
}

function renderThreadDetail(container, thread) {
  if (!thread) {
    activeThreadSender = null;
    renderMessagesView(container);
    return;
  }

  container.innerHTML = `
    <div class="sms-container">
      <header class="sms-detail-header">
        <button class="sms-back-btn" id="btn-sms-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sms-sender-meta">
          <div class="sms-mini-avatar">${thread.sender.slice(0, 1)}</div>
          <span class="sms-detail-name">${escapeHtml(thread.sender)}</span>
        </div>
        <div style="width:24px;"></div>
      </header>

      <main class="sms-bubble-scroll-area">
        <div class="sms-bubble-list">
          ${thread.messages.map(m => `
            <div class="sms-bubble-row ${m.role}">
              <div class="sms-bubble-card">
                <div class="sms-bubble-text">${escapeHtml(m.content)}</div>
                <div class="sms-bubble-time">${m.time}</div>
              </div>
            </div>
          `).join('')}
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
