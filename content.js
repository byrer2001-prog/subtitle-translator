// 内容脚本：划词 → 显示「译」按钮 → 翻译结果以字幕条呈现
// 使用 Shadow DOM 隔离样式，避免被页面 CSS 影响

(() => {
  if (window.__subtitleTranslatorLoaded) return;
  window.__subtitleTranslatorLoaded = true;

  let settings = { targetLang: 'zh-CN', autoHideSeconds: 8, enabled: true };
  chrome.storage.sync.get(settings, (s) => { settings = { ...settings, ...s }; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(changes)) settings[key] = changes[key].newValue;
  });

  // ---------- 悬浮「译」按钮 ----------
  const btnHost = document.createElement('div');
  btnHost.style.cssText = 'position:absolute;z-index:2147483647;display:none;';
  const btnShadow = btnHost.attachShadow({ mode: 'open' });
  btnShadow.innerHTML = `
    <style>
      button {
        all: initial;
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 8px;
        background: #1a1a1a; color: #ffd966;
        font: 600 15px/1 "Microsoft YaHei", sans-serif;
        cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.45);
        transition: transform .12s;
      }
      button:hover { transform: scale(1.12); }
    </style>
    <button title="翻译选中内容">译</button>
  `;
  document.documentElement.appendChild(btnHost);
  const translateBtn = btnShadow.querySelector('button');

  // ---------- 字幕条 ----------
  const subHost = document.createElement('div');
  subHost.style.cssText = 'position:fixed;left:0;right:0;bottom:36px;z-index:2147483647;display:flex;justify-content:center;pointer-events:none;';
  const subShadow = subHost.attachShadow({ mode: 'open' });
  subShadow.innerHTML = `
    <style>
      .sub {
        pointer-events: auto;
        max-width: min(80vw, 900px);
        background: rgba(0, 0, 0, 0.78);
        border-radius: 10px;
        padding: 10px 22px 12px;
        text-align: center;
        font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
        box-shadow: 0 4px 24px rgba(0,0,0,.5);
        animation: rise .18s ease-out;
        position: relative;
        cursor: default;
      }
      @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }
      .src {
        color: rgba(255,255,255,.62);
        font-size: 13px; line-height: 1.5;
        margin-bottom: 4px;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .dst {
        color: #fff;
        font-size: 19px; font-weight: 600; line-height: 1.55;
        text-shadow: 0 1px 3px rgba(0,0,0,.8);
        user-select: text;
      }
      .dst.error { color: #ff8080; font-size: 14px; font-weight: 400; }
      .loading { color: rgba(255,255,255,.7); font-size: 15px; }
      .close {
        position: absolute; top: 4px; right: 8px;
        color: rgba(255,255,255,.45); font-size: 14px; cursor: pointer;
        background: none; border: none; padding: 2px 4px;
      }
      .close:hover { color: #fff; }
      .hidden { display: none; }
    </style>
    <div class="sub hidden" id="sub">
      <button class="close" id="close">✕</button>
      <div class="src" id="src"></div>
      <div class="dst" id="dst"></div>
    </div>
  `;
  document.documentElement.appendChild(subHost);
  const subBox = subShadow.getElementById('sub');
  const srcEl = subShadow.getElementById('src');
  const dstEl = subShadow.getElementById('dst');

  let hideTimer = null;
  const hideSubtitle = () => {
    subBox.classList.add('hidden');
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  };
  subShadow.getElementById('close').addEventListener('click', hideSubtitle);
  // 鼠标悬停时暂停自动消失
  subBox.addEventListener('mouseenter', () => { if (hideTimer) clearTimeout(hideTimer); });
  subBox.addEventListener('mouseleave', scheduleHide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSubtitle(); });

  function scheduleHide() {
    if (subBox.classList.contains('hidden')) return;
    if (hideTimer) clearTimeout(hideTimer);
    const secs = Number(settings.autoHideSeconds);
    if (secs > 0) hideTimer = setTimeout(hideSubtitle, secs * 1000);
  }

  function showSubtitle(original, translation, isError = false) {
    srcEl.textContent = original;
    dstEl.textContent = translation;
    dstEl.className = isError ? 'dst error' : 'dst';
    subBox.classList.remove('hidden');
    if (!isError) scheduleHide();
  }

  function showLoading(original) {
    srcEl.textContent = original;
    dstEl.textContent = '翻译中…';
    dstEl.className = 'dst loading';
    subBox.classList.remove('hidden');
    if (hideTimer) clearTimeout(hideTimer);
  }

  // ---------- 翻译流程 ----------
  let currentText = '';

  function doTranslate(text) {
    showLoading(text);
    chrome.runtime.sendMessage({ type: 'translate', text }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        showSubtitle(text, '翻译失败：扩展通信错误', true);
        return;
      }
      if (resp.ok) showSubtitle(text, resp.translation || '（无结果）');
      else showSubtitle(text, resp.error || '翻译失败', true);
    });
  }

  // ---------- 划词监听 ----------
  document.addEventListener('mouseup', (e) => {
    // 点在字幕条或翻译按钮上时不重新计算
    if (e.target === btnHost || e.target === subHost) return;
    setTimeout(() => {
      if (!settings.enabled) { hideButton(); return; }
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length > 2000 || !sel.rangeCount) { hideButton(); return; }
      // 输入框内的选中也支持（getSelection 在部分 input 中为空，忽略）
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { hideButton(); return; }
      currentText = text;
      btnHost.style.left = (rect.right + window.scrollX + 6) + 'px';
      btnHost.style.top = (rect.bottom + window.scrollY + 6) + 'px';
      btnHost.style.display = 'block';
    }, 10);
  });

  translateBtn.addEventListener('mousedown', (e) => e.preventDefault()); // 防止清除选区
  translateBtn.addEventListener('click', () => {
    hideButton();
    if (currentText) doTranslate(currentText);
  });

  function hideButton() { btnHost.style.display = 'none'; }

  document.addEventListener('mousedown', (e) => {
    if (e.target !== btnHost) hideButton();
  });
  document.addEventListener('scroll', hideButton, true);

  // 快捷键：Alt+T 直接翻译当前选中
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      const text = (window.getSelection() || '').toString().trim();
      if (text && settings.enabled) { e.preventDefault(); doTranslate(text); }
    }
  });
})();
