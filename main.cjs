const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require("electron");
const path = require("path");
const { getCodexUsage } = require("./usage-provider.cjs");

let widgetWindow;
let tray;
let quitting = false;
const state = { alwaysOnTop: true, compact: true };
let usageCache;

function toggleTop() {
  state.alwaysOnTop = !state.alwaysOnTop;
  widgetWindow.setAlwaysOnTop(state.alwaysOnTop, "floating");
  widgetWindow.webContents.send("state", state);
  return state;
}

function showWidget() {
  widgetWindow.show();
  widgetWindow.focus();
}

function createTray() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="black" d="M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-1 2v4.2l3 1.9.9-1.45-2.1-1.3V5.5H8Z"/></svg>`;
  const trayIcon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`).resize({ width: 18, height: 18 });
  if (process.platform === "darwin") trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon);
  tray.setToolTip("Codex Usage Widget");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示用量组件", click: showWidget },
    { label: "切换置顶", click: toggleTop },
    { type: "separator" },
    { label: "退出", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("click", showWidget);
}

function createWidget() {
  widgetWindow = new BrowserWindow({
    width: 590, height: 76, minWidth: 590, minHeight: 76,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    skipTaskbar: false, titleBarStyle: "hidden",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false }
  });
  widgetWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  widgetWindow.on("close", event => { if (!quitting) { event.preventDefault(); widgetWindow.hide(); } });
  widgetWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: state.alwaysOnTop ? "取消置顶" : "始终置顶", click: toggleTop },
      { type: "separator" },
      { label: "退出 Codex Usage", click: () => { quitting = true; app.quit(); } }
    ]).popup({ window: widgetWindow });
  });
}

app.whenReady().then(() => { createWidget(); createTray(); app.on("activate", showWidget); });
app.on("window-all-closed", event => { if (process.platform !== "darwin") event.preventDefault(); });

ipcMain.handle("widget:get-state", () => state);
ipcMain.handle("usage:fetch", async (_event, force = false) => {
  // Even a manual refresh cannot continuously replay the account token.
  if (usageCache && Date.now() - usageCache.at < 10_000) return usageCache.value;
  if (!force && usageCache && Date.now() - usageCache.at < 30_000) return usageCache.value;
  try {
    const value = await getCodexUsage(); usageCache = { at: Date.now(), value }; return value;
  } catch (error) { return { error: error.message || "无法读取额度。", fetchedAt: new Date().toISOString() }; }
});
ipcMain.handle("widget:toggle-top", () => toggleTop());
ipcMain.handle("widget:toggle-compact", () => state);
ipcMain.on("widget:minimize", () => widgetWindow.minimize());
ipcMain.on("widget:maximize", () => { if (widgetWindow.isMaximized()) widgetWindow.unmaximize(); else widgetWindow.maximize(); });
ipcMain.on("widget:close", () => widgetWindow.close());
