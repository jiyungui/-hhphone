import { worldLocations } from '../data/locationData.js';

let currentViewMode = 'list';
let editingCharId = null;

function getStoredCharacters() {
  return JSON.parse(localStorage.getItem('mini_character_vault_full') || '[]');
}

function saveStoredCharacters(list) {
  localStorage.setItem('mini_character_vault_full', JSON.stringify(list));
  const names = list.map(c => c.name);
  localStorage.setItem('mini_user_characters', JSON.stringify(names));
}

let charDraft = getNewCharDraft();

function getNewCharDraft() {
  return {
    id: `char-${Date.now()}`,
    avatarUrl: '',
    name: '',
    gender: '保密',
    birthDate: '2004-06-15',
    occupation: '',
    detailedInfo: '',
    catchphrase: '',
    likesAndDislikes: '',
    dressStyle: '',
    appearance: '',
    birthplace: '',
    residence: '',
    timePerception: true,
    voiceEnabled: false,
    voicePlatform: 'minimax',
    voiceId: 'female-yujie',
    voiceCustomId: '',
    linkedUserPersona: '',
    linkedWorldBook: '',
    linkedStickerPack: ''
  };
}

export function renderCharactersView(container) {
  if (currentViewMode === 'list') {
    renderCharacterListView(container);
  } else {
    renderCharacterFormView(container);
  }
}

/**
 * 1. 紧凑型角色列表主视图（高度贴合头像，去除开聊按键，信息上移）
 */
function renderCharacterListView(container) {
  const characters = getStoredCharacters();

  container.innerHTML = `
    <div class="characters-container">
      <!-- 顶栏标题 -->
      <div class="char-header">
        <span class="char-header-title">Characters</span>
        <span class="char-count-badge">${characters.length} CHARS</span>
      </div>

      <!-- 顶栏下方的新建加号栏 -->
      <div class="char-add-bar" id="btn-open-add-char" title="录入新角色">
        <div class="char-add-bar-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <span class="char-add-bar-text">录入新角色档案</span>
      </div>

      <!-- 紧凑型角色列表 -->
      <div class="char-grid-list" id="char-grid-list">
        ${characters.length === 0 ? `
          <div class="empty-placeholder">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span>NO CHARACTERS YET</span>
            <small style="font-size: 10px; color: var(--text-muted);">点击上方加号录入第一个角色</small>
          </div>
        ` : characters.map(c => `
          <div class="char-card-item" data-id="${c.id}">
            <!-- 3:4 长方形证件照头像 -->
            <div class="char-card-avatar-thumb">
              ${c.avatarUrl ? `<img src="${c.avatarUrl}" class="char-card-avatar-img" />` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              `}
            </div>

            <!-- 右侧紧凑信息区 -->
            <div class="char-card-info">
              <div class="char-card-top-row">
                <div class="char-name-occ-wrap">
                  <span class="char-card-name">${c.name}</span>
                  ${c.occupation ? `<span class="char-card-occ">${c.occupation}</span>` : ''}
                </div>
                <div class="char-action-icons">
                  <button class="char-del-btn" data-edit-char="${c.id}" title="编辑资料">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="char-del-btn" data-del-char="${c.id}" title="删除角色">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <!-- 地理与时间感知等标签紧凑同行排列 -->
              <div class="char-card-mid-row">
                ${c.residence ? `<span class="char-chip">${c.residence}</span>` : ''}
                ${c.timePerception ? '<span class="char-chip active-tag">时间感知</span>' : ''}
                ${c.voiceEnabled ? '<span class="char-chip active-tag">TTS已启用</span>' : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 绑定事件
  const addBtn = container.querySelector('#btn-open-add-char');
  if (addBtn) {
    addBtn.onclick = () => {
      charDraft = getNewCharDraft();
      currentViewMode = 'create';
      editingCharId = null;
      renderCharactersView(container);
    };
  }

  container.querySelectorAll('[data-edit-char]').forEach(btn => {
    btn.onclick = () => {
      const charId = btn.getAttribute('data-edit-char');
      const target = characters.find(c => c.id === charId);
      if (target) {
        charDraft = { ...target };
        currentViewMode = 'edit';
        editingCharId = charId;
        renderCharactersView(container);
      }
    };
  });

  container.querySelectorAll('[data-del-char]').forEach(btn => {
    btn.onclick = () => {
      const charId = btn.getAttribute('data-del-char');
      if (confirm('确定要删除该角色吗？')) {
        const nextList = characters.filter(c => c.id !== charId);
        saveStoredCharacters(nextList);
        renderCharactersView(container);
      }
    };
  });
}

/**
 * 2. 创建/编辑角色内置表单视图
 */
function renderCharacterFormView(container) {
  const userPersonaList = JSON.parse(localStorage.getItem('mini_user_personas') || '[]');
  const worldBookList = JSON.parse(localStorage.getItem('mini_worldbooks') || '[]');
  const stickerPackList = JSON.parse(localStorage.getItem('mini_sticker_packs') || '[]');

  container.innerHTML = `
    <div class="characters-container">
      <!-- 顶部仅保留返回栏 -->
      <div class="char-form-header">
        <button class="char-form-back-btn" id="btn-back-char-list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          <span>${currentViewMode === 'edit' ? '编辑角色资料' : '录入新角色'}</span>
        </button>
      </div>

      <!-- 表单主体滚动区 -->
      <div class="char-form-scroll-view">
        
        <!-- 1. 证件照 + 基础信息 -->
        <div class="char-id-photo-row">
          <div class="id-photo-frame ${charDraft.avatarUrl ? 'has-image' : ''}" id="char-avatar-box" title="点击上传长方形证件照">
            ${charDraft.avatarUrl ? `
              <img src="${charDraft.avatarUrl}" class="id-photo-img" id="char-avatar-img" />
            ` : `
              <div class="id-photo-placeholder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="id-photo-lbl">3:4 证件照</span>
              </div>
            `}
            <input type="file" id="char-avatar-file-input" accept="image/*" style="display:none;" />
          </div>

          <div class="id-basic-info-col">
            <div class="form-group">
              <label class="form-label">名字 (Name)</label>
              <input type="text" class="form-input-sm" id="form-char-name" value="${charDraft.name}" placeholder="角色姓名..." />
            </div>

            <div class="form-group">
              <label class="form-label">性别 (Gender)</label>
              <select class="form-input-sm" id="form-char-gender">
                <option value="女" ${charDraft.gender === '女' ? 'selected' : ''}>女 (Female)</option>
                <option value="男" ${charDraft.gender === '男' ? 'selected' : ''}>男 (Male)</option>
                <option value="保密" ${charDraft.gender === '保密' ? 'selected' : ''}>保密 (Secret)</option>
                <option value="自定义" ${charDraft.gender === '自定义' ? 'selected' : ''}>自定义</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">出生日期 (Birth Date)</label>
              <input type="date" class="form-input-sm" id="form-char-birth" value="${charDraft.birthDate}" />
            </div>

            <div class="form-group">
              <label class="form-label">职业 / 身份 (Occupation)</label>
              <input type="text" class="form-input-sm" id="form-char-occ" value="${charDraft.occupation}" placeholder="例如：系统管家 / 画师" />
            </div>
          </div>
        </div>

        <!-- 2. 详细信息母本录入区 -->
        <div class="api-card">
          <div class="card-title">
            <span>详细信息 (Full Profile & Lore)</span>
            <button class="extract-all-btn" id="btn-extract-all" title="调用 AI 从详细信息深度提取全部特征">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span id="btn-extract-all-text">一键全部提取 (AI 驱动)</span>
            </button>
          </div>
          <span class="card-desc">在此粘贴关于该 Char 的全部设定、背景故事或性格资料。点击各项目的「提取」键，AI 会精准提炼出连贯完整的特征。</span>
          <textarea class="full-detail-textarea" id="form-char-detailed-info" placeholder="在此粘贴角色的全部信息设定...&#10;例如：&#10;性格冷静内敛，喜欢在句尾加“...呢”。平时爱好研究各类古籍和喝热红茶，极度厌恶大蒜和嘈杂环境。常穿一件炭黑色修身长风衣，里面是整洁的白衬衫。眼瞳为深琥珀色，神情沉稳从容...">${charDraft.detailedInfo || ''}</textarea>
        </div>

        <!-- 3. 特征智能提炼区 -->
        <div class="api-card">
          <span class="card-title">特征提取与性格锚点</span>

          <!-- A. 口癖提取 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">口癖与语言习惯提取</label>
              <button class="single-extract-btn" data-extract-target="catchphrase">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-char-catchphrase" style="min-height: 48px;" placeholder="点击提取或输入口癖习惯...">${charDraft.catchphrase}</textarea>
          </div>

          <!-- B. 爱好兴趣讨厌提取 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">爱好 · 兴趣 · 讨厌的东西提取</label>
              <button class="single-extract-btn" data-extract-target="likesAndDislikes">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-char-likes" style="min-height: 60px;" placeholder="点击提取或输入爱好与雷点...">${charDraft.likesAndDislikes}</textarea>
          </div>

          <!-- C. 穿衣风格提取 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">穿衣搭配风格提取</label>
              <button class="single-extract-btn" data-extract-target="dressStyle">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-char-dress" style="min-height: 52px;" placeholder="点击提取或输入穿衣搭配风格...">${charDraft.dressStyle}</textarea>
          </div>

          <!-- D. 外貌提取 -->
          <div class="form-group">
            <div class="extract-label-row">
              <label class="form-label">外貌特征细节提取</label>
              <button class="single-extract-btn" data-extract-target="appearance">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>提取</span>
              </button>
            </div>
            <textarea class="doc-textarea" id="form-char-appear" style="min-height: 60px;" placeholder="点击提取或输入外貌细节...">${charDraft.appearance}</textarea>
          </div>
        </div>

        <!-- 4. 地理与时间认知 -->
        <div class="api-card">
          <span class="card-title">地理与时间感知</span>

          <div class="form-group">
            <label class="form-label">出生地 (Birthplace)</label>
            <button class="location-picker-btn" id="btn-pick-birthplace">
              <div class="loc-btn-left">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
                <span id="text-birthplace">${charDraft.birthplace || '<span class="loc-placeholder">点击选择国家与城市...</span>'}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="form-group">
            <label class="form-label">居住地 (Residence)</label>
            <button class="location-picker-btn" id="btn-pick-residence">
              <div class="loc-btn-left">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                <span id="text-residence">${charDraft.residence || '<span class="loc-placeholder">点击选择居住国家与城市...</span>'}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="toggle-row" style="margin-top: 4px;">
            <div class="toggle-info">
              <span class="toggle-name">开启真实时间与作息感知</span>
              <span class="toggle-hint">允许角色感知现实时间流逝、早晚作息与节气</span>
            </div>
            <label>
              <input type="checkbox" class="switch-input" id="form-char-time-percept" ${charDraft.timePerception ? 'checked' : ''}/>
              <div class="switch-track"><div class="switch-thumb"></div></div>
            </label>
          </div>
        </div>

        <!-- 5. 语音发声功能 -->
        <div class="api-card">
          <span class="card-title">语音合成发声配置</span>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-name">启用专属语音朗读</span>
              <span class="toggle-hint">收到该角色消息时调用 TTS 生成发声</span>
            </div>
            <label>
              <input type="checkbox" class="switch-input" id="form-char-voice-enable" ${charDraft.voiceEnabled ? 'checked' : ''}/>
              <div class="switch-track"><div class="switch-thumb"></div></div>
            </label>
          </div>

          <div id="voice-config-sub-wrap" style="${charDraft.voiceEnabled ? '' : 'display:none;'} margin-top: 6px;">
            <div class="form-group">
              <label class="form-label">选择语音引擎平台</label>
              <select class="form-input" id="form-char-voice-platform">
                <option value="minimax" ${charDraft.voicePlatform === 'minimax' ? 'selected' : ''}>MiniMax 语音大模型</option>
                <option value="elevenlabs" ${charDraft.voicePlatform === 'elevenlabs' ? 'selected' : ''}>ElevenLabs 拟真多情感</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">音色预设 / Voice ID</label>
              <select class="form-input" id="form-char-voice-id">
                ${charDraft.voicePlatform === 'minimax' ? `
                  <option value="female-yujie" ${charDraft.voiceId === 'female-yujie' ? 'selected' : ''}>成熟御姐 (知性磁性)</option>
                  <option value="female-tianmei" ${charDraft.voiceId === 'female-tianmei' ? 'selected' : ''}>甜美少女 (轻快灵动)</option>
                  <option value="male-qn-qingse" ${charDraft.voiceId === 'male-qn-qingse' ? 'selected' : ''}>青涩男声 (阳光自然)</option>
                  <option value="male-qn-jingying" ${charDraft.voiceId === 'male-qn-jingying' ? 'selected' : ''}>精英男声 (低沉稳重)</option>
                  <option value="custom" ${charDraft.voiceId === 'custom' ? 'selected' : ''}>+ 自定义 Voice ID</option>
                ` : `
                  <option value="21m00Tcm4TlvDq8ikWAM" ${charDraft.voiceId === '21m00Tcm4TlvDq8ikWAM' ? 'selected' : ''}>Rachel (经典自然女声)</option>
                  <option value="pNInz6obpgDQGcFmaJgB" ${charDraft.voiceId === 'pNInz6obpgDQGcFmaJgB' ? 'selected' : ''}>Adam (磁性叙事男声)</option>
                  <option value="EXAVITQu4vr4xnSDxMaL" ${charDraft.voiceId === 'EXAVITQu4vr4xnSDxMaL' ? 'selected' : ''}>Bella (甜美灵动女声)</option>
                  <option value="ErXwobaYiN019PkySvjV" ${charDraft.voiceId === 'ErXwobaYiN019PkySvjV' ? 'selected' : ''}>Antoni (沉稳男声)</option>
                  <option value="custom" ${charDraft.voiceId === 'custom' ? 'selected' : ''}>+ 自定义 Voice ID</option>
                `}
              </select>
            </div>
          </div>
        </div>

        <!-- 6. 实体与资源关联 -->
        <div class="api-card">
          <span class="card-title">实体与资源绑定 (Association)</span>

          <div class="form-group">
            <label class="form-label">关联主要 User 身份</label>
            <select class="form-input" id="form-char-user-link">
              <option value="">未关联 User 身份</option>
              ${userPersonaList.map(u => `<option value="${u}" ${charDraft.linkedUserPersona === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">关联世界书设定 (WorldBook)</label>
            <select class="form-input" id="form-char-wb-link">
              <option value="">未关联世界书</option>
              ${worldBookList.map(wb => `<option value="${wb.id || wb.name}" ${charDraft.linkedWorldBook === (wb.id || wb.name) ? 'selected' : ''}>${wb.name || wb.title}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">关联专属表情包 (Sticker Pack)</label>
            <select class="form-input" id="form-char-sticker-link">
              <option value="">未关联表情包</option>
              ${stickerPackList.map(sp => `<option value="${sp.id || sp.name}" ${charDraft.linkedStickerPack === (sp.id || sp.name) ? 'selected' : ''}>${sp.name || sp.title}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- 7. 最底部的全宽保存角色按钮 -->
        <div class="char-bottom-save-row">
          <button class="char-save-main-btn" id="btn-save-character">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>保存角色档案并激活</span>
          </button>
        </div>

      </div>
    </div>
  `;

  bindCharacterFormEvents(container);
}

function bindCharacterFormEvents(container) {
  container.querySelector('#btn-back-char-list').onclick = () => {
    currentViewMode = 'list';
    renderCharactersView(container);
  };

  const avatarBox = container.querySelector('#char-avatar-box');
  const avatarFileInput = container.querySelector('#char-avatar-file-input');
  if (avatarBox && avatarFileInput) {
    avatarBox.onclick = () => {
      avatarFileInput.value = '';
      avatarFileInput.click();
    };

    avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      charDraft.avatarUrl = url;
      renderCharacterFormView(container);
    };
  }

  const detailedTextarea = container.querySelector('#form-char-detailed-info');
  if (detailedTextarea) {
    detailedTextarea.oninput = (e) => {
      charDraft.detailedInfo = e.target.value;
    };
  }

  // 单项智能提取
  container.querySelectorAll('[data-extract-target]').forEach(btn => {
    btn.onclick = async () => {
      const targetField = btn.getAttribute('data-extract-target');
      const rawText = detailedTextarea ? detailedTextarea.value.trim() : '';

      if (!rawText) {
        alert('请先在「详细信息」框内粘贴角色的完整背景资料！');
        return;
      }

      btn.innerHTML = `<span>提取中...</span>`;
      btn.style.opacity = '0.7';

      const result = await extractSingleFeatureWithLLM(targetField, rawText);

      if (targetField === 'catchphrase') {
        container.querySelector('#form-char-catchphrase').value = result;
        charDraft.catchphrase = result;
      } else if (targetField === 'likesAndDislikes') {
        container.querySelector('#form-char-likes').value = result;
        charDraft.likesAndDislikes = result;
      } else if (targetField === 'dressStyle') {
        container.querySelector('#form-char-dress').value = result;
        charDraft.dressStyle = result;
      } else if (targetField === 'appearance') {
        container.querySelector('#form-char-appear').value = result;
        charDraft.appearance = result;
      }

      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>已提取</span>`;
      btn.style.opacity = '1';
      setTimeout(() => {
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>提取</span>`;
      }, 1500);
    };
  });

  // 一键全部提取
  const extractAllBtn = container.querySelector('#btn-extract-all');
  if (extractAllBtn && detailedTextarea) {
    extractAllBtn.onclick = async () => {
      const rawText = detailedTextarea.value.trim();
      if (!rawText) {
        alert('请先在「详细信息」框内粘贴角色的完整背景资料！');
        return;
      }

      extractAllBtn.innerHTML = `<span>AI 正在结构化深度解析全篇...</span>`;
      extractAllBtn.style.opacity = '0.7';

      const allResults = await extractAllFeaturesWithLLM(rawText);

      container.querySelector('#form-char-catchphrase').value = allResults.catchphrase;
      container.querySelector('#form-char-likes').value = allResults.likesAndDislikes;
      container.querySelector('#form-char-dress').value = allResults.dressStyle;
      container.querySelector('#form-char-appear').value = allResults.appearance;

      charDraft.catchphrase = allResults.catchphrase;
      charDraft.likesAndDislikes = allResults.likesAndDislikes;
      charDraft.dressStyle = allResults.dressStyle;
      charDraft.appearance = allResults.appearance;

      extractAllBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>全量提炼完毕</span>`;
      extractAllBtn.style.opacity = '1';

      setTimeout(() => {
        extractAllBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>一键全部提取 (AI 驱动)</span>`;
      }, 2000);
    };
  }

  const voiceToggle = container.querySelector('#form-char-voice-enable');
  const voiceSubWrap = container.querySelector('#voice-config-sub-wrap');
  if (voiceToggle && voiceSubWrap) {
    voiceToggle.onchange = (e) => {
      charDraft.voiceEnabled = e.target.checked;
      voiceSubWrap.style.display = e.target.checked ? 'block' : 'none';
    };
  }

  const pickBirthBtn = container.querySelector('#btn-pick-birthplace');
  if (pickBirthBtn) {
    pickBirthBtn.onclick = () => {
      openLocationDrawer((selectedCity) => {
        charDraft.birthplace = selectedCity;
        container.querySelector('#text-birthplace').textContent = selectedCity;
      });
    };
  }

  const pickResBtn = container.querySelector('#btn-pick-residence');
  if (pickResBtn) {
    pickResBtn.onclick = () => {
      openLocationDrawer((selectedCity) => {
        charDraft.residence = selectedCity;
        container.querySelector('#text-residence').textContent = selectedCity;
      });
    };
  }

  // 保存角色
  const saveBtn = container.querySelector('#btn-save-character');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const name = container.querySelector('#form-char-name').value.trim();
      if (!name) {
        alert('请输入角色姓名');
        return;
      }

      charDraft.name = name;
      charDraft.gender = container.querySelector('#form-char-gender').value;
      charDraft.birthDate = container.querySelector('#form-char-birth').value;
      charDraft.occupation = container.querySelector('#form-char-occ').value.trim();
      charDraft.detailedInfo = container.querySelector('#form-char-detailed-info').value.trim();
      charDraft.catchphrase = container.querySelector('#form-char-catchphrase').value.trim();
      charDraft.likesAndDislikes = container.querySelector('#form-char-likes').value.trim();
      charDraft.dressStyle = container.querySelector('#form-char-dress').value.trim();
      charDraft.appearance = container.querySelector('#form-char-appear').value.trim();
      charDraft.timePerception = container.querySelector('#form-char-time-percept').checked;
      charDraft.voiceEnabled = container.querySelector('#form-char-voice-enable').checked;
      charDraft.voicePlatform = container.querySelector('#form-char-voice-platform').value;
      charDraft.voiceId = container.querySelector('#form-char-voice-id').value;
      charDraft.linkedUserPersona = container.querySelector('#form-char-user-link').value;
      charDraft.linkedWorldBook = container.querySelector('#form-char-wb-link').value;
      charDraft.linkedStickerPack = container.querySelector('#form-char-sticker-link').value;

      const list = getStoredCharacters();
      if (editingCharId) {
        const idx = list.findIndex(c => c.id === editingCharId);
        if (idx >= 0) list[idx] = { ...charDraft };
      } else {
        list.unshift({ ...charDraft });
      }

      saveStoredCharacters(list);
      currentViewMode = 'list';
      editingCharId = null;
      renderCharactersView(container);
    };
  }
}

/**
 * AI 大模型深度结构化提炼引擎
 */
async function extractAllFeaturesWithLLM(rawText) {
  const apiConfig = JSON.parse(localStorage.getItem('mini_api_settings') || '{}');

  if (apiConfig.apiKey && apiConfig.baseUrl) {
    try {
      const prompt = `请从以下角色原始资料中，精准、完整地提取4项人设特征。必须直接返回合法 JSON 对象，不要包含任何 markdown 代码块标记，不要截断长句子：
{
  "catchphrase": "提取角色的口癖、口头禅、句末语气、说话节奏与习惯措辞（保留完整句子）",
  "likesAndDislikes": "提取角色的爱好、兴趣偏好、讨厌/抗拒的事物、雷点（清晰分条列出）",
  "dressStyle": "提取角色的日常穿衣风格、常穿服饰、配色、饰品细节（完整描述）",
  "appearance": "提取角色的外貌长相、发型发色、眼眸神态、体态细节（完整描述）"
}

【角色原始资料】：
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
      console.warn('API 提炼调用失败，切入本地长句语义解析:', err);
    }
  }

  // 离线长句语义扫描兜底
  return {
    catchphrase: extractFallbackIntact(rawText, ['口癖', '口头禅', '语气', '语调', '说话', '习惯', '喜欢说', '句末', '措辞']),
    likesAndDislikes: extractFallbackIntact(rawText, ['爱好', '喜欢', '偏爱', '热衷', '兴趣', '喜好', '讨厌', '厌恶', '反感', '雷点', '抗拒']),
    dressStyle: extractFallbackIntact(rawText, ['穿', '衣', '装', '服', '戴', '风衣', '衬衫', '饰品', '打扮', '制服', '风格']),
    appearance: extractFallbackIntact(rawText, ['外貌', '长相', '发', '眼', '眸', '神态', '身材', '容貌', '脸', '神情', '体态'])
  };
}

async function extractSingleFeatureWithLLM(fieldKey, rawText) {
  const all = await extractAllFeaturesWithLLM(rawText);
  return all[fieldKey] || '';
}

function extractFallbackIntact(fullText, keywords) {
  const paragraphs = fullText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const matched = [];

  paragraphs.forEach(p => {
    if (keywords.some(k => p.includes(k))) {
      const sentences = p.split(/(?<=[。！？；!?;\n])/).map(s => s.trim()).filter(Boolean);
      sentences.forEach(s => {
        if (keywords.some(k => s.includes(k))) {
          matched.push(s);
        }
      });
    }
  });

  if (matched.length > 0) {
    return Array.from(new Set(matched)).join('\n');
  }

  return paragraphs[0] || '';
}

/**
 * 五大洲地理选择抽屉
 */
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
