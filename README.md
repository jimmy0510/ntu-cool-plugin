# NTU COOL plugin for Claude Code

在 Claude Code 裡直接操作台大 NTU COOL（Canvas LMS）：查課程、作業、公告、成績，
以及從本機繳交作業。**主路線是在你已登入的 Chrome 分頁裡直接打 REST API**，不存任何憑證、
也沒有東西會過期。

## 🚫 散布限制

**本 plugin 未經開發者同意，切勿轉發、再散布或公開發佈。**
拿到這份東西的人請勿自行轉交第三方。

## ⚠️ 免責聲明

本工具為**非官方**專案，與**國立臺灣大學**及 **Instructure（Canvas）**均無任何關聯，
未經其審核或授權。

- 本工具透過你自己的登入狀態存取 NTU COOL 的 API。使用此途徑的風險與後果**由使用者自行承擔**，
  包含但不限於違反校方使用規範之可能。
- 繳交作業為**不可逆**動作。本工具一定會先給你確認，但最終送出與否
  由使用者決定，**因誤交、漏交、逾期所生之一切後果由使用者自負**。
- 作者不對資料遺失、繳交錯誤、帳號異常、成績爭議或校規爭議負任何責任。

**不同意以上條款請勿使用。**

## 安裝

```
/plugin marketplace add jimmy0510/ntu-cool-plugin
/plugin install ntu-cool@ntu-cool
```

這是**私有** repo。第一步會需要你的 GitHub 帳號有存取權（開發者邀請你當協作者）
以及本機的 git 有登入 GitHub —— Windows 的 Git 會自動跳出瀏覽器登入，
沒跳的話先跑一次 `gh auth login`。

## 兩條路線

| | 主路線（瀏覽器） | 備援（權杖） |
|---|---|---|
| 怎麼認證 | 你在 Chrome 裡登入 NTU COOL，Claude 在分頁裡用你的登入狀態打 API | Claude 在你的 Chrome 分頁建一把權杖，直接送到本機存檔（不經過對話） |
| 會過期嗎 | 不會，只要 Chrome 保持登入 | **會**被台大作廢（實測 11/2 建的 11/5 就失效），失效時 Claude 自動重建 |
| 需要什麼 | Claude in Chrome 擴充功能 | Node.js 20.12 以上，無相依套件 |
| 什麼時候用 | 預設 | 裝不了擴充功能、或要寫後端排程時 |

**預設走主路線。** 第一次用的時候，Claude 會確認你的 Chrome 裝了擴充功能、
而且登入了 NTU COOL —— 沒有的話它會帶你弄，大概一分鐘。
設定途中 Chrome 網址列會問要不要允許存取這部裝置上的應用程式，**請按「允許」**（只連你自己電腦的 `127.0.0.1`）。
你也可以直接：

```
/ntu-setup
```

## 你的資料放哪

| 檔案 | 內容 |
|---|---|
| `~/.ntu-cool/courses.json` | 課號快取，不是機密，Claude 會讀寫 |
| `~/.ntu-cool/token.env` | （只有走備援才有）存取權杖，等同帳號密碼，權限 600，Claude 不會讀它 |

走主路線完全不產生 `token.env`。若用過備援，**不要**把 `~/.ntu-cool/` 放進
OneDrive／Dropbox／iCloud 等會同步到雲端的位置，也不要 commit 進任何 git repo。

## 用法

設定完就直接跟 Claude 講話：

- 「我這學期修了哪些課？」
- 「總體經濟學下週要交什麼？」
- 「幫我把 ./報告.pdf 交到個經第二次作業」（會先給你確認再送出）

## 備援：管理權杖

只有走過權杖備援才需要：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --status
node "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --delete    # 不給 id 就刪目前存著的那把
```

刪掉之後記得把 `~/.ntu-cool/token.env` 也清掉。
