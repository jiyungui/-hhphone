/**
 * MINI PHONE OS · 语音工具核心模块 (Voice Tool Engine)
 * 双模极简版：① 手打模拟语音条 | ② 语音转文字 (STT)
 */

let currentPlayingAudio = null;

export const VoiceTool = {
  activeTab: 'text_sim', // 'text_sim' | 'stt'

  /**
   * 打开双模语音悬浮面板
   */
  openVoiceModal(charInfo, onSendVoice) {
    const existing = document.getElementById('ins-voice-tool-modal');
    if (existing) existing.remove();

    this.activeTab = 'text_sim';

    const modal = document.createElement('div');
    modal.className = 'ins-modal-overlay active';
    modal.id = 'ins-voice-tool-modal';
    modal.style.zIndex = '85';

    modal.innerHTML = `
      <div class="ins-modal-card voice-tool-card" style="max-width: 320px; gap: 10px;">
        <div class="ins-modal-header">
          <span class="ins-modal-title">发送语音 / VOICE MESSAGE</span>
          <button class="ins-modal-close" id="btn-close-voice-modal">×</button>
        </div>

        <!-- 双模式切换栏 (去除原声录音) -->
        <div class="ins-vault-scope-bar" style="margin-bottom: 2px;">
          <button class="ins-scope-btn active" data-vmode="text_sim">手打模拟</button>
          <button class="ins-scope-btn" data-vmode="stt">语音转文字</button>
        </div>

        <div id="voice-tool-tab-content">
          ${this.renderTabContent(charInfo)}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bindModalEvents(modal, charInfo, onSendVoice);
  },

  renderTabContent(charInfo) {
    if (this.activeTab === 'text_sim') {
      return `
        <div class="voice-tab-pane">
          <p class="ins-card-desc">输入文字，发出的消息将呈现为【语音条】，在【${charInfo.name}】认知中为你发送的语音。</p>
          <textarea class="ins-modal-textarea" id="input-voice-sim-text" placeholder="输入要发送的语音内容..." rows="3"></textarea>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <span style="font-size:9px; color:#888;">预估时长：<strong id="label-sim-duration" style="color:#111;">3"</strong></span>
            <button class="ins-modal-btn confirm" id="btn-send-sim-voice" style="padding: 6px 16px;">发送语音条</button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="voice-tab-pane" style="text-align:center;">
          <p class="ins-card-desc" style="text-align:left;">点击麦克风说中文，自动转为文字并打包为语音条发送。</p>
          <div class="voice-stt-stage">
            <button class="voice-record-circle-btn" id="btn-start-stt-record">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
            </button>
            <span class="voice-record-hint" id="stt-status-label">点击麦克风开始说话</span>
          </div>
          <textarea class="ins-modal-textarea" id="stt-result-text" placeholder="实时识别文字将显示在此处..." rows="2" style="margin-top:6px; font-size:10px;"></textarea>
          <div class="ins-modal-actions" style="margin-top:6px;">
            <button class="ins-modal-btn confirm" id="btn-send-stt-voice">发送语音条</button>
          </div>
        </div>
      `;
    }
  },

  bindModalEvents(modal, charInfo, onSendVoice) {
    const close = () => modal.remove();
    modal.querySelector('#btn-close-voice-modal').onclick = close;

    modal.querySelectorAll('[data-vmode]').forEach(btn => {
      btn.onclick = () => {
        this.activeTab = btn.getAttribute('data-vmode');
        modal.querySelector('#voice-tool-tab-content').innerHTML = this.renderTabContent(charInfo);
        modal.querySelectorAll('[data-vmode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.bindTabPaneEvents(modal, charInfo, onSendVoice, close);
      };
    });

    this.bindTabPaneEvents(modal, charInfo, onSendVoice, close);
  },

  bindTabPaneEvents(modal, charInfo, onSendVoice, closeCallback) {
    // 模式 1：手打模拟
    const simInput = modal.querySelector('#input-voice-sim-text');
    const simLabel = modal.querySelector('#label-sim-duration');
    const sendSimBtn = modal.querySelector('#btn-send-sim-voice');

    if (simInput && sendSimBtn) {
      simInput.oninput = () => {
        const len = simInput.value.trim().length;
        const dur = Math.max(1, Math.min(60, Math.ceil(len / 3.2)));
        if (simLabel) simLabel.textContent = `${dur}"`;
      };

      sendSimBtn.onclick = () => {
        const text = simInput.value.trim();
        if (!text) { alert('请输入语音内容！'); return; }
        const dur = Math.max(1, Math.min(60, Math.ceil(text.length / 3.2)));
        onSendVoice({
          cardType: 'voice',
          voiceMode: 'simulated',
          content: text,
          durationSeconds: dur,
          isTextVisible: false
        });
        closeCallback();
      };
    }

    // 模式 2：语音转文字 (直接用中文识别，无需强转外语)
    const sttBtn = modal.querySelector('#btn-start-stt-record');
    const sttResult = modal.querySelector('#stt-result-text');
    const sttLabel = modal.querySelector('#stt-status-label');
    const sendSttBtn = modal.querySelector('#btn-send-stt-voice');

    if (sttBtn && sendSttBtn) {
      let recognition = null;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      sttBtn.onclick = () => {
        if (!SpeechRecognition) {
          alert('当前浏览器环境暂不支持原生语音识别，请直接使用【手打模拟】发送语音条！');
          return;
        }
        if (!recognition) {
          recognition = new SpeechRecognition();
          recognition.lang = 'zh-CN'; // ✨ 固定为中文识别，不强转角色卡语言
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onstart = () => {
            sttBtn.classList.add('recording');
            if (sttLabel) sttLabel.textContent = '正在倾听中，请说话...';
          };

          recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            if (sttResult) sttResult.value = transcript;
          };

          recognition.onend = () => {
            sttBtn.classList.remove('recording');
            if (sttLabel) sttLabel.textContent = '识别完毕，可点击发送';
          };
        }
        recognition.start();
      };

      sendSttBtn.onclick = () => {
        const text = (sttResult.value || '').trim();
        if (!text) { alert('尚未识别到文字内容！'); return; }
        const dur = Math.max(1, Math.min(60, Math.ceil(text.length / 3.2)));
        onSendVoice({
          cardType: 'voice',
          voiceMode: 'stt',
          content: text,
          durationSeconds: dur,
          isTextVisible: false
        });
        closeCallback();
      };
    }
  },

  /**
   * 播放语音条音频（User 仅展文不发声，Char 发声优先继承全局配置）
   */
  playVoiceBarAudio(msg, charInfo, onPlayEnd) {
    if (currentPlayingAudio) {
      currentPlayingAudio.pause();
      currentPlayingAudio = null;
      if (onPlayEnd) onPlayEnd();
      return;
    }

    // 1. 如果是 User 自己的语音条，纯文字展示，绝不机械朗读
    if (msg.role === 'user') {
      if (onPlayEnd) onPlayEnd();
      return;
    }

    // 2. 如果是 Char 的语音条：调用浏览器合成或配置好的 TTS
    const isCharVoiceOn = charInfo.voiceEnabled !== false;
    if (!isCharVoiceOn) {
      if (onPlayEnd) onPlayEnd();
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(msg.content);
      if (charInfo.targetLang === '日语') utter.lang = 'ja-JP';
      else if (charInfo.targetLang === '英语') utter.lang = 'en-US';
      else utter.lang = 'zh-CN';

      utter.onend = () => { if (onPlayEnd) onPlayEnd(); };
      utter.onerror = () => { if (onPlayEnd) onPlayEnd(); };
      window.speechSynthesis.speak(utter);
    } else {
      if (onPlayEnd) onPlayEnd();
    }
  }
};
