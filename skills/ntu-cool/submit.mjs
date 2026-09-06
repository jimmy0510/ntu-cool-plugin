#!/usr/bin/env node
// =============================================
// submit.mjs — 把本機檔案繳交到 NTU COOL 的作業（獨立腳本，不需任何套件）
//
// 用法：
//   node submit.mjs <course_id> <assignment_id> <檔案路徑> [--dry-run]
//   node submit.mjs --url <作業網址> <檔案路徑> [--dry-run]
//
// 認證（依序尋找，權杖優先）：
//   1. NTU_COOL_TOKEN 環境變數
//   2. ~/.ntu-cool/token.env（由 create-token.mjs --save 建立）
//   3. NTU_COOL_COOKIE 環境變數（備援，登出即失效，且必須含 _csrf_token）
//
// ⚠️ 這會把作業真的交到學校系統，不可逆。
//    除非使用者已明確要求繳交這個檔案到這份作業，否則先用 --dry-run。
// =============================================
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.NTU_COOL_URL || 'https://cool.ntu.edu.tw';
const TOKEN_FILE = path.join(process.env.NTU_COOL_HOME || path.join(homedir(), '.ntu-cool'), 'token.env');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const args = argv.filter((a) => a !== '--dry-run');

let courseId, assignmentId, filePath;
if (args[0] === '--url') {
  const m = String(args[1]).match(/\/courses\/(\d+)\/assignments\/(\d+)/);
  if (!m) {
    console.error('看不懂這個作業網址，需要形如 /courses/<id>/assignments/<id>');
    process.exit(1);
  }
  [, courseId, assignmentId] = m;
  filePath = args[2];
} else {
  [courseId, assignmentId, filePath] = args;
}

if (!courseId || !assignmentId || (!dryRun && !filePath)) {
  console.error('用法：node submit.mjs <course_id> <assignment_id> <檔案路徑> [--dry-run]');
  console.error('   或：node submit.mjs --url <作業網址> <檔案路徑> [--dry-run]');
  process.exit(1);
}
if (!dryRun && !fs.existsSync(filePath)) {
  console.error(`找不到檔案：${filePath}`);
  process.exit(1);
}

// 權杖沒設在環境變數就從設定檔載入。值只留在這支腳本裡，不會回到對話。
if (!process.env.NTU_COOL_TOKEN?.trim() && fs.existsSync(TOKEN_FILE)) {
  try { process.loadEnvFile(TOKEN_FILE); } catch { /* 檔案壞了就當作沒有，往下走 cookie */ }
}
const token = process.env.NTU_COOL_TOKEN?.trim();
const cookie = process.env.NTU_COOL_COOKIE?.trim();

if (!token && !cookie) {
  console.error('找不到認證。請先建一把權杖：');
  console.error("  NTU_COOL_COOKIE='整串 cookie' node create-token.mjs --save");
  console.error(`（會存到 ${TOKEN_FILE}）`);
  process.exit(1);
}

// 權杖用 Bearer，不需要 CSRF；cookie 的寫入請求則要附 X-CSRF-Token
// （值取自 _csrf_token 這個 cookie，URL 解碼後）。
let readHeaders, writeHeaders;
if (token) {
  readHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  writeHeaders = { ...readHeaders };
} else {
  const csrfMatch = cookie.match(/_csrf_token=([^;]+)/);
  if (!csrfMatch) {
    console.error('cookie 裡沒有 _csrf_token，請重新複製「整行」Cookie，或改用權杖');
    process.exit(1);
  }
  readHeaders = { Cookie: cookie, Accept: 'application/json' };
  writeHeaders = { ...readHeaders, 'X-CSRF-Token': decodeURIComponent(csrfMatch[1]) };
}

// Canvas 以 cookie 認證時會在 JSON 前加上 while(1); 防劫持，解析前要剝掉
const parse = (text) => JSON.parse(text.replace(/^while\(1\);/, ''));

async function canvas(method, apiPath, body) {
  const res = await fetch(`${BASE}/api/v1${apiPath}`, {
    method,
    headers: method === 'POST' ? { ...writeHeaders, 'Content-Type': 'application/json' } : readHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new Error(token
      ? '權杖無效或已被刪除，請重新產生一把（create-token.mjs --save）'
      : 'cookie 已失效（多半是登出過），請重新複製整行 Cookie');
  }
  if (!res.ok) throw new Error(`NTU COOL 回應 ${res.status}：${text.slice(0, 300)}`);
  return parse(text);
}

const submissionPath = `/courses/${courseId}/assignments/${assignmentId}/submissions`;

// ── 先看清楚要交的是哪一份作業，能不能交 ──
const assignment = await canvas('GET', `/courses/${courseId}/assignments/${assignmentId}?include[]=submission`);
const types = assignment.submission_types ?? [];
const closed = Boolean(
  assignment.locked_for_user || (assignment.lock_at && new Date(assignment.lock_at) < new Date())
);

console.log(`作業：${assignment.name}`);
console.log(`截止：${assignment.due_at || '未設定'}`);
console.log(`可接受的繳交方式：${types.join('、') || '無'}`);
console.log(`已關閉：${closed ? '是' : '否'}`);
console.log(`已繳交：${assignment.submission?.submitted_at || '尚未'}`);

if (dryRun) {
  console.log('\n--dry-run：只檢查，沒有送出任何東西。');
} else {
  if (closed) {
    console.error('\n這份作業已關閉，不能再繳交。');
    process.exit(1);
  }
  if (!types.includes('online_upload')) {
    console.error('\n這份作業不接受上傳檔案，請改用其他方式繳交。');
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  console.log(`\n準備繳交：${fileName}（${(buffer.length / 1024).toFixed(1)} KB）`);

  // ── Canvas 的檔案繳交是三段式流程（官方 File Upload Workflow）──

  // 第 1 步：跟 Canvas 要一個上傳位置
  const slot = await canvas('POST', `${submissionPath}/self/files`, {
    name: fileName,
    size: buffer.length,
    on_duplicate: 'rename',
  });

  // 第 2 步：把檔案 POST 到那個位置。這一步不能帶 Canvas 的 cookie 或 CSRF 標頭，
  //         upload_params 的欄位必須排在 file 之前。
  const form = new FormData();
  for (const [k, v] of Object.entries(slot.upload_params || {})) form.append(k, v);
  form.append('file', new Blob([new Uint8Array(buffer)]), fileName);

  const upload = await fetch(slot.upload_url, { method: 'POST', body: form, redirect: 'follow' });
  if (!upload.ok) throw new Error(`上傳檔案失敗（HTTP ${upload.status}）`);
  const uploaded = parse(await upload.text());
  if (!uploaded.id) throw new Error('上傳後沒有拿到檔案 ID');

  // 第 3 步：用拿到的 file_id 建立 submission
  const submission = await canvas('POST', submissionPath, {
    submission: { submission_type: 'online_upload', file_ids: [uploaded.id] },
  });

  console.log(`\n✅ 已繳交：${submission.submitted_at}`);
  console.log(`   ${BASE}/courses/${courseId}/assignments/${assignmentId}`);
}
