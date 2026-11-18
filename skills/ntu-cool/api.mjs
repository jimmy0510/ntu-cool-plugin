#!/usr/bin/env node
// api.mjs — 用存著的權杖讀 NTU COOL（只做 GET，不會改任何東西）
//   node api.mjs 'courses?enrollment_state=active&per_page=100'
// 路徑開頭不要加 /：Windows 的 Git Bash 會把 /xxx 改寫成檔案路徑。
// 印出 JSON（陣列會自動翻完所有頁）。權杖失效印「已失效」並以 2 結束。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.NTU_COOL_URL || 'https://cool.ntu.edu.tw';
const TOKEN_FILE = join(process.env.NTU_COOL_HOME || join(homedir(), '.ntu-cool'), 'token.env');
if (!process.env.NTU_COOL_TOKEN?.trim() && existsSync(TOKEN_FILE)) {
  try { process.loadEnvFile(TOKEN_FILE); } catch {}
}
const token = process.env.NTU_COOL_TOKEN?.trim();
const arg = process.argv[2];
if (!arg || /^[A-Za-z]:|^\/\//.test(arg)) { console.error("用法：node api.mjs 'courses?per_page=100'（開頭不要加 /）"); process.exit(1); }
const path = arg.startsWith('/') ? arg : '/' + arg;
if (!token) { console.log('未設定'); process.exit(2); }

const out = [];
let url = BASE + '/api/v1' + path;
while (url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (r.status === 401) { console.log('已失效'); process.exit(2); }
  const text = (await r.text()).replace(/^while\(1\);/, '');
  if (!r.ok) { console.error(`HTTP ${r.status}: ${text.slice(0, 200)}`); process.exit(1); }
  const data = JSON.parse(text);
  if (!Array.isArray(data)) { console.log(JSON.stringify(data)); process.exit(0); }
  out.push(...data);
  url = (r.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1];
}
console.log(JSON.stringify(out));
