---
name: ntu-cool
description: "Use this skill whenever the user asks you to navigate NTU COOL (cool.ntu.edu.tw),   Taiwan University's online learning platform. Trigger this skill when the user asks   you to find course materials, assignments, announcements, grades, or any other content   on NTU COOL. Also trigger when the user says things like \"去 NTU COOL 找...\", \"幫我看   cool 上面的...\", \"進 NTU COOL...\", or any request involving browsing, retrieving, or   interacting with content on the NTU COOL platform. Always use this skill before   attempting to navigate the site."
---

# NTU COOL Navigation Skill

NTU COOL 是台大的線上學習系統（LMS），網址 https://cool.ntu.edu.tw，底層是 Canvas LMS。

> **關於免責與「請勿外傳」告知**：那段（含〈開發者的話〉）由 `ntu-setup` 在設定時輸出，
> **本文件不要再輸出一次**。沒設定過的人一定會走到 setup，所以每個人都會看到剛好一次；
> 已經設定過的人不需要每個 session 被念一遍。例外只有下面這條。

使用者若提到要分享、轉發、給同學、上傳這個 plugin，**主動講**這兩點：

1. **未經開發者同意請勿外傳。** 萬一不是開發者朋友的人出了資料外洩，
   開發者控制不了，卻可能要負連帶責任。
2. **轉發前先檢查自己的資料。** 權杖正確的位置是 `~/.ntu-cool/token.env`（在 plugin **外面**），
   只要沒動過那個設計，轉發 plugin 本身不會帶走權杖；但改過檔案的人要自己確認一遍。

## 🔴 第一件事：確認有沒有設定過，沒有就自己把設定跑起來

輸出完上面那塊之後、真正動手查任何東西之前，先跑這行：

```bash
node -e "const f=require('fs'),o=require('os'),p=require('path');console.log(f.existsSync(p.join(o.homedir(),'.ntu-cool','token.env'))?'已設定':'未設定')"
```

**印出「未設定」→ 你自己用 Skill 工具呼叫 `ntu-cool:ntu-setup`，直接把設定流程跑起來。**

- **不要**叫使用者去打 `/ntu-setup`。他不知道那是什麼，多一個要求就多一個放棄的理由。
- 只要跟他說一句「你還沒設定過，我現在帶你設定，大概一分鐘」，然後就開始。
- **不要**自己臨場拼湊設定步驟 —— `ntu-setup` 裡有完整流程（自動偵測系統、依瀏覽器
  給按鍵、找不到分頁的排障表、全程由你代跑），照它走。
- 設定完成後，**回頭把他原本問的事做完**，不要讓他重問一次。

印出「已設定」→ 正常往下做。

## ⚠️ 完整條款（你自己要遵守的細節）

**這是非官方工具，與台灣大學及 Instructure（Canvas）均無關聯。**

- 本 skill 會引導使用者建立一把 **Canvas 存取權杖**。台大把產生權杖的**介面**藏起來了，
  但 API 沒有關。這代表你是在用學校未主動提供的途徑取得憑證，**風險與後果由使用者自負**。
- **那把權杖等同帳號密碼**：拿到的人能以使用者身分讀所有課程資料、繳交作業。
  預設不設到期日，除非主動刪除否則一直有效。
- 權杖只存在本機 `~/.ntu-cool/token.env`。**絕對不要**把它印進對話、寫進程式碼、
  commit 進 git、或放進會同步到雲端的資料夾。
- 繳交作業是**不可逆的對外動作**。任何時候都要先 `--dry-run`，等使用者明確說「交」才送出。
- 作者不對任何資料遺失、繳交錯誤、帳號問題或校規爭議負責。

**🚫 散布限制：本 plugin 未經開發者同意，切勿轉發、再散布或公開發佈。轉發前務必確認自己沒有把權杖或個資留在 plugin 目錄裡。**
若使用者提到要分享給別人，請提醒這一點。

## 本 plugin 的檔案

腳本跟這份 SKILL.md 放在同一個目錄（plugin 安裝後是
`${CLAUDE_PLUGIN_ROOT}/skills/ntu-cool/`），兩支都是零依賴的 Node 腳本：

| 檔案 | 用途 |
|---|---|
| `create-token.mjs` | 用現有 cookie 換存取權杖，`--save` 直接存進設定檔；也能 `--list` / `--delete` |
| `submit.mjs` | 把本機檔案繳交到指定作業（支援 `--dry-run`）|

以下範例一律寫成 `${CLAUDE_PLUGIN_ROOT}/skills/ntu-cool/<script>`，不要寫死絕對路徑。

## 使用者的本機資料（不在 plugin 裡）

一律放在 `~/.ntu-cool/`，**不隨 plugin 更新而消失**：

| 檔案 | 內容 | 你可以讀嗎 |
|---|---|---|
| `token.env` | `NTU_COOL_TOKEN='...'` | **不可以。** 由腳本自己載入，值絕不能進到對話 |
| `courses.json` | 課號快取（見下） | 可以，這不是機密 |

`courses.json` 的格式：

```json
{
  "updatedAt": "2026-09-07",
  "courses": [
    { "id": 12345, "name": "課程全名", "code": "COURSE1234-01" }
  ]
}
```

**查課號的流程**：先讀 `~/.ntu-cool/courses.json`；沒有這個檔、或裡面找不到使用者要的課，
就打 `GET /api/v1/courses?enrollment_state=active&per_page=100` 現查，然後把結果寫回這個檔。
不要把任何人的課號寫進本 SKILL.md — 那是使用者資料，不是 plugin 內容。

## ⚠️ Shell 語法：先確認使用者在哪種 shell

**本文件的指令一律寫成 bash/zsh 語法**（macOS、Linux、Git Bash 可直接貼）。
使用者若在 **Windows PowerShell 或 cmd**，直接貼會失敗，你必須先翻譯再給他。對照表：

| bash / zsh（本文件寫法） | PowerShell | cmd |
|---|---|---|
| `$HOME` | `$env:USERPROFILE` | `%USERPROFILE%` |
| `$CLAUDE_PLUGIN_ROOT` | `$env:CLAUDE_PLUGIN_ROOT` | `%CLAUDE_PLUGIN_ROOT%` |
| `VAR='值' node x.mjs`（前綴設變數） | `$env:VAR='值'; node x.mjs` | `set VAR=值` 再另一行執行 |
| `A && B` | `A; if ($?) { B }` | `A && B` |

Windows 上另外兩個地雷：

- **不要叫使用者用 `>` 或 `>>` 寫設定檔**。PowerShell 的重導向會產生 UTF-16／帶 BOM 的檔案，
  Node 的 `--env-file` 讀不了。要寫檔就用腳本自己寫（`create-token.mjs --save`）。
- 需要跨 shell 判斷檔案存在時，用 `node -e "..."` 而不是 `test -f`。

不確定使用者在哪種 shell 就直接問，或看他貼上來的提示字元：
`PS C:\...>` 是 PowerShell，`C:\...>` 是 cmd，`$` 或 `%` 是 bash/zsh。

## 首要原則：能用程式解決就不要動使用者的瀏覽器

**在做任何事之前先問：這件事需要瀏覽器嗎？** 按這個順序往下找，停在第一個可行的：

### 1. 存取權杖打 Canvas REST API（最優先）

`Authorization: Bearer <token>`。永不過期、登出也不受影響、寫入請求不需要 CSRF。
**這是預設路線，先確認有沒有權杖再考慮其他做法。**

- 權杖已存在 `~/.ntu-cool/token.env` → `submit.mjs` 會自己載入。
  要自己打 API 就用 `node --env-file="$HOME/.ntu-cool/token.env" <你的腳本>`，
  **不要 `cat` 那個檔案**，值不能進對話。
- 還沒有權杖 → 引導使用者建立，見下方〈第一次設定〉。

> ⚠️ 台大把 `/profile/settings` 上「產生權杖」的**介面**藏起來了，
> 但 `POST /api/v1/users/self/tokens` 這個 **API 沒有關**（2026-09-05 實測可建、
> `expires_at: null`）。**不要因為設定頁找不到就告訴使用者「台大不支援權杖」。**

### 2. 免登入的公開端點

**行事曆摘要（iCal feed）**：`https://cool.ntu.edu.tw/feeds/calendars/user_<token>.ics`
使用者自己到「行事曆 → 右下角『行事曆摘要』」複製。這串網址內含祕密字串、
等同帳號憑證，**不需登入**即可讀取，因此適合寫進後端排程長期輪詢。
內容含作業截止日（UID 形如 `event-assignment-<id>`）與上課時段。
取得後請使用者自行貼進 `.env` 之類的本機設定，**不要要求他們貼進對話**。

### 3. 既有的本機程式／腳本

專案裡已經有抓取邏輯就直接跑，不要重新用瀏覽器做一次。

### 4. 整行 Cookie（權杖的備援）

登出即失效。寫入請求要附 `X-CSRF-Token`（取 `_csrf_token` cookie 的值、URL 解碼）。
所以要複製**整行** Cookie，只複製 session 那一段就只能讀不能寫。

### 5. 瀏覽器自動化（最後手段）

只有在上面全部不可行、或使用者明確要求「你操作一下我的瀏覽器」時才使用。
用瀏覽器之前，先簡短說明為什麼沒有程式解法。使用者不喜歡被接管瀏覽器。

> 共通注意：Canvas 以 **cookie** 認證時會在 JSON 前加 `while(1);` 前綴，解析前要剝掉。
> 用權杖（Bearer）則不會。

## 第一次設定（沒有權杖時走這裡）

先把上方〈使用前必讀〉的風險講清楚，確認使用者願意再繼續。

**用 Skill 工具呼叫 `ntu-cool:ntu-setup`，自己把流程跑起來**（不要叫使用者去打指令）。要點：

1. 依他的作業系統與瀏覽器告訴他怎麼開開發者工具，帶他到
   網路/Network → 任一請求 → 要求標頭/Request Headers → **複製 `Cookie:` 那一整行**
   （必須包含 `_csrf_token`）。一次只講一步，等他回覆。
2. **你自己執行**（他不用開終端機、不用貼任何東西給你）：

   ```bash
   node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --from-clipboard --save
   ```

   程式自己從剪貼簿讀 cookie、自己寫進 `~/.ntu-cool/token.env`（權限 600），
   權杖值不會出現在畫面或對話裡。成功後請他清空剪貼簿。
   > 不要叫他們用 `--print >> 檔案`：PowerShell 的重導向會寫成 UTF-16，Node 讀不了。
3. 使用者若自己把 cookie 貼進對話，不用責備，照樣用 `NTU_COOL_COOKIE='<他貼的>'`
   前綴完成設定，結束後提醒他登出再登入即可讓那份 cookie 失效（權杖不受影響）。
4. 想確認或撤銷：
   ```bash
   node --env-file="$HOME/.ntu-cool/token.env" "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --list
   node --env-file="$HOME/.ntu-cool/token.env" "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --delete <id>
   ```

## 常用 API 端點

| 要什麼 | 端點 |
|---|---|
| 我的課程 | `GET /api/v1/courses?enrollment_state=active&per_page=100` |
| 課程作業 | `GET /api/v1/courses/{c}/assignments?per_page=100` |
| 單一作業（含自己的繳交狀態） | `GET /api/v1/courses/{c}/assignments/{a}?include[]=submission` |
| 公告 | `GET /api/v1/announcements?context_codes[]=course_{c}` |
| 成績 | `GET /api/v1/courses/{c}/enrollments?user_id=self` |
| 課程檔案 | `GET /api/v1/courses/{c}/files?per_page=100` |
| 模組與內容 | `GET /api/v1/courses/{c}/modules?include[]=items` |
| 待辦／即將到期 | `GET /api/v1/users/self/todo`、`GET /api/v1/users/self/upcoming_events` |

分頁看 `Link` 標頭的 `rel="next"`。

## 繳交作業（上傳本機檔案）

用 `submit.mjs`，不需要瀏覽器、不需要任何 npm 套件。權杖會自動從
`~/.ntu-cool/token.env` 載入。

```bash
S="$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/submit.mjs"

# 先確認要交的是哪一份、能不能交（不會送出任何東西）
node "$S" --url https://cool.ntu.edu.tw/courses/<課號>/assignments/<作業號> ./報告.pdf --dry-run

# 確認無誤後才真的繳交
node "$S" --url https://cool.ntu.edu.tw/courses/<課號>/assignments/<作業號> ./報告.pdf
```

也可以直接給兩個 ID：`node submit.mjs <course_id> <assignment_id> <檔案路徑>`。

### 使用規則（重要）

1. **先跑 `--dry-run`**，把作業名稱、截止時間、可接受的繳交方式、是否已關閉印給使用者看。
2. **等使用者明確說「交」再送出**。繳交是不可逆的對外動作，不可自行判斷該不該交。
3. 不要幫使用者「順便」把找到的檔案交上去；要交哪個檔案由使用者指定。

### 運作原理（自行實作時的重點）

Canvas 的檔案繳交是三段式流程，少一段都不會成功：

| 步驟 | 端點 | 注意 |
|---|---|---|
| 1. 要上傳位置 | `POST /api/v1/courses/{c}/assignments/{a}/submissions/self/files`，body `{name, size, on_duplicate:'rename'}` | 回傳 `upload_url` 與 `upload_params` |
| 2. 送檔案 | `POST <upload_url>`（multipart） | **不可**帶 Canvas 的 cookie／CSRF；`upload_params` 的欄位要排在 `file` 之前。回傳 `{id}` |
| 3. 建立繳交 | `POST /api/v1/courses/{c}/assignments/{a}/submissions`，body `{submission:{submission_type:'online_upload', file_ids:[id]}}` | |

判斷一份作業能不能交，看 `GET /api/v1/courses/{c}/assignments/{a}?include[]=submission`：

- `locked_for_user` 為 true，或 `lock_at` 已過 → 已關閉，不能交
- `submission.submitted_at` 或 `graded_at` 有值 → 已經交過
- `submission_types` 只有 `none`／`not_graded`／`on_paper` → 那是老師的成績欄位，不是作業

### Cookie 的有效期（用 cookie 備援路線時才需要）

實測（2026-09-05）：

- `_normandy_session`、`_csrf_token` 都是 **session cookie**（沒有 Expires／Max-Age），
  瀏覽器關掉就從瀏覽器消失，但**複製出來的那個值不會因此失效**。
- Canvas 每次回應都會重新發一份 `Set-Cookie`，但**舊的值仍然有效** —
  session 資料是加密在 cookie 本身裡的，不是換一個就把舊的作廢。
- **使用者按登出會讓它失效**；重新登入會拿到全新的一組，必須重新複製。
- 長期沒有任何請求也會過期；定時輪詢反而會讓它一直活著。

所以：叫使用者「登出再登入」等於把存起來的 cookie 作廢。遇到 401／403 多半就是這個原因。
一勞永逸的解法是改用權杖。

---

## 瀏覽器路線（第 5 順位，前面都不可行才用）

### 直接用網址，不要點來點去

| 內容 | 網址 |
|---|---|
| 課程首頁 | `https://cool.ntu.edu.tw/courses/{id}` |
| 課程模組 | `https://cool.ntu.edu.tw/courses/{id}/modules` |
| 作業 | `https://cool.ntu.edu.tw/courses/{id}/assignments` |
| 公告 | `https://cool.ntu.edu.tw/courses/{id}/announcements` |
| 成績 | `https://cool.ntu.edu.tw/courses/{id}/grades` |
| 檔案 | `https://cool.ntu.edu.tw/courses/{id}/files` |
| 測驗 | `https://cool.ntu.edu.tw/courses/{id}/quizzes` |

檔案下載網址：`https://cool.ntu.edu.tw/files/{file_id}/download?download_frd=1`
進到模組頁後用 `get_page_text`（不要截圖）掃 `/files/{file_id}` 或
`/courses/{id}/modules/items/{item_id}` 連結。

### 批次下載

需要瀏覽器擴充功能的 `javascript_tool`（Claude in Chrome；沒裝的話這段做不了，
改用第 1 順位的 API 下載）。使用者必須已登入 NTU COOL：

```javascript
const files = [
  { name: "filename.pdf", url: "https://cool.ntu.edu.tw/files/{file_id}/download?download_frd=1" },
];
(async () => {
  for (const file of files) {
    const res = await fetch(file.url, { credentials: 'include' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    await new Promise(r => setTimeout(r, 1200));
  }
})();
```

瀏覽器擋住多檔下載時，請使用者到「設定 → 隱私權 → 自動下載」允許 cool.ntu.edu.tw。

### 找不到課號時的 UI 路線

1. 前往 https://cool.ntu.edu.tw
2. 點左側導覽的 **「課程」**，用 `get_page_text` 讀課程清單（不要截圖）
3. **單擊**課程名稱進入，左側會出現該課程的次選單
4. 在次選單找對應項目：

| 次選單 | 內容 |
|---|---|
| 公告 Announcements | 老師的公告 |
| 作業 Assignments | 作業與截止日 |
| 測驗 Quizzes | 線上測驗 |
| 課程模組／單元 Modules | 教材、投影片、檔案 |
| 成績 Grades | 成績 |
| 討論 Discussions | 討論區 |
| 人員 People | 修課名單 |
| 會議 Conferences | 線上會議連結 |
| 頁面 Pages | 老師自建頁面 |
| 媒體庫 Media Gallery | 課程錄影 |

拿到課號後**寫回 `~/.ntu-cool/courses.json`**，下次就不用再找一次。

## 其他注意事項

- **登入**：需要登入時停下來請使用者自己登入，**絕不代替使用者輸入帳號密碼**。
- **下載**：下載任何檔案前先取得使用者明確同意。
- **課名比對**：課名模糊或找不到時，把完整課程清單給使用者確認，不要自己猜。
- **`get_page_text` 優於截圖**：更快、更可靠、也好搜尋。
- **介面語言**：NTU COOL 介面可能是中文或英文，用上表對照兩種語言。
