# 字幕划词翻译 (Subtitle Translator)

一个 Chrome / Edge 浏览器扩展：在网页上划词，原文与译文以**视频字幕样式**呈现在页面底部。

## 功能

- 🖱️ 划词后点击「译」按钮翻译，或按 **Alt+T** 快捷翻译
- 📺 原文 + 译文以字幕条形式显示在页面底部，支持自动消失、悬停暂停、Esc 关闭
- 🌐 12 种目标语言可选（中/英/日/韩/法/德/西/俄/葡/意/阿等）
- 🔌 三种翻译引擎：
  - **MyMemory** — 免费，国内直连，无需 Key（约 5000 字符/天额度）
  - **Google 翻译** — 免费接口，需要代理
  - **本地 Ollama** — 完全离线、无额度限制，隐私最好
- 🎨 字幕 UI 使用 Shadow DOM，不受页面样式干扰

## 安装

1. 下载本仓库（Code → Download ZIP，或 `git clone`）
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本仓库文件夹
5. 建议点击浏览器右上角拼图图标 🧩，将本扩展固定到工具栏

## 使用

| 操作 | 效果 |
|---|---|
| 选中文字 → 点击「译」 | 翻译并显示字幕 |
| 选中文字 → 按 Alt+T | 直接翻译 |
| 鼠标悬停字幕 | 暂停自动消失 |
| Esc / 点击 ✕ | 关闭字幕 |

点击工具栏上的扩展图标可切换目标语言、翻译引擎、字幕停留时间。

## Ollama 配置（可选）

使用本地 Ollama 引擎时，需允许扩展跨域访问，设置环境变量后重启 Ollama：

```powershell
setx OLLAMA_ORIGINS "chrome-extension://*"
```

然后在扩展设置中选择「本地 Ollama」并填写模型名（如 `qwen2.5:7b`，需先 `ollama pull`）。

## 技术栈

Manifest V3 · 原生 JavaScript（content script + service worker）· 无第三方依赖

## License

[MIT](LICENSE)
