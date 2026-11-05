---
description: 設定 NTU COOL 存取方式，手把手帶完（主路線：Chrome 分頁；備援：本機權杖）
allowed-tools: Bash(node:*), Read, Write, Edit
---

手把手帶使用者完成第一次設定。**最高原則：能你做的就你做，一次只給一個動作，等他回覆再給下一個。**

主路線是「在使用者已登入的 Chrome 分頁裡打 API」，他**唯一要做的只有登入一次**。
只有裝不了擴充功能、或他明說要寫後端排程時，才走下面的權杖備援。

---

## 步驟 1：講清楚再開始

用白話講完，等他說願意再往下：

- 這是**非官方**工具，跟台大和 Canvas 都沒關係。
- 接下來會用他**自己在 Chrome 的登入狀態**去讀 NTU COOL，不會存他的帳號密碼、也不存任何憑證。
- 交作業是**不可逆**的，但每次一定會先給他確認才送出。
- **等一下 Chrome 會在網址列跳出一個權限詢問**（「cool.ntu.edu.tw 想要存取這部裝置上的其他應用程式和服務」
  之類的字），**請他按「允許」**。那是讓分頁把備援權杖直接存到他自己電腦用的，只連 `127.0.0.1`，
  不會連到任何外部網站。沒按的話設定會卡住。
- 本 plugin **未經開發者同意不得轉發**。
- 風險自負，作者不負責。

接著**一字不漏**把下面這塊也輸出給他 —— 這是必要動作，不是可選的補充：

> **📮 開發者的話**
>
> 你會拿到這份檔案，代表你是開發者非常好的朋友。
>
> 從功能、安裝指引到每一條警示，都是開發者一條一條寫下來、實際測過、
> 再一次次修改的 —— 目的是讓大家用最低的門檻也能順利把它用起來。
>
> 開發者特別要提醒：**請不要把這份檔案外傳。**
> 萬一不是開發者朋友的人出了資料外洩，開發者控制不了，卻可能要負連帶責任。
>
> 所以拜託，**不要主動分享給其他人**。想介紹給誰，先問過開發者。

輸出完才問他願不願意繼續。**沒輸出這塊就不准進步驟 2。**

## 步驟 2：確認 Chrome 擴充功能在

Claude in Chrome 的工具（`mcp__claude-in-chrome__*`）在這個 session 裡：

- **有（已載入或可透過 ToolSearch 載入）** → 直接進步驟 3。
- **只剩 `enable__mcp__claude-in-chrome`** → 先呼叫它開啟，再進步驟 3。
- **完全沒有** → 告訴他需要「Claude in Chrome」這個瀏覽器擴充功能：
  到 Claude 桌面 App 設定裡開啟，或裝 Chrome 擴充功能並連上。
  他真的裝不了、或沒有 Chrome → 走最底下的〈備援：本機權杖〉。

## 步驟 3：帶他登入（他唯一要做的事）

1. `tabs_context_mcp` → `tabs_create_mcp` 開一個新分頁 →
   `navigate` 到 `https://cool.ntu.edu.tw/`。
2. 用 `javascript_tool` 跑這行判斷：
   ```js
   location.pathname.startsWith('/login') ? '未登入' : '已登入'
   ```
3. `未登入` → 跟他說「請你在剛開的那個分頁自己登入 NTU COOL，好了跟我說」。
   **絕不代替他輸入帳號密碼。** 台大是 SSO（會跳到 `adfs.ntu.edu.tw`），登完會自己跳回來。
   他說好了，重新 `navigate` 到 `https://cool.ntu.edu.tw/` 再跑一次步驟 2 的判斷確認。
4. `已登入` → 進步驟 4 驗證。

## 步驟 4：你自己驗證並建課號快取

用 `javascript_tool`（照 SKILL.md 的 `cool()` 輔助函式）跑：

```js
// …貼上 SKILL.md 的 cool() …
(await cool('/courses?enrollment_state=active&per_page=100'))
  .map(c => ({ id: c.id, name: c.name, code: c.course_code }))
```

- 出現課程清單 → 成功。把課名念給他確認，然後用 Write 寫 `~/.ntu-cool/courses.json`：
  `{ "updatedAt": "<今天日期>", "courses": [ { "id": 0, "name": "", "code": "" } ] }`
- 丟出「未登入」→ 回步驟 3。

## 步驟 5：你自己建備援權杖（他只要按一次「允許」）

照 SKILL.md〈從 Chrome 自動建權杖〉做：背景開 `--receive` → 分頁裡先 ping → pong 了才建權杖送過去。

- **ping 之前再提醒他一次**：「Chrome 網址列等一下會問要不要允許存取這部裝置上的應用程式，請按『允許』。」
- ping 逾時 → 多半是他還沒按，請他看網址列附近按「允許」，再 ping 一次。
- 他找不到詢問、或按了「封鎖」→ 請他點網址列左邊的網站設定圖示，把「區域網路存取」／
  「其他應用程式和服務」改成允許，再 ping。真的弄不好就跳過這步，主路線不受影響。
- 成功後跑 `--status` 確認 `已設定`。

這把權杖之後學校作廢了，Claude 也會照同樣流程自動重建；權限已經允許過，就不會再問。

## 步驟 6：告訴他可以用了

給兩三個他真的會問的例子：
「我這禮拜有什麼作業要交？」「總經最新公告是什麼？」「幫我把桌面的報告.pdf 交到個經作業二」。
順帶說明：只要 Chrome 保持登入就一直能用，交作業前一定會先給他確認。

設定完**回頭把他原本問的事做完**，不要讓他重問一次。

---

## 最後手段：沒有 Chrome 擴充功能時，手動複製 cookie 建權杖

> ⚠️ 台大會作廢學生自建的權杖（實測 11/2 建的 11/5 就失效），而且這條每次都要他手動複製 cookie。
> 有擴充功能就一律走步驟 5 的自動流程，不要走這裡。

### B1. 偵測環境

```bash
node -e "console.log('平台:',process.platform,'｜node:',process.version)"
node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --status
```

- `node` 低於 v20.12 → 請他先升級 Node。
- `--status` 印 `已設定` → 已經有一把能用的，問他要沿用還是重建；`已失效` → 直接重建（可覆蓋）。

### B2. 帶他複製整行 Cookie

一次講一步（按鈕名稱中英並列，他的瀏覽器語言可能是任一種）：

1. 登入 `cool.ntu.edu.tw` 停在課程首頁，開開發者工具
   （Chrome／Edge：`F12` 或 `Ctrl/⌘ Shift I`；Firefox：`Ctrl/⌘ Shift E` 直接開網路面板）。
2. 到「網路 / Network」分頁，重新整理頁面，點最上面第一列。
3. 右邊「標頭 / Headers」→ 往下找「要求標頭 / Request Headers」→ 開頭 `Cookie:` 的那一行。
   Chrome 顯示成小標籤時，把右上角「原始 / Raw」打勾變成一整行。
4. **整行**複製（含 `_csrf_token`）。複製好回你一聲，**不用貼給你**。

### B3. 你自己建權杖並驗證

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --from-clipboard --save
node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --status
```

程式自己從剪貼簿讀、自己寫進 `~/.ntu-cool/token.env`（權限 600），權杖值不會進畫面或對話。
成功後請他**清空剪貼簿**。`--status` 印出 `已設定` 和到期日就完成了。

| 訊息 | 怎麼辦 |
|---|---|
| `cookie 裡沒有 _csrf_token` | 回 B2，強調要**整行** |
| `HTTP 401` | 登入狀態過期，請他重新登入再複製一次 |
| `讀不到剪貼簿`（Linux） | 請他裝 xclip |

---

## 全程規則

- **不要**讀取或印出 `token.env`，權杖值永遠不進對話。
- **不要**一次丟一堆步驟，一次一個動作，等他回覆。
- 他說「找不到」「看不到」時，改問他螢幕上看到什麼，再針對他的畫面給下一步。
- 絕不代替他登入或輸入帳號密碼。
- 能你執行的就你執行，不要把工作推給使用者。
