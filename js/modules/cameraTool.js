/**
 * MINI PHONE OS · 相机工具核心模块 (Camera Tool Engine)
 * 模式1: 真实相机拍照 (Real Camera Capture)
 * 模式2: 文字模拟照片发送 (INS 极简胶片/拍立得卡片)
 */

export const CameraTool = {
  activeTab: 'real_camera', // 'real_camera' | 'text_sim_photo'

  openCameraModal(charInfo, onSendPhoto) {
    const existing = document.getElementById('ins-camera-tool-modal');
    if (existing) existing.remove();

    this.activeTab = 'real_camera';

    const modal = document.createElement('div');
    modal.className = 'ins-modal-overlay active';
    modal.id = 'ins-camera-tool-modal';
    modal.style.zIndex = '85';

    modal.innerHTML = `
      <div class="ins-modal-card camera-tool-card" style="max-width: 330px; gap: 10px;">
        <div class="ins-modal-header">
          <span class="ins-modal-title">相机拍照 / CAMERA</span>
          <button class="ins-modal-close" id="btn-close-camera-modal">×</button>
        </div>

        <!-- 双板块切换栏 -->
        <div class="ins-vault-scope-bar" style="margin-bottom: 2px;">
          <button class="ins-scope-btn active" data-cmode="real_camera">实时拍照</button>
          <button class="ins-scope-btn" data-cmode="text_sim_photo">文字模拟图片</button>
        </div>

        <div id="camera-tool-tab-content">
          ${this.renderTabContent(charInfo)}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bindModalEvents(modal, charInfo, onSendPhoto);
  },

  renderTabContent(charInfo) {
    if (this.activeTab === 'real_camera') {
      return `
        <div class="camera-tab-pane" style="text-align:center;">
          <p class="ins-card-desc" style="text-align:left;">唤起手机摄像头实时拍摄照片，发送后【${charInfo.name}】将进行真实感知与互动。</p>
          <div class="camera-lens-stage" style="padding: 18px 0;">
            <button class="camera-shutter-btn" id="btn-trigger-device-camera">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <span style="font-size:10px; color:#888; display:block; margin-top:8px;">点击开启镜头拍照</span>
            <input type="file" id="native-camera-capture-input" accept="image/*" capture="environment" style="display:none;" />
          </div>
        </div>
      `;
    } else {
      return `
        <div class="camera-tab-pane">
          <p class="ins-card-desc">描述你当前拍下的画面，将生成【INS 拍立得胶片卡片】，在【${charInfo.name}】认知中为你拍下的真实照片。</p>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:8.5px; font-weight:800; color:#888;">照片场景/画面描述：</label>
            <textarea class="ins-modal-textarea" id="input-sim-photo-desc" placeholder="例如：街角便利店冒着热气的关东煮和一杯热拿铁、窗外的落日晚霞..." rows="3"></textarea>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            <span style="font-size:9px; color:#888;">呈现：<strong style="color:#111;">INS 拍立得卡片</strong></span>
            <button class="ins-modal-btn confirm" id="btn-send-sim-photo" style="padding: 6px 16px;">发送模拟照片</button>
          </div>
        </div>
      `;
    }
  },

  bindModalEvents(modal, charInfo, onSendPhoto) {
    const close = () => modal.remove();
    modal.querySelector('#btn-close-camera-modal').onclick = close;

    modal.querySelectorAll('[data-cmode]').forEach(btn => {
      btn.onclick = () => {
        this.activeTab = btn.getAttribute('data-cmode');
        modal.querySelector('#camera-tool-tab-content').innerHTML = this.renderTabContent(charInfo);
        modal.querySelectorAll('[data-cmode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.bindTabEvents(modal, charInfo, onSendPhoto, close);
      };
    });

    this.bindTabEvents(modal, charInfo, onSendPhoto, close);
  },

  bindTabEvents(modal, charInfo, onSendPhoto, closeCallback) {
    // 模式 1：真实相机拍照
    const shutterBtn = modal.querySelector('#btn-trigger-device-camera');
    const captureInput = modal.querySelector('#native-camera-capture-input');

    if (shutterBtn && captureInput) {
      shutterBtn.onclick = () => {
        captureInput.value = '';
        captureInput.click();
      };

      captureInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          onSendPhoto({
            cardType: 'image',
            mediaUrl: evt.target.result,
            content: '[照片]'
          });
          closeCallback();
        };
        reader.readAsDataURL(file);
      };
    }

    // 模式 2：文字模拟照片
    const simPhotoDesc = modal.querySelector('#input-sim-photo-desc');
    const sendSimPhotoBtn = modal.querySelector('#btn-send-sim-photo');

    if (simPhotoDesc && sendSimPhotoBtn) {
      sendSimPhotoBtn.onclick = () => {
        const descText = simPhotoDesc.value.trim();
        if (!descText) {
          alert('请输入要拍摄的照片画面描述！');
          return;
        }
        onSendPhoto({
          cardType: 'sim_photo',
          photoDesc: descText,
          content: descText,
          isTextVisible: false
        });
        closeCallback();
      };
    }
  }
};
