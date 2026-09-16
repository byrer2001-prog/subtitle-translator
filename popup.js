const $ = (id) => document.getElementById(id);

const KEYS = {
  enabled: $('enabled'),
  targetLang: $('targetLang'),
  provider: $('provider'),
  ollamaModel: $('ollamaModel'),
  autoHideSeconds: $('autoHide')
};

// 加载设置
chrome.storage.sync.get({
  enabled: true,
  targetLang: 'zh-CN',
  provider: 'mymemory',
  ollamaModel: 'qwen2.5:7b',
  autoHideSeconds: 8
}, (s) => {
  KEYS.enabled.checked = s.enabled;
  KEYS.targetLang.value = s.targetLang;
  KEYS.provider.value = s.provider;
  KEYS.ollamaModel.value = s.ollamaModel;
  KEYS.autoHideSeconds.value = s.autoHideSeconds;
  toggleOllamaRow();
});

function toggleOllamaRow() {
  $('ollamaRow').style.display = KEYS.provider.value === 'ollama' ? 'block' : 'none';
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({
      enabled: KEYS.enabled.checked,
      targetLang: KEYS.targetLang.value,
      provider: KEYS.provider.value,
      ollamaModel: KEYS.ollamaModel.value.trim() || 'qwen2.5:7b',
      autoHideSeconds: Math.max(0, Number(KEYS.autoHideSeconds.value) || 0)
    }, () => {
      $('status').textContent = '已保存 ✓';
      setTimeout(() => { $('status').textContent = ''; }, 1200);
    });
  }, 250);
}

KEYS.enabled.addEventListener('change', save);
KEYS.targetLang.addEventListener('change', save);
KEYS.provider.addEventListener('change', () => { toggleOllamaRow(); save(); });
KEYS.ollamaModel.addEventListener('input', save);
KEYS.autoHideSeconds.addEventListener('input', save);
