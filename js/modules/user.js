import { worldLocations } from '../data/locationData.js';
import { McpGateway } from '../utils/mcpGateway.js';

let currentViewMode = 'list'; // 'list' | 'create' | 'edit'
let editingUserId = null;

// 读取完整的 User 身份列表
function getStoredUserPersonasFull() {
  return JSON.parse(localStorage.getItem('mini_user_personas_full') || '[]');
}

function saveStoredUserPersonasFull(list) {
  localStorage.setItem('mini_user_personas_full', JSON.stringify(list));
  // 保持同步更新简单的名字数组，供各模块联动
  const names = list.map(u => u.name);
  localStorage.setItem('mini_user_personas', JSON.stringify(names));
}

let userDraft = getNewUserDraft();

function getNewUserDraft() {
  return {
    id: `user-${Date.now()}`,
    avatarUrl: '',
    name: '',
    gender: '保密',
    birthDate: '2000-01-01',
    occupation: '',
    detailedInfo: '',
    catchphrase: '',
    likesAndDislikes: '',
    dressStyle: '',
    appearance: '',
    birthplace: '',
    residence: '',
    isPrimary: false
  };
}

/**
 * User 板块总入口渲染函数
 */
export function renderUserView(container) {
  if (currentViewMode === 'list') {
    renderUserListView(container);
  } else {
    renderUserFormView(container);
  }
}

/**
 * 1. User 身份列表视图
 */
function renderUserListView(container) {
  const userList = getStoredUserPersonasFull();
  const currentActiveName = localStorage.getItem('mini_current_active_user') || (userList[0]?.name || '');

  container.innerHTML = `
    <div class="user-container">
      <!-- 顶栏标题 -->
      <div class="user-header">
        <span class="user-header-title">User Personas</span>
        <span class="user-count-badge">${userList.length} PERSONAS</span>
      </div>

      <!-- 顶栏下方的加号新建栏 -->
      <div class="user-add-bar" id="btn-open-add-user" title="录入新 User 身份">
        <div class="user-add-bar-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <span class="user-add-bar-text">录入新 User 身份档案</span>
      </div>

          <!-- 紧凑型列表 -->
      <div class="user-grid-list" id="user-grid-list">
        ${userList.length === 0 ? `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 14px;
            background: #FAFAFA;
            border: 1.5px dashed var(--chat-ui-border, #111);
            border-radius: 12px;
            gap: 8px;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
            margin-top: 4px;
          ">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #FFF; border: 1.2px solid #111; display: flex; align-items: center; justify-content: center; color: #111;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span style="font-size: 12px; font-weight: 900; color: #111; letter-spacing: 0.5px;">NO USER PERSONAS YET</span>
            <span style="font-size: 8.5px; color: #888;">暂无身份画像，点击上方加号建立你的第一个身份画像</span>
          </div>
        ` : userList.map(u => {
          const isActive = u.name === currentActiveName;
          return `
            <div class="user-card-item ${isActive ? 'is-current-active' : ''}" data-id="${u.id}">
              <!-- 3:4 证件照 -->
              <div class="user-card-avatar-thumb">
                ${u.avatarUrl ? `<img src="${u.avatarUrl}" class="user-card-avatar-img" />` : `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                `}
              </div>

              <!-- 右侧信息区 -->
              <div class="user-card-info">
                <div class="user-card-top-row">
                  <div class="user-name-occ-wrap">
                    <span class="user-card-name">${u.name}</span>
                    ${u.occupation ? `<span class="user-card-occ">${u.occupation}</span>` : ''}
                  </div>
                  <div class="user-action-icons">
                    <button class="user-del-btn" data-edit-user="${u.id}" title="编辑资料">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="user-del-btn" data-del-user="${u.id}" title="删除身份">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                <div class="user-card-mid-row">
                  ${u.residence ? `<span class="user-chip">${u.residence}</span>` : ''}
                  ${isActive ? '<span class="user-chip active-tag">当前主身份</span>' : `<button class="user-chip" data-set-active="${u.name}" style="cursor:pointer;">设为激活</button>`}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 绑定事件
  const addBtn = container.querySelector('#btn-open-add-user');
  if (addBtn) {
    addBtn.onclick = () => {
      userDraft = getNewUserDraft();
      currentViewMode = 'create';
      editingUserId = null;
      renderUserView(container);
    };
  }

  container.querySelectorAll('[data-set-active]').forEach(btn => {
    btn.onclick = () => {
      const activeName = btn.getAttribute('data-set-active');
      localStorage.setItem('mini_current_active_user', activeName);
      renderUserListView(container);
    };
  });

  container.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.onclick = () => {
      const uId = btn.getAttribute('data-edit-user');
      const target = userList.find(u => u.id === uId);
      if (target) {
        userDraft = { ...target };
        currentViewMode = 'edit';
        editingUserId = uId;
        renderUserView(container);
      }
    };
  });

  container.querySelectorAll('[data-del-user]').forEach(btn => {
    btn.onclick = () => {
      const uId = btn.getAttribute('data-del-user');
      if (confirm('确定要删除该 User 身份吗？')) {
        const nextList = userList.filter(u => u.id !== uId);
        saveStoredUserPersonasFull(nextList);
        renderUserListView(container);
      }
    };
  });
}

/**
 * 2. 创建/编辑 User 身份内置表单视图
 */
function renderUserFormView(container) {
  container.innerHTML = `
    <div class="user-container">
      <!-- 顶部返回 -->
      <div class="user-form-header">
        <button class="user-form-back-btn" id="btn-back-user-list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          <span>${currentViewMode === 'edit' ? '编辑 User 身份资料' : '录入新 User 身份'}</span>
        </button>
      </div>

      <!-- 表单主体滚动区 -->
      <div class="user-form-scroll-view">
        
        <!-- 1. 证件照 + 基础信息 -->
        <div class="user-id-photo-row">
          <div class="id-photo-frame ${userDraft.avatarUrl ? 'has-image' : ''}" id="user-avatar-box" title="点击上传长方形证件照">
            ${userDraft.avatarUrl ? `
              <img src="${userDraft.avatarUrl}" class="id-photo-img" id="user-avatar-img" />
            ` : `
              <div class="id-photo-placeholder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="id-photo-lbl">3:4 证件照</span>
              </div>
            `}
            <input type="file" id="user-avatar-file-input" accept="image/*" style="display:none;" />
          </div>

          <div class="id-basic-info-col">
            <div class="form-group">
              <label class="form-label">身份姓名 (User Name)</label>
              <input type="text" class="form-input-sm" id="form-user-name" value="${userDraft.name}" placeholder="例如：真实自我 / 探索者" />
            </div>

            <div class="form-group">
              <label class="form-label">性别 (Gender)</label>
              <select class="form-input-sm" id="form-user-gender">
                <option value="女" ${userDraft.gender === '女' ? 'selected' : ''}>女 (Female)</option>
                <option value="男" ${userDraft.gender === '男' ? 'selected' : ''}>男 (Male)</option>
                <option value="保密" ${userDraft.gender === '保密' ? 'selected' : ''}>保密 (Secret)</option>
                <option value="自定义" ${userDraft.gender === '自定义' ? 'selected' : ''}>自定义</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">出生日期 (Birth Date)</label>
              <input type="date" class="form-input-sm" id="form-user-birth" value="${userDraft.birthDate}" />
            </div>

            <div class="form-group">
              <label class="form-label">职业 / 身份 (Occupation)</label>
              <input type="text" class="form-input-sm" id="form-user-occ" value="${userDraft.occupation}" placeholder="例如：架构师 / 学生" />
            </div>
          </div>
        </div>

        <!-- 2. 详细信息母本录入区 -->
        <div class="api-card">
          <div class="card-title">
            <span>详细个人画像与习惯 (Full Background Info)</span>
            <button class="extract-all-btn" id="btn-extract-user-all" title="调用 AI 从详细信息深度提取全部特征">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>一键全部提取 (AI 驱动)</span>
            </button>
          </div>
          <span class="card-desc">在此粘贴关于你的个人生活习惯、说话偏好、作息规律与雷点。点击各项目的「提取」键，AI 会精准提炼出清晰特征供角色心领神会。</span>
          <textarea class="full-detail-textarea" id="form-user-detailed-info" placeholder="在此粘贴你的个人详细信息...&#10;例如：&#10;平时说话直接简洁，不喜欢啰嗦。对大蒜过敏/极度厌恶蒜味，喜欢喝无糖乌龙茶。经常在深夜工作，习惯穿深色卫衣和舒适跑鞋。性格偏内向但注重承诺...">${userDraft.detailedInfo || ''}</textarea>
        </div>

        <!-- 3. 特征智能提炼区 -->
        <div class="api-card">
          <span class="card-title">User 特征提取与偏好锚点</span>

          <!-- A. 常用语调/口癖 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">说话习惯与常用语调提取</label>
              <button class="single-extract-btn" data-user-extract-target="catchphrase">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-user-catchphrase" style="min-height: 48px;" placeholder="点击提取或输入说话习惯...">${userDraft.catchphrase}</textarea>
          </div>

          <!-- B. 爱好兴趣雷点 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">个人喜好 · 习惯 · 厌恶与雷点提取</label>
              <button class="single-extract-btn" data-user-extract-target="likesAndDislikes">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-user-likes" style="min-height: 60px;" placeholder="点击提取或输入喜恶与雷点 (如不吃蒜)...">${userDraft.likesAndDislikes}</textarea>
          </div>

          <!-- C. 穿衣搭配风格 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">日常穿搭与服饰风格提取</label>
              <button class="single-extract-btn" data-user-extract-target="dressStyle">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-user-dress" style="min-height: 52px;" placeholder="点击提取或输入日常穿搭风格...">${userDraft.dressStyle}</textarea>
          </div>

          <!-- D. 外貌体态特征 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">外貌体态与形象细节提取</label>
              <button class="single-extract-btn" data-user-extract-target="appearance">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-user-appear" style="min-height: 60px;" placeholder="点击提取或输入形象细节...">${userDraft.appearance}</textarea>
          </div>
        </div>

        <!-- 4. 地理认知 -->
        <div class="api-card">
          <span class="card-title">地理位置信息</span>

          <div class="form-group">
            <label class="form-label">出生地 (Birthplace)</label>
            <button class="location-picker-btn" id="btn-user-pick-birthplace">
              <div class="loc-btn-left">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
                <span id="text-user-birthplace">${userDraft.birthplace || '<span class="loc-placeholder">点击选择出生国家与城市...</span>'}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="form-group">
            <label class="form-label">现居住地 (Residence)</label>
            <button class="location-picker-btn" id="btn-user-pick-residence">
              <div class="loc-btn-left">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                <span id="text-user-residence">${userDraft.residence || '<span class="loc-placeholder">点击选择居住国家与城市...</span>'}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <!-- 5. 底部全宽保存按钮 -->
        <div class="user-bottom-save-row">
          <button class="user-save-main-btn" id="btn-save-user-persona">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>保存 User 身份并激活</span>
          </button>
        </div>

      </div>
    </div>
  `;

  bindUserFormEvents(container);
}

/**
 * 表单交互事件与 AI 提取绑定
 */
function bindUserFormEvents(container) {
  container.querySelector('#btn-back-user-list').onclick = () => {
    currentViewMode = 'list';
    renderUserView(container);
  };

  const avatarBox = container.querySelector('#user-avatar-box');
  const avatarFileInput = container.querySelector('#user-avatar-file-input');
  if (avatarBox && avatarFileInput) {
    avatarBox.onclick = () => {
      avatarFileInput.value = '';
      avatarFileInput.click();
    };

          avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // ✨ 使用 FileReader 保存永久 Base64 字符串
      const reader = new FileReader();
      reader.onload = (event) => {
        userDraft.avatarUrl = event.target.result;
        renderUserFormView(container);
      };
      reader.readAsDataURL(file);
    };
  }

  const detailedTextarea = container.querySelector('#form-user-detailed-info');
  if (detailedTextarea) {
    detailedTextarea.oninput = (e) => {
      userDraft.detailedInfo = e.target.value;
    };
  }

  // 单项智能提取
  container.querySelectorAll('[data-user-extract-target]').forEach(btn => {
    btn.onclick = async () => {
      const targetField = btn.getAttribute('data-user-extract-target');
      const rawText = detailedTextarea ? detailedTextarea.value.trim() : '';

      if (!rawText) {
        alert('请先在「详细信息」框内粘贴个人背景与习惯资料！');
        return;
      }

      btn.innerHTML = `<span>提取中...</span>`;
      btn.style.opacity = '0.7';

      const result = await extractUserFeaturesWithLLM(targetField, rawText);

      if (targetField === 'catchphrase') {
        container.querySelector('#form-user-catchphrase').value = result;
        userDraft.catchphrase = result;
      } else if (targetField === 'likesAndDislikes') {
        container.querySelector('#form-user-likes').value = result;
        userDraft.likesAndDislikes = result;
      } else if (targetField === 'dressStyle') {
        container.querySelector('#form-user-dress').value = result;
        userDraft.dressStyle = result;
      } else if (targetField === 'appearance') {
        container.querySelector('#form-user-appear').value = result;
        userDraft.appearance = result;
      }

      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>已提取</span>`;
      btn.style.opacity = '1';
      setTimeout(() => {
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>提取</span>`;
      }, 1500);
    };
  });

  // 一键全部提取
  const extractAllBtn = container.querySelector('#btn-extract-user-all');
  if (extractAllBtn && detailedTextarea) {
    extractAllBtn.onclick = async () => {
      const rawText = detailedTextarea.value.trim();
      if (!rawText) {
        alert('请先在「详细信息」框内粘贴个人背景与习惯资料！');
        return;
      }

      extractAllBtn.innerHTML = `<span>AI 正在结构化分析 User 画像...</span>`;
      extractAllBtn.style.opacity = '0.7';

      const all = await extractAllUserFeaturesWithLLM(rawText);

      container.querySelector('#form-user-catchphrase').value = all.catchphrase;
      container.querySelector('#form-user-likes').value = all.likesAndDislikes;
      container.querySelector('#form-user-dress').value = all.dressStyle;
      container.querySelector('#form-user-appear').value = all.appearance;

      userDraft.catchphrase = all.catchphrase;
      userDraft.likesAndDislikes = all.likesAndDislikes;
      userDraft.dressStyle = all.dressStyle;
      userDraft.appearance = all.appearance;

      extractAllBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>全部提取完成</span>`;
      extractAllBtn.style.opacity = '1';

      setTimeout(() => {
        extractAllBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>一键全部提取 (AI 驱动)</span>`;
      }, 2000);
    };
  }

  // 地理选择
  const pickBirthBtn = container.querySelector('#btn-user-pick-birthplace');
  if (pickBirthBtn) {
    pickBirthBtn.onclick = () => {
      openLocationDrawer((selectedCity) => {
        userDraft.birthplace = selectedCity;
        container.querySelector('#text-user-birthplace').textContent = selectedCity;
      });
    };
  }

  const pickResBtn = container.querySelector('#btn-user-pick-residence');
  if (pickResBtn) {
    pickResBtn.onclick = () => {
      openLocationDrawer((selectedCity) => {
        userDraft.residence = selectedCity;
        container.querySelector('#text-user-residence').textContent = selectedCity;
      });
    };
  }

  // 保存 User 身份
  const saveBtn = container.querySelector('#btn-save-user-persona');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const name = container.querySelector('#form-user-name').value.trim();
      if (!name) {
        alert('请输入身份姓名');
        return;
      }

      userDraft.name = name;
      userDraft.gender = container.querySelector('#form-user-gender').value;
      userDraft.birthDate = container.querySelector('#form-user-birth').value;
      userDraft.occupation = container.querySelector('#form-user-occ').value.trim();
      userDraft.detailedInfo = container.querySelector('#form-user-detailed-info').value.trim();
      userDraft.catchphrase = container.querySelector('#form-user-catchphrase').value.trim();
      userDraft.likesAndDislikes = container.querySelector('#form-user-likes').value.trim();
      userDraft.dressStyle = container.querySelector('#form-user-dress').value.trim();
      userDraft.appearance = container.querySelector('#form-user-appear').value.trim();

      const list = getStoredUserPersonasFull();
      if (editingUserId) {
        const idx = list.findIndex(u => u.id === editingUserId);
        if (idx >= 0) list[idx] = { ...userDraft };
      } else {
        list.unshift({ ...userDraft });
      }

      saveStoredUserPersonasFull(list);

      // 设置为当前激活的 User 身份
      localStorage.setItem('mini_current_active_user', name);

      // 同步将 User 核心习惯（如不吃蒜）注入记忆库底层
      if (userDraft.likesAndDislikes) {
        const memoryVault = JSON.parse(localStorage.getItem('mini_memory_vault') || '[]');
        // 去重更新
        const existingIdx = memoryVault.findIndex(m => m.userPersona === name && m.anchorType === '个人喜好与雷点');
        const habitMemory = {
          id: `mem-user-habit-${Date.now()}`,
          scope: 'user',
          userPersona: name,
          boundChar: '__all__',
          anchorType: '个人喜好与雷点',
          content: userDraft.likesAndDislikes,
          time: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        if (existingIdx >= 0) memoryVault[existingIdx] = habitMemory;
        else memoryVault.unshift(habitMemory);
        localStorage.setItem('mini_memory_vault', JSON.stringify(memoryVault));
      }

      currentViewMode = 'list';
      editingUserId = null;
      renderUserView(container);
    };
  }
}

/**
 * AI 大模型深度提炼 User 画像
 */
async function extractAllUserFeaturesWithLLM(rawText) {
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');

  if (apiConfig.apiKey && apiConfig.baseUrl) {
    try {
      const prompt = `请从以下用户（User）原始资料中，精准、完整地提取4项个人特征。必须直接返回合法 JSON 对象，不要包含 markdown 标记，不要截断：
{
  "catchphrase": "提取 User 的说话习惯、常用语气与口癖（完整句子）",
  "likesAndDislikes": "提取 User 的偏好习惯、喜恶食物（如不吃蒜）、日常雷点（清晰完整列出）",
  "dressStyle": "提取 User 的日常穿衣风格、常穿服饰与色系（完整描述）",
  "appearance": "提取 User 的外貌特征、身材体态与形象细节（完整描述）"
}

【User 原始资料】：
${rawText}`;

      const cleanUrl = apiConfig.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: apiConfig.model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });

      if (res.ok) {
        const data = await res.json();
        let content = data.choices[0]?.message?.content?.trim() || '';
        content = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(content);
        if (parsed.catchphrase || parsed.likesAndDislikes) {
          return {
            catchphrase: parsed.catchphrase || '',
            likesAndDislikes: parsed.likesAndDislikes || '',
            dressStyle: parsed.dressStyle || '',
            appearance: parsed.appearance || ''
          };
        }
      }
    } catch (err) {
      console.warn('User 特征 API 提取受阻，切换为本地长句解析:', err);
    }
  }

  return {
    catchphrase: extractFallbackIntact(rawText, ['说话', '语气', '口癖', '语调', '习惯说', '常用语']),
    likesAndDislikes: extractFallbackIntact(rawText, ['喜欢', '爱好', '讨厌', '厌恶', '雷点', '不吃', '抗拒', '偏好']),
    dressStyle: extractFallbackIntact(rawText, ['穿', '衣', '装', '服', '卫衣', '鞋', '风格', '色系']),
    appearance: extractFallbackIntact(rawText, ['外貌', '长相', '身材', '发', '眼', '神态', '体态'])
  };
}

async function extractUserFeaturesWithLLM(fieldKey, rawText) {
  const all = await extractAllUserFeaturesWithLLM(rawText);
  return all[fieldKey] || '';
}

function extractFallbackIntact(fullText, keywords) {
  const paragraphs = fullText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const matched = [];

  paragraphs.forEach(p => {
    if (keywords.some(k => p.includes(k))) {
      const sentences = p.split(/(?<=[。！？；!?;\n])/).map(s => s.trim()).filter(Boolean);
      sentences.forEach(s => {
        if (keywords.some(k => s.includes(k))) matched.push(s);
      });
    }
  });

  return matched.length > 0 ? Array.from(new Set(matched)).join('\n') : (paragraphs[0] || '');
}

function openLocationDrawer(onSelected) {
  const modalRoot = document.getElementById('modal-root') || document.body;
  const drawer = document.createElement('div');
  drawer.className = 'modal-container active';

  let navStack = [];

  function push(title, items, onSelect, getLabel = x => x) {
    navStack.push({ title, items, onSelect, getLabel });
    render();
  }

  function pop() {
    if (navStack.length > 1) {
      navStack.pop();
      render();
    }
  }

  function render() {
    const cur = navStack[navStack.length - 1];
    const canBack = navStack.length > 1;

    drawer.innerHTML = `
      <div class="modal-backdrop" id="drawer-backdrop"></div>
      <div class="modal-sheet">
        <div class="sheet-drag-handle"></div>
        <div class="sheet-header">
          ${canBack ? '<button class="sheet-back-btn" id="drawer-back-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>' : '<div style="width:24px"></div>'}
          <span class="sheet-title">${cur.title}</span>
          <button class="sheet-close-btn" id="drawer-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>

        <ul class="sheet-options-list">
          ${cur.items.map((it, i) => `
            <li class="sheet-option-item" data-idx="${i}">
              <span>${cur.getLabel(it)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    drawer.querySelector('#drawer-backdrop').onclick = () => drawer.remove();
    drawer.querySelector('#drawer-close-btn').onclick = () => drawer.remove();
    if (canBack) drawer.querySelector('#drawer-back-btn').onclick = pop;

    drawer.querySelectorAll('.sheet-option-item').forEach(el => {
      el.onclick = () => {
        const idx = Number(el.getAttribute('data-idx'));
        cur.onSelect(cur.items[idx]);
      };
    });
  }

  function start() {
    push("选择大洲", worldLocations, (continent) => {
      push(continent.continent, continent.regions, (region) => {
        push(region.name, region.countries, (country) => {
          if (country.provinces) {
            push(country.name, country.provinces, (province) => {
              push(province.name, province.cities, (city) => {
                onSelected(`${country.name} · ${province.name} · ${city}`);
                drawer.remove();
              });
            }, p => p.name);
          } else if (country.cities) {
            push(country.name, country.cities, (city) => {
              onSelected(`${country.name} · ${city}`);
              drawer.remove();
            });
          } else {
            onSelected(country.name);
            drawer.remove();
          }
        }, c => c.name);
      }, r => r.name);
    }, c => c.continent);
  }

  modalRoot.appendChild(drawer);
  start();
}
