const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("widget", {
  getState: () => ipcRenderer.invoke("widget:get-state"),
  getUsage: force => ipcRenderer.invoke("usage:fetch", force),
  toggleTop: () => ipcRenderer.invoke("widget:toggle-top"),
  toggleCompact: () => ipcRenderer.invoke("widget:toggle-compact"),
  minimize: () => ipcRenderer.send("widget:minimize"),
  maximize: () => ipcRenderer.send("widget:maximize"),
  close: () => ipcRenderer.send("widget:close"),
  onState: callback => ipcRenderer.on("state", (_event, state) => callback(state))
});
