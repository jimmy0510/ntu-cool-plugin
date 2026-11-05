---
name: ntu-cool
description: "Use this skill whenever the user asks you to navigate NTU COOL (cool.ntu.edu.tw),   Taiwan University's online learning platform. Trigger this skill when the user asks   you to find course materials, assignments, announcements, grades, or any other content   on NTU COOL. Also trigger when the user says things like \"去 NTU COOL 找...\", \"幫我看   cool 上面的...\", \"進 NTU COOL...\", or any request involving browsing, retrieving, or   interacting with content on the NTU COOL platform. Always use this skill before   attempting to navigate the site."
---

# NTU COOL Navigation Skill

NTU COOL 是台大的線上學習系統（LMS），網址 https://cool.ntu.edu.tw，底層是 Canvas LMS。

> **關於免責與「請勿外傳」告知**：那段（含〈開發者的話〉）由 `ntu-setup` 在設定時輸出，
> **本文件不要再輸出一次**。沒設定過的人一定會走到 setup，所以每個人都會看到剛好一次。

使用者若提到要分享、轉發、給同學、上傳這個 plugin，**主動講**：
**未經開發者同意請勿外傳。** 萬一不是開發者朋友的人出了資料外洩，開發者控制不了，卻可能要負連帶責任。

## 做法：在使用者已登入的 Chrome 分頁裡打 Canvas API

**不用存取權杖。** 台大會把學生自建的權杖作廢（2026-11 實測 3 天內就失效），
所以本 plugin 改成：用 Claude in Chrome 開一個 NTU COOL 分頁，
用 `javascript_tool` 在那個分頁裡 `fetch('/api/v1/...')`。請求帶的是使用者自己的登入狀態，
不需要任何憑證存在本機，也沒有東西會過期 —— 只要他在 Chrome 裡是登入的。

- **不要點來點去、不要截圖讀資料。** 資料一律用 API 拿 JSON，在 JS 裡就先挑好欄位再回傳，
  不要把整包回應丟回對話。
- 開自己的新分頁做事，**不要動使用者原本的分頁**；做完把自己開的分頁關掉。
- 絕對不要把 `document.cookie` 或 `_csrf_token` 的值回傳到對話裡。

## 🔴 第一件事：確認 Chrome 能用、而且登入了

1. Claude in Chrome 的工具（`mcp__claude-in-chrome__*`）沒有載入或連不上 →
   用 Skill 工具呼叫 `ntu-cool:ntu-setup`，它會帶使用者裝好擴充功能。
   **不要**叫使用者自己去打 `/ntu-setup`。
2. `tabs_context_mcp` → `tabs_create_mcp` 開新分頁 → `navigate` 到 `https://cool.ntu.edu.tw/`。
3. 用 `javascript_tool` 跑：
   ```js
   location.pathname.startsWith('/login') ? '未登入' : '已登入'
   ```
   - `未登入` → 嘗試用 Chrome 密碼管理員半自動登入（見下方〈半自動登入〉），
     成功就直接往下做；失敗才請使用者自己在分頁裡登入，他說好了再重跑這一步。
   - `已登入` → 往下做。

### 半自動登入

頁面跳到 ADFS 登入頁（`adfs.ntu.edu.tw`）時，嘗試讓 Chrome 的密碼管理員幫忙：

1. 用 `find` 找帳號輸入欄（關鍵字 `userNameInput` 或 `帳號` 或 `Username`）。
2. 用 `computer` 點擊那個欄位 → Chrome 密碼管理員會跳出已儲存帳號的建議清單。
3. 用 `find` 或 `read_page` 找到建議清單裡的帳號，用 `computer` 點擊它。
   Chrome 會自動填入帳號和密碼。
4. 跟使用者說「帳密已經填好了，請你按登入」。**不要幫他按登入按鈕。**
5. 他按完後，頁面會跳回 `cool.ntu.edu.tw`，重跑登入判斷確認 `已登入`。

如果第 2 步沒有跳出建議（使用者沒存過密碼），或找不到欄位，就跳過整段，
直接請使用者自己在分頁裡登入。不要卡在這裡重試。

設定或登入完成後，**回頭把他原本問的事做完**，不要讓他重問一次。

> **備援（權杖）**：要寫後端排程、或使用者明確要本機腳本時，才用同目錄的 `create-token.mjs` / `submit.mjs`。
> 先跑 `node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --status`：
> `已設定` 就能用 `node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/submit.mjs" --url <作業網址> <檔案> --dry-run`；
> `未設定`／`已失效` → 照下面〈從 Chrome 自動建權杖〉重建，**不用叫使用者複製 cookie**。
> **不要 `cat` `~/.ntu-cool/token.env`**，權杖值不能進對話。

## 從 Chrome 自動建權杖（權杖備援失效時用）

學校會作廢權杖，所以失效時就自動重建。使用者只要在 Chrome 登入著，什麼都不用做：

1. **背景**啟動接收端（`run_in_background`），讀它的輸出拿到第一行 `PORT=… NONCE=…`：
   ```bash
   node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --receive
   ```
   它只收一次、3 分鐘後自動關閉，只聽 `127.0.0.1`，只收來自 cool.ntu.edu.tw 且帶對 NONCE 的請求。
2. 在已登入的 NTU COOL 分頁**先 ping**（把 PORT、NONCE 換成上一步的值）：
   ```js
   await fetch('http://127.0.0.1:PORT/ping?n=NONCE', { signal: AbortSignal.timeout(30000) })
     .then(r => r.text()).catch(e => 'ERR ' + e.name)
   ```
   - `pong` → 往下。
   - 逾時或 `ERR` → Chrome 多半在網址列問「**允許存取這部裝置上的其他應用程式和服務**」（區域網路權限）。
     請使用者按「允許」，再 ping 一次。**沒 pong 之前不要建權杖**，否則建了送不到，會在學校那邊留一把沒用的。
3. 建權杖並直接送到接收端。**最後回傳的物件絕不能含 `visible_token`**：
   ```js
   const csrf = decodeURIComponent((document.cookie.match(/(?:^|; )_csrf_token=([^;]+)/) || [])[1] || '');
   const r = await fetch('/api/v1/users/self/tokens', { method: 'POST',
     headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
     body: JSON.stringify({ token: { purpose: 'claude-code', expires_at: '' } }) });
   const t = JSON.parse((await r.text()).replace(/^while\(1\);/, ''));
   const s = r.ok && t.visible_token && await fetch('http://127.0.0.1:PORT/token?n=NONCE', {
     method: 'POST', headers: { 'Content-Type': 'text/plain' },
     body: JSON.stringify({ token: t.visible_token, id: t.id, expires_at: t.expires_at }) });
   ({ createStatus: r.status, id: t.id ?? null, saved: s ? await s.text() : null })
   ```
4. 背景程式印出 `✅ 已存到 …` 並結束就完成了，再跑一次 `--status` 確認是 `已設定`。

## API 輔助函式

每次呼叫 `javascript_tool` 都把這段放在最前面（每次執行是獨立的，變數不會留著）：

```js
const cool = async (path, { method = 'GET', body } = {}) => {
  if (location.origin !== 'https://cool.ntu.edu.tw') throw new Error('先 navigate 到 cool.ntu.edu.tw');
  const csrf = decodeURIComponent((document.cookie.match(/(?:^|; )_csrf_token=([^;]+)/) || [])[1] || '');
  const out = [];
  let url = '/api/v1' + path;
  while (url) {
    const r = await fetch(url, {
      method,
      headers: { Accept: 'application/json',
        ...(method !== 'GET' && { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }) },
      body: body && JSON.stringify(body),
    });
    if (r.status === 401) throw new Error('未登入或登入逾時，請使用者在分頁裡重新登入');
    const text = (await r.text()).replace(/^while\(1\);/, '');
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    if (method !== 'GET' || !Array.isArray(data)) return data;
    out.push(...data);                                     // 自動翻頁
    url = (r.headers.get('Link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1];
  }
  return out;
};
```

範例（最後一個運算式就是回傳值，記得只挑需要的欄位）：

```js
// …貼上 cool …
(await cool('/courses?enrollment_state=active&per_page=100'))
  .map(c => ({ id: c.id, name: c.name, code: c.course_code }))
```

## 常用 API 端點

| 要什麼 | 端點 |
|---|---|
| 我的課程 | `GET /courses?enrollment_state=active&per_page=100` |
| 課程作業 | `GET /courses/{c}/assignments?per_page=100` |
| 單一作業（含自己的繳交狀態） | `GET /courses/{c}/assignments/{a}?include[]=submission` |
| 公告 | `GET /announcements?context_codes[]=course_{c}` |
| 成績 | `GET /courses/{c}/enrollments?user_id=self` |
| 課程檔案 | `GET /courses/{c}/files?per_page=100` |
| 模組與內容 | `GET /courses/{c}/modules?include[]=items` |
| 待辦／即將到期 | `GET /users/self/todo`、`GET /users/self/upcoming_events` |

（以上都接在 `cool()` 後面，不用寫 `/api/v1`。）

## 課號快取（使用者的本機資料，不在 plugin 裡）

`~/.ntu-cool/courses.json`，不是機密，可以讀寫：

```json
{ "updatedAt": "2026-09-07", "courses": [ { "id": 12345, "name": "課程全名", "code": "COURSE1234-01" } ] }
```

先讀這個檔；沒有、或找不到使用者要的課，就打「我的課程」現查，再用 Write 寫回去。
不要把任何人的課號寫進本 SKILL.md。

## 繳交作業（上傳本機檔案）

繳交是**不可逆的對外動作**：

1. **先檢查、給他看**，不送出任何東西：
   ```js
   // …貼上 cool …
   const a = await cool('/courses/{c}/assignments/{a}?include[]=submission');
   ({ name: a.name, due: a.due_at, types: a.submission_types,
      closed: !!(a.locked_for_user || (a.lock_at && new Date(a.lock_at) < new Date())),
      submitted: a.submission?.submitted_at || null })
   ```
   - `closed` 為 true → 已關閉，不能交。
   - `types` 不含 `online_upload` → 不接受上傳檔案（`none`／`not_graded`／`on_paper` 是老師的成績欄位）。
   - `submitted` 有值 → 已經交過，再交會變成新的一次繳交，要跟他講。
2. **等使用者明確說「交」才往下。** 要交哪個檔案由他指定，不要順便交別的。
3. 在分頁裡塞一個檔案欄位：
   ```js
   const i = document.createElement('input'); i.type = 'file'; i.id = 'claude-upload';
   document.body.append(i); 'ok'
   ```
4. 用 `find` 找到那個 `#claude-upload` 拿 ref，再用 `file_upload` 把本機檔案放進去
   （**不要點它**，點了會跳出你看不到的檔案選擇視窗；單次上限 10 MB）。
5. 跑三段式上傳：
   ```js
   // …貼上 cool …
   const C = {c}, A = {a};
   const f = document.getElementById('claude-upload').files[0];
   const slot = await cool(`/courses/${C}/assignments/${A}/submissions/self/files`,
     { method: 'POST', body: { name: f.name, size: f.size, on_duplicate: 'rename' } });
   const form = new FormData();
   for (const [k, v] of Object.entries(slot.upload_params || {})) form.append(k, v); // 要排在 file 之前
   form.append('file', f, f.name);
   const up = await fetch(slot.upload_url, { method: 'POST', body: form });
   const file = JSON.parse((await up.text()).replace(/^while\(1\);/, ''));
   const sub = await cool(`/courses/${C}/assignments/${A}/submissions`,
     { method: 'POST', body: { submission: { submission_type: 'online_upload', file_ids: [file.id] } } });
   document.getElementById('claude-upload').remove();
   ({ file: f.name, submitted_at: sub.submitted_at })
   ```
6. 把 `submitted_at` 跟作業網址 `https://cool.ntu.edu.tw/courses/{c}/assignments/{a}` 給他。

## 免登入的公開端點：行事曆摘要（iCal）

`https://cool.ntu.edu.tw/feeds/calendars/user_<祕密字串>.ics`，使用者到「行事曆 → 右下角『行事曆摘要』」複製。
不需登入、不會過期，適合寫進排程長期輪詢作業截止日（UID 形如 `event-assignment-<id>`）。
網址等同憑證，請他自己貼進本機設定檔，**不要貼進對話**。

## 介面路線（API 拿不到時才用）

| 內容 | 網址 |
|---|---|
| 課程首頁 | `https://cool.ntu.edu.tw/courses/{id}` |
| 課程模組 | `https://cool.ntu.edu.tw/courses/{id}/modules` |
| 作業 | `https://cool.ntu.edu.tw/courses/{id}/assignments` |
| 公告 | `https://cool.ntu.edu.tw/courses/{id}/announcements` |
| 成績 | `https://cool.ntu.edu.tw/courses/{id}/grades` |
| 檔案 | `https://cool.ntu.edu.tw/courses/{id}/files` |
| 測驗 | `https://cool.ntu.edu.tw/courses/{id}/quizzes` |
| 媒體庫（課程錄影） | 課程左側次選單「媒體庫 Media Gallery」 |

讀頁面用 `get_page_text`，不要截圖。介面可能是中文或英文。

檔案下載網址：`https://cool.ntu.edu.tw/files/{file_id}/download?download_frd=1`。
批次下載（**先取得使用者同意**）：

```javascript
const files = [{ name: "filename.pdf", url: "https://cool.ntu.edu.tw/files/{file_id}/download?download_frd=1" }];
for (const file of files) {
  const blob = await (await fetch(file.url)).blob();
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  await new Promise(r => setTimeout(r, 1200));
}
'done'
```

瀏覽器擋住多檔下載時，請使用者到「設定 → 隱私權 → 自動下載」允許 cool.ntu.edu.tw。

## 其他注意事項

- **非官方工具**，與台灣大學及 Instructure（Canvas）均無關聯；作者不對資料遺失、繳交錯誤、帳號問題或校規爭議負責。
- **下載**：下載任何檔案前先取得使用者明確同意。
- **課名比對**：課名模糊或找不到時，把完整課程清單給使用者確認，不要自己猜。
- 不要觸發 `alert`／`confirm`（會卡住擴充功能）。
