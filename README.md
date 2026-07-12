# Codex Usage Widget

跨平台桌面状态条：显示本机 Codex 的 5 小时与周额度，支持置顶、深浅主题切换与系统托盘菜单。

## 启动

```bash
pnpm install
pnpm start
```

## 打包

```bash
pnpm run package:mac
pnpm run package:win
```

`package:win` 应在 Windows 或 GitHub Actions Windows runner 中执行。仓库包含 `.github/workflows/build-installers.yml`，手动触发后可下载 macOS DMG 与 Windows NSIS `.exe`。

## 数据来源与隐私

真实额度读取仅发生在 Electron 主进程：它读取本机 Codex 登录状态，并请求内部 usage 端点。此接口不是公开或受支持的官方 API，可能随时变化。令牌不会传给 UI、不会落盘、不会写日志。详细边界见 [SECURITY.md](./SECURITY.md)。
