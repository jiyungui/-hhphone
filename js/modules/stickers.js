// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 表情包中枢 (STICKERS VAULT)
// INS 白黑极简高奢风 · 支持「名称：URL」格式 · 批量导入/导出/解析/分组
// ═══════════════════════════════════════════════════════════════

let activeStickerGroupId = 'all'; // 'all' | 分组ID

// 初始预设数据（根据文件二自动内置 45 枚优质抽象表情包）
const INITIAL_PRESET_STICKERS = [
  { name: '神你会拯救我吗', url: 'https://i.postimg.cc/BQHbnsD6/3144E65EF88196F72253483ADCB3EA4A.jpg', groupId: 'abstract' },
  { name: '神你会拯救我吗-2', url: 'https://i.postimg.cc/NMfk7q5y/2672ACD8609002B516E7EBE5917F5DFD.jpg', groupId: 'abstract' },
  { name: '神你会拯救我吗-3', url: 'https://i.postimg.cc/66PfRPKc/D3835B0567B276225D7F861796861A3F.jpg', groupId: 'abstract' },
  { name: '神你会拯救我吗-4', url: 'https://i.postimg.cc/pLbQcnmt/AD9EEBEB69290D2F97A880E552DA71AE.jpg', groupId: 'abstract' },
  { name: '感觉自己每天好懵逼啊', url: 'https://i.postimg.cc/rshV043Y/794A3B1CEFDC68A12F22244DF11610E4.jpg', groupId: 'abstract' },
  { name: '被子外面的世界好残酷', url: 'https://i.postimg.cc/k4qqTwdZ/5335414AC3AE518FFC2A887F8BC91067.jpg', groupId: 'abstract' },
  { name: '全世界都在欺负萌萌的我', url: 'https://i.postimg.cc/mZdBSQpn/960322CEF256A635BC09C47A50EFC528.jpg', groupId: 'abstract' },
  { name: '我想你了', url: 'https://i.postimg.cc/QxwD2jDZ/305EEC42D476639B7F4081B305FD2A50.jpg', groupId: 'abstract' },
  { name: '哭', url: 'https://i.postimg.cc/qRJHsRsn/362718F8530F04E44CDC808F2EE22659.jpg', groupId: 'abstract' },
  { name: '感觉自己好呆萌呀', url: 'https://i.postimg.cc/GtN0nxZs/081F9C48F464EDDED3BF4FCD1276BF5B.jpg', groupId: 'abstract' },
  { name: '我什么都不知道', url: 'https://i.postimg.cc/yYg4X2Zj/7019B1A4B05161F9A7F18CE46056E449.jpg', groupId: 'abstract' },
  { name: '萌醒', url: 'https://i.postimg.cc/FKvMvRnd/2CBF66E3289D4079B203E6B098295458.jpg', groupId: 'abstract' },
  { name: '拿去，省着点伤', url: 'https://i.postimg.cc/XJHm9gNH/3EEDA3DC47C02C54566EADFFD59740E9.jpg', groupId: 'abstract' },
  { name: '恶俗啊！', url: 'https://i.postimg.cc/MKVxJhp2/2B4F2452E6E75C7755B3AD6CF3C063B3.jpg', groupId: 'abstract' },
  { name: '来来', url: 'https://i.postimg.cc/nLct7rYL/B7D1188CAA3A5D0BC554C9ACA7BC88F2.jpg', groupId: 'abstract' },
  { name: '去去', url: 'https://i.postimg.cc/TwB8Z98q/BFD29E082ACAD717F3890195D20206BC.jpg', groupId: 'abstract' },
  { name: '鬼点子生成中', url: 'https://i.postimg.cc/9Fd3nZL2/E90E2B92443A9C2BFAFA9B70D28A2F9F.jpg', groupId: 'abstract' },
  { name: '好萌好可爱', url: 'https://i.postimg.cc/Lssr572f/ECB269A1FCF6C22C72E447C31A324FB0.jpg', groupId: 'abstract' },
  { name: '这世界怎么这么坏', url: 'https://i.postimg.cc/Vst2JXQV/D47D67626FF1E185D6A1B8FDA63A7AFC.jpg', groupId: 'abstract' },
  { name: '求我啊', url: 'https://i.postimg.cc/QMPntd6N/92C8A98A9F5BE3C102DF0B669EEC23B9.jpg', groupId: 'abstract' },
  { name: '快说需要我', url: 'https://i.postimg.cc/xjLFfYMp/301EF207F229150E49C03D8567A060F5.jpg', groupId: 'abstract' },
  { name: '这又是什么情趣', url: 'https://i.postimg.cc/G2GzmJ89/44BA28DD6B457EDB380E567F3F15377E.jpg', groupId: 'abstract' },
  { name: '今天谁跟我表白', url: 'https://i.postimg.cc/CKfscH4s/B057DE6CC04CB8A06844AED28E2758BE.jpg', groupId: 'abstract' },
  { name: '真的太色了', url: 'https://i.postimg.cc/x8gvXs00/1DDF554803324AFC834C6E3718E771E8.jpg', groupId: 'abstract' },
  { name: '天地可鉴', url: 'https://i.postimg.cc/Gh7PrS76/793FB15E27B9E5C20323EB834C0D36A8.jpg', groupId: 'abstract' },
  { name: '粉红色的钞票', url: 'https://i.postimg.cc/XNxdczbv/FFAEDF43CDC19043A39F7E0F89506C8C.jpg', groupId: 'abstract' },
  { name: '我一直在流眼泪', url: 'https://i.postimg.cc/1tsVDp7V/6F61C5972A76586D03249EB7CFE281E5.jpg', groupId: 'abstract' },
  { name: '我装可爱be like', url: 'https://i.postimg.cc/ryhRtR1T/308D1948DE32ADAED5606FEBD61A5AA4.jpg', groupId: 'abstract' },
  { name: '我很可爱请给我钱', url: 'https://i.postimg.cc/DZvmS7mP/AE04C40D8F999A0D364CF1B729FC8401.jpg', groupId: 'abstract' },
  { name: '用力挠了屁股', url: 'https://i.postimg.cc/8c3CXW46/31CFDCCB86957ABA3B10A8CDD98804ED.jpg', groupId: 'abstract' },
  { name: '现在用力挠你屁股', url: 'https://i.postimg.cc/TYL1L72Z/005F84E2786FDDDE3CA47D3918405553.jpg', groupId: 'abstract' },
  { name: '得挠人处且挠人', url: 'https://i.postimg.cc/W4n1LxSd/43A742FF220F6D5011A35CE578516055.jpg', groupId: 'abstract' },
  { name: '你挠不着我', url: 'https://i.postimg.cc/9QPWZs6K/6928145FAA6664EB80105ECA111A5EF2.jpg', groupId: 'abstract' },
  { name: '下面的人是gay', url: 'https://i.postimg.cc/k5fqhKXb/A11DC12C632048787BBE70F134C82CED.jpg', groupId: 'abstract' },
  { name: '上面的人是gay', url: 'https://i.postimg.cc/857cRtBs/1A025E2B5E747FB1C68447AFF4D4A8D2.jpg', groupId: 'abstract' },
  { name: '我鸟都不鸟你', url: 'https://i.postimg.cc/vHrBt19L/A48CBEC85DBB6482267EC03FC23E2A2B.jpg', groupId: 'abstract' },
  { name: '你鸟鸟我', url: 'https://i.postimg.cc/SsYQ2jkC/F75B610EB9573024D367DC71AB82C5E1.jpg', groupId: 'abstract' },
  { name: '你已急哭', url: 'https://i.postimg.cc/KcLvmK0H/CA9DEB033236D07D9D5120822CE7C299.jpg', groupId: 'abstract' },
  { name: '绝望的哭', url: 'https://i.postimg.cc/3wdYVWyL/9379558E49E7AEDCAF7EC53F96272054.jpg', groupId: 'abstract' },
  { name: '淡淡的不屑', url: 'https://i.postimg.cc/PJzjYwcM/E5008068F78BDF7399E57B14CB24B937.jpg', groupId: 'abstract' },
  { name: '欺负我你能得到什么', url: 'https://i.postimg.cc/G3JwMv7b/C77A1FA46777AEF240C83E46FF46A521.jpg', groupId: 'abstract' },
  { name: '吐血', url: 'https://i.postimg.cc/zXxmN815/4D104C6DD44E9DA078EE4BAB596343A7.jpg', groupId: 'abstract' },
  { name: '军方已介入', url: 'https://i.postimg.cc/xdbBLmNY/40037BD27AE8323A30F87331F3E04EB6.jpg', groupId: 'abstract' },
  { name: '好日子流走了', url: 'https://i.postimg.cc/mkTqx6dK/CBB97E148D7A9119DA8D6994A7C7FBED.jpg', groupId: 'abstract' },
  { name: '来喝柠檬水', url: 'https://i.postimg.cc/4xY0Tc5h/7914988CEFCD33BD3020FD355534A847.jpg', groupId: 'abstract' }
];

export function getStickerVault() {
  const defaultVault = {
    groups: [
      { id: 'abstract', name: '抽象表情包' }
    ],
    stickers: INITIAL_PRESET_STICKERS
  };

  const stored = JSON.parse(localStorage.getItem('mini_sticker_vault') || 'null');
  if (!stored || !stored.stickers || stored.stickers.length === 0) {
    saveStickerVault(defaultVault);
    return defaultVault;
  }
  return stored;
}

export function saveStickerVault(vault) {
  localStorage.setItem('mini_sticker_vault', JSON.stringify(vault));
}

// 渲染表情包中枢主页面
export function renderStickersGalleryView(container) {
  const vault = getStickerVault();
  const groups = vault.groups || [];
  const stickers = vault.stickers || [];

  const filteredStickers = stickers.filter(s => {
    if (activeStickerGroupId === 'all') return true;
    return s.groupId === activeStickerGroupId;
  });

  container.innerHTML = `
    <div class="sticker-vault-container">
      <!-- 1. 顶栏 (INS 白黑大字重) -->
      <header class="sticker-vault-header">
        <div class="sticker-header-title-box">
          <span class="sticker-main-title">表情包中枢</span>
          <span class="sticker-meta-tag">STICKER VAULT</span>
        </div>
        <div class="sticker-count-badge">${stickers.length} 枚表情</div>
      </header>

      <!-- 2. 操作功能栏 -->
      <div class="sticker-action-toolbar">
        <button class="ins-tool-btn primary" id="btn-add-single-url-stk" title="输入单张图片 URL">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>添加 URL</span>
        </button>

        <button class="ins-tool-btn" id="btn-add-batch-url-stk" title="批量粘贴「名称：链接」">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>批量「名称:URL」</span>
        </button>

        <button class="ins-tool-btn" id="btn-export-stickers" title="导出表情包为文本或文件">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>导出</span>
        </button>

        <button class="ins-tool-btn" id="btn-import-stickers" title="解析导入表情包">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 12h16"/><path d="M12 4v16"/></svg>
          <span>解析导入</span>
        </button>
      </div>

      <!-- 3. 分组标签栏 -->
      <div class="sticker-groups-bar">
        <button class="sticker-group-pill ${activeStickerGroupId === 'all' ? 'active' : ''}" data-gid="all">全部 (${stickers.length})</button>
        ${groups.map(g => {
          const count = stickers.filter(s => s.groupId === g.id).length;
          return `
            <button class="sticker-group-pill ${activeStickerGroupId === g.id ? 'active' : ''}" data-gid="${g.id}">
              <span>${escapeHtml(g.name)}</span>
              <small>(${count})</small>
            </button>
          `;
        }).join('')}
        <button class="sticker-group-pill add-btn" id="btn-add-sticker-group" title="新建分组">+ 分组</button>
      </div>

      <!-- 4. 高阶表情包卡片网格 -->
      <main class="sticker-grid-scroll-area">
        ${filteredStickers.length === 0 ? `
          <div class="sticker-empty-box">
            <div class="sticker-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <span class="sticker-empty-title">当前分组暂无表情</span>
            <span class="sticker-empty-sub">支持 jpg、png、gif、webp 等网络图片 URL</span>
          </div>
        ` : `
          <div class="sticker-masonry-grid">
            ${filteredStickers.map(stk => `
              <div class="sticker-card-thumb" data-sid="${stk.id}">
                <div class="sticker-thumb-img-box">
                  <img src="${stk.url}" alt="${escapeHtml(stk.name)}" loading="lazy" />
                </div>
                <span class="sticker-thumb-title">${escapeHtml(stk.name || '表情')}</span>
                <button class="sticker-thumb-del-btn" data-del-sid="${stk.id}" title="删除">×</button>
              </div>
            `).join('')}
          </div>
        `}
      </main>
    </div>
  `;

  bindStickersEvents(container);
}

// 绑定管理事件
function bindStickersEvents(container) {
  const vault = getStickerVault();

  // 分组切换
  container.querySelectorAll('.sticker-group-pill[data-gid]').forEach(pill => {
    pill.onclick = () => {
      activeStickerGroupId = pill.getAttribute('data-gid');
      renderStickersGalleryView(container);
    };
  });

  // 新建分组
  const addGroupBtn = container.querySelector('#btn-add-sticker-group');
  if (addGroupBtn) {
    addGroupBtn.onclick = () => {
      const name = prompt('请输入新分组名称 (如：搞怪/沙雕/动漫):');
      if (!name || !name.trim()) return;
      vault.groups.push({
        id: `grp-${Date.now()}`,
        name: name.trim()
      });
      saveStickerVault(vault);
      showStickerToast(`已创建分组「${name.trim()}」`);
      renderStickersGalleryView(container);
    };
  }

  // 单张 URL 添加
  const singleUrlBtn = container.querySelector('#btn-add-single-url-stk');
  if (singleUrlBtn) {
    singleUrlBtn.onclick = () => openSingleUrlModal(container);
  }

  // 批量 URL 导入（完全支持 名称：URL 格式）
  const batchUrlBtn = container.querySelector('#btn-add-batch-url-stk');
  if (batchUrlBtn) {
    batchUrlBtn.onclick = () => openBatchUrlModal(container);
  }

  // 导出
  const exportBtn = container.querySelector('#btn-export-stickers');
  if (exportBtn) {
    exportBtn.onclick = () => openExportModal(vault);
  }

  // 解析导入
  const importBtn = container.querySelector('#btn-import-stickers');
  if (importBtn) {
    importBtn.onclick = () => openImportModal(container);
  }

  // 放大预览与修改
  container.querySelectorAll('.sticker-card-thumb').forEach(thumb => {
    thumb.onclick = (e) => {
      if (e.target.classList.contains('sticker-thumb-del-btn')) return;
      const sid = thumb.getAttribute('data-sid');
      const target = vault.stickers.find(s => s.id === sid);
      if (target) openPreviewModal(target, container);
    };
  });

  // 删除单张
  container.querySelectorAll('.sticker-thumb-del-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const sid = btn.getAttribute('data-del-sid');
      vault.stickers = vault.stickers.filter(s => s.id !== sid);
      saveStickerVault(vault);
      showStickerToast('已删除该表情');
      renderStickersGalleryView(container);
    };
  });
}

// 弹窗：单张 URL 添加
function openSingleUrlModal(mainContainer) {
  const vault = getStickerVault();
  const groups = vault.groups || [];

  const modal = document.createElement('div');
  modal.className = 'sticker-modal-overlay active';
  modal.innerHTML = `
    <div class="sticker-modal-card">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">添加单张表情 / ADD URL</span>
        <button class="sticker-modal-close" id="btn-close-single-url">×</button>
      </div>

      <div class="sticker-modal-body">
        <div class="stk-modal-preview-box">
          <img id="img-single-preview" src="" alt="预览" style="display:none;" />
          <span id="txt-preview-empty" style="font-size:9px; color:#999; text-align:center; padding:10px;">输入链接查看实时预览</span>
        </div>

        <div class="stk-form-group">
          <label class="stk-form-label">图片 URL 链接</label>
          <input type="url" class="stk-input" id="input-single-stk-url" placeholder="https://i.postimg.cc/...jpg" autofocus />
        </div>

        <div class="stk-form-group">
          <label class="stk-form-label">表情名称</label>
          <input type="text" class="stk-input" id="input-single-stk-name" placeholder="如：神你会拯救我吗" />
        </div>

        <div class="stk-form-group">
          <label class="stk-form-label">所属分组</label>
          <select class="stk-select" id="input-single-stk-group">
            ${groups.map(g => `<option value="${g.id}" ${g.id === activeStickerGroupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>

        <button class="ins-tool-btn primary" id="btn-submit-single-url" style="width:100%; padding:9px 0; margin-top:4px;">确认收录入库</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-single-url').onclick = close;

  const urlInput = modal.querySelector('#input-single-stk-url');
  const imgPreview = modal.querySelector('#img-single-preview');
  const emptyHint = modal.querySelector('#txt-preview-empty');

  urlInput.oninput = () => {
    const val = urlInput.value.trim();
    if (val) {
      imgPreview.src = val;
      imgPreview.style.display = 'block';
      emptyHint.style.display = 'none';
      imgPreview.onerror = () => {
        emptyHint.textContent = '无法加载该图片，请检查链接';
        emptyHint.style.display = 'block';
        imgPreview.style.display = 'none';
      };
    } else {
      imgPreview.style.display = 'none';
      emptyHint.textContent = '输入链接查看实时预览';
      emptyHint.style.display = 'block';
    }
  };

  modal.querySelector('#btn-submit-single-url').onclick = () => {
    const url = urlInput.value.trim();
    if (!url) {
      showStickerToast('请输入有效的图片链接');
      return;
    }
    const name = modal.querySelector('#input-single-stk-name').value.trim() || '表情';
    const groupId = modal.querySelector('#input-single-stk-group').value;

    vault.stickers.unshift({
      id: `stk-${Date.now()}`,
      name: name,
      url: url,
      groupId: groupId || 'abstract'
    });

    saveStickerVault(vault);
    showStickerToast(`成功添加表情「${name}」！`);
    close();
    renderStickersGalleryView(mainContainer);
  };
}

// 弹窗：批量导入「名称：URL」格式
function openBatchUrlModal(mainContainer) {
  const vault = getStickerVault();
  const groups = vault.groups || [];

  const modal = document.createElement('div');
  modal.className = 'sticker-modal-overlay active';
  modal.innerHTML = `
    <div class="sticker-modal-card" style="max-width:340px;">
      <div class="sticker-modal-header">
        <div style="display:flex; flex-direction:column; gap:1px;">
          <span class="sticker-modal-title">批量导入表情包 / BATCH IMPORT</span>
          <span style="font-size:8px; color:#888; font-family:ui-monospace, monospace;">FORMAT: NAME：URL</span>
        </div>
        <button class="sticker-modal-close" id="btn-close-batch-url">×</button>
      </div>

      <div class="sticker-modal-body">
        <p class="stk-desc-text">支持直接粘贴文件格式（支持中文冒号 <b>：</b> 或英文冒号 <b>:</b> 分隔）：<br/><span style="font-family:monospace; color:#111;">神你会拯救我吗：https://.../1.jpg</span></p>
        
        <textarea class="stk-textarea" id="text-batch-urls" placeholder="神你会拯救我吗：https://i.postimg.cc/BQHbnsD6/1.jpg&#10;感觉自己每天好懵逼啊：https://i.postimg.cc/rshV043Y/2.jpg" style="height:140px;"></textarea>

        <div class="stk-form-group">
          <label class="stk-form-label">导入至目标分组</label>
          <select class="stk-select" id="input-batch-group">
            ${groups.map(g => `<option value="${g.id}" ${g.id === activeStickerGroupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>

        <button class="ins-tool-btn primary" id="btn-submit-batch-urls" style="width:100%; padding:9px 0; margin-top:4px;">开始批量收录入库</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-batch-url').onclick = close;

  modal.querySelector('#btn-submit-batch-urls').onclick = () => {
    const raw = modal.querySelector('#text-batch-urls').value.trim();
    if (!raw) {
      showStickerToast('请先粘贴表情包数据');
      return;
    }
    const groupId = modal.querySelector('#input-batch-group').value;

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let count = 0;

    lines.forEach((line) => {
      // 兼容中文冒号 ：与英文冒号 :
      let parts = line.split(/：|:\s*(?=https?:\/\/)/);
      if (parts.length >= 2) {
        let name = parts[0].trim();
        let url = parts[1].trim();

        if (url.startsWith('http://') || url.startsWith('https://')) {
          vault.stickers.unshift({
            id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: name || '表情',
            url: url,
            groupId: groupId || 'abstract'
          });
          count++;
        }
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        vault.stickers.unshift({
          id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `表情 ${vault.stickers.length + 1}`,
          url: line,
          groupId: groupId || 'abstract'
        });
        count++;
      }
    });

    saveStickerVault(vault);
    showStickerToast(`成功批量收录 ${count} 枚表情包！`);
    close();
    renderStickersGalleryView(mainContainer);
  };
}

// 弹窗：放大预览与修改
function openPreviewModal(sticker, mainContainer) {
  const vault = getStickerVault();
  const groups = vault.groups || [];

  const modal = document.createElement('div');
  modal.className = 'sticker-modal-overlay active';
  modal.innerHTML = `
    <div class="sticker-modal-card" style="max-width:320px;">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">表情详情 / DETAIL</span>
        <button class="sticker-modal-close" id="btn-close-preview-modal">×</button>
      </div>

      <div class="sticker-modal-body">
        <div class="stk-modal-preview-box large">
          <img src="${sticker.url}" alt="${escapeHtml(sticker.name)}" />
        </div>

        <div class="stk-form-group">
          <label class="stk-form-label">修改名称</label>
          <input type="text" class="stk-input" id="input-preview-name" value="${escapeHtml(sticker.name)}" />
        </div>

        <div class="stk-form-group">
          <label class="stk-form-label">调整分组</label>
          <select class="stk-select" id="input-preview-group">
            ${groups.map(g => `<option value="${g.id}" ${g.id === sticker.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="ins-tool-btn" id="btn-preview-delete" style="flex:1; border-color:#EF4444; color:#EF4444;">删除</button>
          <button class="ins-tool-btn primary" id="btn-preview-save" style="flex:2;">保存修改</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-preview-modal').onclick = close;

  modal.querySelector('#btn-preview-save').onclick = () => {
    const target = vault.stickers.find(s => s.id === sticker.id);
    if (target) {
      target.name = modal.querySelector('#input-preview-name').value.trim() || '表情';
      target.groupId = modal.querySelector('#input-preview-group').value;
      saveStickerVault(vault);
      showStickerToast('已更新表情属性');
      renderStickersGalleryView(mainContainer);
    }
    close();
  };

  modal.querySelector('#btn-preview-delete').onclick = () => {
    vault.stickers = vault.stickers.filter(s => s.id !== sticker.id);
    saveStickerVault(vault);
    showStickerToast('已删除该表情');
    close();
    renderStickersGalleryView(mainContainer);
  };
}

// 弹窗：导出表情包（文本格式直接以 名称：URL 排列）
function openExportModal(vault) {
  const stickers = vault.stickers || [];
  const textExport = stickers.map(s => `${s.name}：${s.url}`).join('\n');

  const modal = document.createElement('div');
  modal.className = 'sticker-modal-overlay active';
  modal.innerHTML = `
    <div class="sticker-modal-card" style="max-width:340px;">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">导出表情包文本 / EXPORT</span>
        <button class="sticker-modal-close" id="btn-close-export-modal">×</button>
      </div>

      <div class="sticker-modal-body">
        <p class="stk-desc-text">已转为「名称：链接」标准文本：</p>
        <textarea class="stk-textarea" id="text-export-content" readonly>${textExport}</textarea>
        
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="ins-tool-btn primary" id="btn-copy-export-text" style="width:100%;">一键复制全部文本</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-export-modal').onclick = close;

  modal.querySelector('#btn-copy-export-text').onclick = () => {
    navigator.clipboard.writeText(textExport).then(() => {
      showStickerToast('已复制全部表情包代码至剪贴板');
    });
  };
}

// 弹窗：解析导入
function openImportModal(mainContainer) {
  const modal = document.createElement('div');
  modal.className = 'sticker-modal-overlay active';
  modal.innerHTML = `
    <div class="sticker-modal-card" style="max-width:340px;">
      <div class="sticker-modal-header">
        <span class="sticker-modal-title">解析导入表情包 / IMPORT</span>
        <button class="sticker-modal-close" id="btn-close-import-modal">×</button>
      </div>

      <div class="sticker-modal-body">
        <p class="stk-desc-text">在此粘贴「名称：URL」或 JSON 格式：</p>
        <textarea class="stk-textarea" id="text-import-data" placeholder="神你会拯救我吗：https://..."></textarea>
        <button class="ins-tool-btn primary" id="btn-execute-import" style="width:100%; margin-top:4px;">开始解析合并</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btn-close-import-modal').onclick = close;

  modal.querySelector('#btn-execute-import').onclick = () => {
    const raw = modal.querySelector('#text-import-data').value.trim();
    if (!raw) {
      showStickerToast('请先输入要导入的内容');
      return;
    }

    const vault = getStickerVault();
    let count = 0;

    // 优先尝试 JSON
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.stickers)) {
          parsed.stickers.forEach(s => {
            if (s.url && !vault.stickers.some(ex => ex.url === s.url)) {
              vault.stickers.unshift(s);
              count++;
            }
          });
        }
      } catch (e) {}
    }

    // 尝试文本按行解析
    if (count === 0) {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        let parts = line.split(/：|:\s*(?=https?:\/\/)/);
        if (parts.length >= 2) {
          let name = parts[0].trim();
          let url = parts[1].trim();
          if (url.startsWith('http://') || url.startsWith('https://')) {
            if (!vault.stickers.some(ex => ex.url === url)) {
              vault.stickers.unshift({
                id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: name || '表情',
                url: url,
                groupId: 'abstract'
              });
              count++;
            }
          }
        }
      });
    }

    saveStickerVault(vault);
    showStickerToast(`导入完成！新增 ${count} 枚表情`);
    close();
    renderStickersGalleryView(mainContainer);
  };
}

function showStickerToast(text) {
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
