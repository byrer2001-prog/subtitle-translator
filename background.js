// 后台服务：统一发起翻译请求（避免内容脚本的 CORS / 混合内容问题）

const LANG_NAMES = {
  'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': '英语', 'ja': '日语',
  'ko': '韩语', 'fr': '法语', 'de': '德语', 'es': '西班牙语',
  'ru': '俄语', 'pt': '葡萄牙语', 'it': '意大利语', 'ar': '阿拉伯语'
};

const DEFAULTS = {
  targetLang: 'zh-CN',
  provider: 'mymemory',      // mymemory | google | ollama
  ollamaModel: 'qwen2.5:7b',
  autoHideSeconds: 8,
  enabled: true
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  if (settings.provider === 'edge') settings.provider = 'mymemory'; // edge 接口已失效，迁移
  return settings;
}

// ---------- MyMemory 翻译（免费，国内直连，无需 Key） ----------
// 匿名额度约 5000 字符/天，单次请求限 ~500 字符，超长自动分段
async function translateChunk(text, targetLang) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text)
    + '&langpair=Autodetect|' + encodeURIComponent(targetLang);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('MyMemory 请求失败: ' + resp.status);
  const data = await resp.json();
  if (data.responseStatus !== 200 || !data.responseData) {
    throw new Error('MyMemory: ' + (data.responseDetails || '翻译失败（可能超出每日免费额度）'));
  }
  return {
    translation: data.responseData.translatedText || '',
    detectedLang: data.responseData.detectedLanguage || ''
  };
}

async function translateByMyMemory(text, targetLang) {
  if (text.length <= 450) return translateChunk(text, targetLang);
  // 按句子边界分段
  const sentences = text.match(/[^.!?。！？；;\n]+[.!?。！？；;\n]*/g) || [text];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > 450 && buf) { chunks.push(buf); buf = s; }
    else buf += s;
  }
  if (buf) chunks.push(buf);
  const parts = [];
  for (const c of chunks) parts.push((await translateChunk(c, targetLang)).translation);
  return { translation: parts.join(' '), detectedLang: '' };
}
async function translateByGoogle(text, targetLang) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto'
    + '&tl=' + encodeURIComponent(targetLang)
    + '&dt=t&q=' + encodeURIComponent(text);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Google 翻译请求失败: ' + resp.status);
  const data = await resp.json();
  const translation = (data[0] || []).map(seg => seg[0]).join('');
  return { translation, detectedLang: data[2] || '' };
}

// 本地 Ollama 翻译
async function translateByOllama(text, targetLang, model) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  const prompt =
    `请将下面的文本翻译成${langName}。只输出译文，不要输出任何解释、注音或额外内容。\n\n` +
    `原文：\n${text}`;
  const resp = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!resp.ok) throw new Error('Ollama 请求失败: ' + resp.status + '（请确认 Ollama 已启动）');
  const data = await resp.json();
  return { translation: (data.response || '').trim(), detectedLang: '' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'translate') return;

  (async () => {
    try {
      const settings = await getSettings();
      let result;
      if (settings.provider === 'ollama') {
        result = await translateByOllama(msg.text, settings.targetLang, settings.ollamaModel);
      } else if (settings.provider === 'google') {
        result = await translateByGoogle(msg.text, settings.targetLang);
      } else {
        result = await translateByMyMemory(msg.text, settings.targetLang);
      }
      sendResponse({ ok: true, ...result, targetLang: settings.targetLang });
    } catch (err) {
      sendResponse({ ok: false, error: String(err.message || err) });
    }
  })();

  return true; // 异步响应
});
