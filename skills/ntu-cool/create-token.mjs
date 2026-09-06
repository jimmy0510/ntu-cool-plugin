#!/usr/bin/env node
// =============================================
// create-token.mjs — 用現有的 cookie 換一把 NTU COOL 存取權杖
//
// 為什麼需要：cookie 一登出就失效，權杖不會。
//
// ⚠️ 重要事實（2026-09-05 實測）：
//    台大把 /profile/settings 上「產生權杖」的**介面**藏起來了，
//    但 POST /api/v1/users/self/tokens 這個 **API 沒有關**，照樣能建。
//    所以不要因為設定頁找不到就斷定「台大不支援權杖」。
//
// ⚠️ 這把權杖等同你的 NTU COOL 帳號。任何拿到它的人都能以你的身分讀資料、
//    交作業。只放在自己電腦上，不要貼進對話、不要 commit、不要給別人。
//    不用了就刪：node create-token.mjs --list / --delete <id>
//
// 用法：
//   node create-token.mjs --import                                # 從剪貼簿匯入已建好的權杖（最少步驟）
//   node create-token.mjs --from-clipboard --save                 # 從剪貼簿讀 cookie 換權杖
//   NTU_COOL_COOKIE='整串 cookie' node create-token.mjs --save    # 用環境變數給 cookie
//   NTU_COOL_COOKIE='整串 cookie' node create-token.mjs           # 只建，不印出值
//   NTU_COOL_COOKIE='整串 cookie' node create-token.mjs --print   # 印出權杖值到 stdout
//   NTU_COOL_TOKEN='...' node create-token.mjs --list             # 列出已建立的權杖
//   NTU_COOL_TOKEN='...' node create-token.mjs --delete <id>      # 刪除某一把
//
// 預設 expires_at 為空字串 = 永不過期。要設期限：NTU_COOL_TOKEN_EXPIRES='2027-01-31'
// =============================================
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.NTU_COOL_URL || 'https://cool.ntu.edu.tw';
const CONFIG_DIR = process.env.NTU_COOL_HOME || join(homedir(), '.ntu-cool');
const TOKEN_FILE = join(CONFIG_DIR, 'token.env');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const parse = (text) => JSON.parse(text.replace(/^while\(1\);/, '')); // cookie 認證時 Canvas 會加 while(1); 前綴

// ── 管理既有權杖：這兩個動作用權杖自己就能做，不需要 cookie ──
if (has('--list') || has('--delete')) {
  const token = process.env.NTU_COOL_TOKEN?.trim();
  if (!token) {
    console.error('--list / --delete 需要 NTU_COOL_TOKEN。');
    console.error(`若已存過，先載入：node --env-file="${TOKEN_FILE}" create-token.mjs --list`);
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (has('--delete')) {
    const id = argv[argv.indexOf('--delete') + 1];
    if (!id) { console.error('用法：--delete <token id>'); process.exit(1); }
    const res = await fetch(`${BASE}/api/v1/users/self/tokens/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { console.error(`刪除失敗（HTTP ${res.status}）`); process.exit(1); }
    console.log(`✅ 已刪除權杖 ${id}。若刪掉的是自己正在用的那把，記得清掉 ${TOKEN_FILE}。`);
  } else {
    const res = await fetch(`${BASE}/api/v1/users/self/tokens`, { headers });
    if (!res.ok) { console.error(`查詢失敗（HTTP ${res.status}）`); process.exit(1); }
    for (const t of parse(await res.text()))
      console.log(`id: ${t.id}｜用途: ${t.purpose}｜建立: ${t.created_at}｜到期: ${t.expires_at ?? '永不過期'}`);
  }
  process.exit(0);
}

// ── 從剪貼簿匯入一把「已經建好」的權杖 ──
// 使用者在瀏覽器 Console 跑一行程式建好權杖、複製起來，這裡驗證後存檔。
// 比叫他從 Network 分頁挖整行 Cookie 少一半步驟，也不會選錯範圍。
if (has('--import')) {
  let tok;
  try {
    tok = readClipboard().trim().replace(/^['"]|['"]$/g, '');
  } catch (e) {
    console.error('讀不到剪貼簿：', e.message);
    process.exit(1);
  }
  if (!tok || /\s/.test(tok)) {
    console.error('剪貼簿裡不像是一把權杖（空的，或含有空白／換行）。');
    console.error('請只複製 Console 印出來的那一串，前後不要帶引號或其他文字。');
    process.exit(1);
  }
  const res = await fetch(`${BASE}/api/v1/users/self`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`這把權杖用不了（HTTP ${res.status}）。請重新在 Console 建一把再複製。`);
    process.exit(1);
  }
  const me = parse(await res.text());
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, `NTU_COOL_TOKEN='${tok}'\n`, { mode: 0o600 });
  try { chmodSync(TOKEN_FILE, 0o600); } catch {}
  console.error(`✅ 權杖有效，帳號：${me.name ?? me.id}`);
  console.error(`   已存到 ${TOKEN_FILE}。這個檔案等同你的帳號密碼，不要外流。`);
  console.error('   請清空剪貼簿（隨便複製別的東西即可）。');
  process.exit(0);
}

// ── 從剪貼簿讀 cookie ──
// 為什麼要這個：使用者只要「複製」就好，不必開終端機、不必在指令中間找地方替換，
// cookie 也不必經過任何對話或聊天紀錄。整個流程只剩下複製一個動作。
function readClipboard() {
  const cmd = {
    darwin: ['pbpaste', []],
    win32: ['powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw']],
    linux: ['xclip', ['-selection', 'clipboard', '-o']],
  }[process.platform];
  if (!cmd) throw new Error(`不支援的作業系統：${process.platform}`);
  return execFileSync(cmd[0], cmd[1], { encoding: 'utf8', maxBuffer: 1 << 20 });
}

// ── 建立新權杖：需要一份還有效的 cookie ──
let raw;
if (has('--from-clipboard')) {
  try {
    raw = readClipboard();
  } catch (e) {
    console.error('讀不到剪貼簿：', e.message);
    if (process.platform === 'linux') console.error('Linux 需要先安裝 xclip。');
    console.error('改用環境變數也可以：NTU_COOL_COOKIE=\'整串 cookie\' node create-token.mjs --save');
    process.exit(1);
  }
} else {
  raw = process.env.NTU_COOL_COOKIE;
}

// 使用者常會連 `Cookie:` 標頭名稱一起複製，瀏覽器也可能在顯示時折行。
const cookie = raw?.replace(/^\s*Cookie\s*:\s*/i, '').replace(/[\r\n]+/g, '').trim();

if (!cookie) {
  console.error(has('--from-clipboard')
    ? '剪貼簿是空的，或裡面不是 cookie。請重新複製 NTU COOL 的 Cookie 那一行再試。'
    : '需要一份還有效的 NTU_COOL_COOKIE 才能建權杖。');
  console.error('取得方式：登入 cool.ntu.edu.tw → 開發者工具 → 網路/Network → 點任一請求 →');
  console.error('          要求標頭/Request Headers → 複製 Cookie: 後面「整行」。');
  process.exit(1);
}

const csrfMatch = cookie.match(/_csrf_token=([^;]+)/);
if (!csrfMatch) {
  console.error('cookie 裡沒有 _csrf_token，請複製「整行」Cookie（不能只複製 session 那一段）。');
  process.exit(1);
}

const res = await fetch(`${BASE}/api/v1/users/self/tokens`, {
  method: 'POST',
  headers: {
    Cookie: cookie,
    'X-CSRF-Token': decodeURIComponent(csrfMatch[1]),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({
    token: {
      purpose: process.env.NTU_COOL_TOKEN_PURPOSE || 'claude-code',
      expires_at: process.env.NTU_COOL_TOKEN_EXPIRES || '', // 空字串 = 永不過期
    },
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`建立失敗（HTTP ${res.status}）：${text.slice(0, 300).replace(/\s+/g, ' ')}`);
  if (res.status === 401 || res.status === 403) console.error('多半是 cookie 已失效，請重新複製。');
  process.exit(1);
}

const token = parse(text);
if (!token.visible_token) {
  console.error('回應裡沒有權杖值：', JSON.stringify(token).slice(0, 300));
  process.exit(1);
}

if (has('--save')) {
  // 自己寫檔而不是叫使用者用 `>> file`：PowerShell 的重導向會寫成 UTF-16，
  // Node 的 --env-file 讀不了。順便把權限收成只有自己能讀。
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, `NTU_COOL_TOKEN='${token.visible_token}'\n`, { mode: 0o600 });
  try { chmodSync(TOKEN_FILE, 0o600); } catch {} // Windows 上是 no-op，忽略
  console.error(`✅ 權杖已存到 ${TOKEN_FILE}（id: ${token.id}｜到期: ${token.expires_at ?? '永不過期'}）`);
  console.error('   權杖值沒有印在畫面上。這個檔案等同你的帳號密碼，不要外流、不要 commit。');
} else if (has('--print')) {
  console.log(`NTU_COOL_TOKEN='${token.visible_token}'`); // 給 shell 導向用
} else {
  console.error(`✅ 已建立權杖　id: ${token.id}｜用途: ${token.purpose}｜到期: ${token.expires_at ?? '永不過期'}`);
  console.error('   權杖值沒有印出來。要存起來請改用 --save（推薦），或用 --print 自行導向。');
  console.error('   Canvas 只在建立時回傳一次，弄丟就刪掉重建（--list / --delete <id>）。');
}
