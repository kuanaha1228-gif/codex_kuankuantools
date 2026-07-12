const $ = id => document.getElementById(id);
let usage;
const previewUsage = () => ({ source: "浏览器预览 · Mock 数据", five: { remaining: 58, reset: new Date(Date.now() + 6138000).toISOString() }, week: { remaining: 73, reset: new Date(Date.now() + 206100000).toISOString() } });
const duration = stamp => { if (!stamp) return "—"; const total = Math.max(0, Math.floor((new Date(stamp) - Date.now()) / 1000)), d = Math.floor(total / 86400), h = Math.floor(total % 86400 / 3600); return d ? `${d}天 ${h}小时` : `${String(h).padStart(2, "0")}:${String(Math.floor(total % 3600 / 60)).padStart(2, "0")}`; };
const time24 = stamp => stamp ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(stamp)) : "—";
function fill(key, value) { $(key === "five" ? "five-value" : "week-value").textContent = value ? `${value.remaining}%` : "—"; $(`${key}-bar`).style.width = `${value?.remaining || 0}%`; $(`${key}-reset`).textContent = key === "five" ? time24(value?.reset) : duration(value?.reset); }
function paint(value) { usage = value; fill("five", value.five); fill("week", value.week); }
async function refresh(force = false) { paint(window.widget ? await window.widget.getUsage(force) : previewUsage()); }
function setPin(state) { $("pin").classList.toggle("off", !state.alwaysOnTop); $("pin-label").textContent = state.alwaysOnTop ? "已置顶" : "未置顶"; }
$("pin").onclick = async () => setPin(window.widget ? await window.widget.toggleTop() : { alwaysOnTop: false });
$("theme").onclick = () => { const light = document.body.classList.toggle("light"); $("theme-icon").textContent = light ? "☾" : "☼"; $("theme-label").textContent = light ? "深色" : "浅色"; };
window.widget?.getState().then(setPin); window.widget?.onState(setPin);
setInterval(() => { if (usage && !usage.error) paint(usage); }, 1000); setInterval(refresh, 120000); refresh();
