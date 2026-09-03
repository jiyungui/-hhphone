// ═══════════════════════════════════════════════════════════════
// MINI PHONE OS · 表情包中枢 (STICKERS VAULT)
// INS 白黑极简高奢风 · 支持「名称：URL」格式 · 批量导入/导出/解析/分组
// ═══════════════════════════════════════════════════════════════

let activeStickerGroupId = 'all'; // 'all' | 分组ID

// ✨ 补齐 HTML 转义函数
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getStickerVault() {
  const defaultVault = {
    groups: [
      { id: 'default', name: '默认表情包' }
    ],
    stickers: [] // ✨ 纯净空数据，不再引用未定义的 INITIAL_PRESET_STICKERS
  };

  const stored = JSON.parse(localStorage.getItem('mini_sticker_vault') || 'null');
  if (!stored || !stored.stickers) {
    saveStickerVault(defaultVault);
    return defaultVault;
  }
  return stored;
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