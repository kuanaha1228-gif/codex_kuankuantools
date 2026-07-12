// Local-only adapter modelled on Quota Float's approach. This is NOT an official API.
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const MAX_AUTH_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function authPath() {
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "auth.json");
}
function stringAt(value, keys) { return keys.map(key => value?.[key]).find(value => typeof value === "string" && value.length > 0); }
function accountIdFromJwt(token) {
  try {
    const body = token.split(".")[1];
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return stringAt(value, ["https://api.openai.com/auth.chatgpt_account_id", "chatgpt_account_id"]);
  } catch { return undefined; }
}
async function localAuth() {
  const file = authPath();
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size > MAX_AUTH_BYTES) throw new Error("未找到可用的本地 Codex 登录状态。");
  let parsed;
  try { parsed = JSON.parse(await fs.readFile(file, "utf8")); } catch { throw new Error("本地 Codex 登录文件格式无法识别。"); }
  const tokens = parsed.tokens || parsed;
  const accessToken = stringAt(tokens, ["access_token", "accessToken"]);
  if (!accessToken) throw new Error("Codex 登录已过期，请先重新登录。");
  return { accessToken, accountId: stringAt(tokens, ["account_id", "accountId"]) || accountIdFromJwt(accessToken) };
}
async function readJson(response) {
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Codex 登录已过期，请重新登录。" : "额度服务暂时不可用。");
  const headerLength = Number(response.headers.get("content-length") || 0);
  if (headerLength > MAX_RESPONSE_BYTES) throw new Error("额度响应超出安全大小限制。");
  const data = await response.arrayBuffer();
  if (data.byteLength > MAX_RESPONSE_BYTES) throw new Error("额度响应超出安全大小限制。");
  try { return JSON.parse(Buffer.from(data).toString("utf8")); } catch { throw new Error("额度响应格式已变化。"); }
}
function numberAt(value, keys) { for (const key of keys) if (typeof value?.[key] === "number") return [key, value[key]]; }
function parseTimestamp(value, keys) { for (const key of keys) { const candidate = value?.[key]; if (typeof candidate === "string" && !Number.isNaN(Date.parse(candidate))) return new Date(candidate).toISOString(); if (Number.isFinite(candidate)) return new Date(candidate * 1000).toISOString(); } }
function parseWindow(value) {
  if (!value || typeof value !== "object") return undefined;
  const remainingValue = numberAt(value, ["remaining_percent", "remainingPercent", "remaining_pct", "remainingPct", "remaining_ratio", "remainingRatio", "remaining"]);
  const usedValue = numberAt(value, ["used_percent", "usedPercent", "used_pct", "usedPct", "used_ratio", "usedRatio", "utilization", "used"]);
  const normalize = ([key, number]) => (/ratio|utilization/.test(key) || (!/percent|pct/.test(key) && number <= 1) ? number * 100 : number);
  const remaining = remainingValue ? normalize(remainingValue) : usedValue ? 100 - normalize(usedValue) : undefined;
  if (!Number.isFinite(remaining)) return undefined;
  return { remaining: Math.max(0, Math.min(100, Math.round(remaining))), reset: parseTimestamp(value, ["reset_at", "resetAt", "resets_at", "resetsAt", "reset_time", "resetTime"]) };
}
function findWindow(rateLimit, aliases, expectedSeconds) {
  for (const alias of aliases) { const found = parseWindow(rateLimit?.[alias]); if (found) return found; }
  for (const key of ["windows", "limit_windows", "limitWindows", "limits", "buckets"]) {
    for (const item of rateLimit?.[key] || []) {
      const name = String(stringAt(item, ["name", "type", "id", "window", "label"]) || "").toLowerCase();
      const seconds = item.limit_window_seconds || item.limitWindowSeconds || item.window_seconds || item.windowSeconds || item.duration_seconds || item.durationSeconds || item.period_seconds || item.periodSeconds;
      if (aliases.some(alias => name.includes(alias.toLowerCase())) || (Number.isFinite(seconds) && Math.abs(seconds - expectedSeconds) <= 60)) { const found = parseWindow(item); if (found) return found; }
    }
  }
}
async function getCodexUsage() {
  const auth = await localAuth();
  const headers = { Authorization: `Bearer ${auth.accessToken}`, Accept: "application/json", originator: "Codex Desktop", "OAI-Product-Sku": "CODEX" };
  if (auth.accountId) headers["ChatGPT-Account-Id"] = auth.accountId;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  let raw;
  try { raw = await readJson(await fetch(USAGE_URL, { headers, redirect: "error", signal: controller.signal })); }
  catch (error) { throw new Error(error.name === "AbortError" ? "额度请求超时。" : error.message || "额度服务暂时不可用。"); }
  finally { clearTimeout(timeout); }
  const rateLimit = raw.rate_limit || raw.rateLimit || raw;
  const five = findWindow(rateLimit, ["primary_window", "primaryWindow", "short_window", "shortWindow", "five_hour_window", "fiveHourWindow", "5h", "primary"], 18000);
  const week = findWindow(rateLimit, ["secondary_window", "secondaryWindow", "weekly_window", "weeklyWindow", "week_window", "weekWindow", "weekly", "secondary"], 604800);
  if (!five) throw new Error("额度响应缺少 5 小时窗口；可能是接口格式已变化。");
  return { source: "本机 Codex 登录状态", five, week, fetchedAt: new Date().toISOString() };
}
module.exports = { getCodexUsage };
