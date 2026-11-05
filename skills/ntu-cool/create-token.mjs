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
//   node create-token.mjs --status                                # 檢查存著的權杖還能不能用（第一行印 已設定／未設定／已失效）
//   node create-token.mjs --delete [id]                           # 刪除權杖（不給 id 就刪存著的那把）
//
// 建立時送 expires_at 空字串 = 要求不設到期日，但**學校伺服器不一定照辦**：
// 2026-11 實測，11/2 建的權杖到 11/5 就回 Invalid access token。所以不要假設權杖是永久的，
// 一律以 --status 的結果為準，失效就重跑設定。要自己設期限：NTU_COOL_TOKEN_EXPIRES='2027-01-31'
// =============================================
import { mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.NTU_COOL_URL || 'https://cool.ntu.edu.tw';
const CONFIG_DIR = process.env.NTU_COOL_HOME || join(homedir(), '.ntu-cool');
const TOKEN_FILE = join(CONFIG_DIR, 'token.env');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const parse = (text) => JSON.parse(text.replace(/^while\(1\);/, '')); // cookie 認證時 Canvas 會加 while(1); 前綴

// Windows 上 Node 在 fetch 之後呼叫 process.exit() 會當掉（libuv assertion），
// 所以全部改成 return 結束碼，讓程式自然結束。
async function main() {

  const expiryText = (e) => e || '伺服器沒回報到期日（不代表永久，學校仍可能提前作廢）';

  // 存檔時連 id 和到期日一起記下，之後 --status / --delete 才知道是哪一把。
  // （Canvas 沒有「列出我的權杖」的 API：GET /users/self/tokens 在 NTU COOL 是 404。）
  function saveToken(tok, id, expiresAt) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const lines = [`NTU_COOL_TOKEN='${tok}'`];
    if (id) lines.push(`NTU_COOL_TOKEN_ID='${id}'`);
    if (expiresAt) lines.push(`NTU_COOL_TOKEN_EXPIRES_AT='${expiresAt}'`);
    // 自己寫檔而不是叫使用者用 `>> file`：PowerShell 的重導向會寫成 UTF-16，Node 讀不了。
    writeFileSync(TOKEN_FILE, lines.join('\n') + '\n', { mode: 0o600 });
    try { chmodSync(TOKEN_FILE, 0o600); } catch {} // Windows 上是 no-op，忽略
  }

  // ── 管理既有權杖：用權杖自己就能做，不需要 cookie。--list 是舊名稱，等同 --status ──
  if (has('--status') || has('--list') || has('--delete')) {
    if (!process.env.NTU_COOL_TOKEN?.trim() && existsSync(TOKEN_FILE)) {
      try { process.loadEnvFile(TOKEN_FILE); } catch {}
    }
    const token = process.env.NTU_COOL_TOKEN?.trim();
    if (!token) {
      console.log('未設定');
      return has('--delete') ? 1 : 0;
    }
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const storedId = process.env.NTU_COOL_TOKEN_ID;

    if (has('--delete')) {
      const next = argv[argv.indexOf('--delete') + 1];
      const id = next && !next.startsWith('--') ? next : storedId;
      if (!id) { console.error('不知道要刪哪一把：token.env 沒記 id，請用 --delete <id>'); return 1; }
      const res = await fetch(`${BASE}/api/v1/users/self/tokens/${id}`, { method: 'DELETE', headers });
      if (!res.ok) { console.error(`刪除失敗（HTTP ${res.status}）`); return 1; }
      console.log(`✅ 已刪除權杖 ${id}。若刪掉的是自己正在用的那把，記得清掉 ${TOKEN_FILE}。`);
      return 0;
    }

    const me = await fetch(`${BASE}/api/v1/users/self`, { headers });
    if (me.status === 401) {
      console.log('已失效');
      console.error('存著的權杖已經不能用了（過期或被學校作廢），要重跑設定建一把新的。');
      return 0;
    }
    if (!me.ok) { console.error(`查詢失敗（HTTP ${me.status}），可能是 NTU COOL 暫時連不上`); return 1; }
    let expiresAt = process.env.NTU_COOL_TOKEN_EXPIRES_AT;
    if (storedId) {
      const t = await fetch(`${BASE}/api/v1/users/self/tokens/${storedId}`, { headers });
      if (t.ok) expiresAt = parse(await t.text()).expires_at ?? expiresAt;
    }
    console.log('已設定');
    console.error(`帳號：${parse(await me.text()).name}｜權杖 id：${storedId ?? '未記錄'}｜到期：${expiryText(expiresAt)}`);
    return 0;
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
      return 1;
    }
    if (!tok || /\s/.test(tok)) {
      console.error('剪貼簿裡不像是一把權杖（空的，或含有空白／換行）。');
      console.error('請只複製 Console 印出來的那一串，前後不要帶引號或其他文字。');
      return 1;
    }
    const res = await fetch(`${BASE}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`這把權杖用不了（HTTP ${res.status}）。請重新在 Console 建一把再複製。`);
      return 1;
    }
    const me = parse(await res.text());
    saveToken(tok);
    console.error(`✅ 權杖有效，帳號：${me.name ?? me.id}`);
    console.error(`   已存到 ${TOKEN_FILE}。這個檔案等同你的帳號密碼，不要外流。`);
    console.error('   請清空剪貼簿（隨便複製別的東西即可）。');
    return 0;
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
      return 1;
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
    return 1;
  }

  const csrfMatch = cookie.match(/_csrf_token=([^;]+)/);
  if (!csrfMatch) {
    console.error('cookie 裡沒有 _csrf_token，請複製「整行」Cookie（不能只複製 session 那一段）。');
    return 1;
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
    return 1;
  }

  const token = parse(text);
  if (!token.visible_token) {
    console.error('回應裡沒有權杖值：', JSON.stringify(token).slice(0, 300));
    return 1;
  }

  if (has('--save')) {
    saveToken(token.visible_token, token.id, token.expires_at);
    console.error(`✅ 權杖已存到 ${TOKEN_FILE}（id: ${token.id}｜到期: ${expiryText(token.expires_at)}）`);
    console.error('   權杖值沒有印在畫面上。這個檔案等同你的帳號密碼，不要外流、不要 commit。');
  } else if (has('--print')) {
    console.log(`NTU_COOL_TOKEN='${token.visible_token}'`); // 給 shell 導向用
  } else {
    console.error(`✅ 已建立權杖　id: ${token.id}｜用途: ${token.purpose}｜到期: ${expiryText(token.expires_at)}`);
    console.error('   權杖值沒有印出來。要存起來請改用 --save（推薦），或用 --print 自行導向。');
    console.error('   Canvas 只在建立時回傳一次，弄丟就刪掉重建（--delete <id>）。');
  }
  return 0;
}

process.exitCode = await main();
