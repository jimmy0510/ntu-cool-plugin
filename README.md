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

## 下載與安裝

### 事前準備

1. **Claude Code**（終端機版或 Claude 桌面 App 的 Code 分頁都可以）。
2. **Google Chrome** 加上 **Claude in Chrome** 擴充功能，並連上 Claude（主路線要用）。
3. （選用）**Node.js 20.12 以上**，只有走權杖備援才需要。

**不需要 GitHub 帳號。**

### 最簡單：把連結貼給 Claude

在 Claude Code 裡貼上這句就好：

> 幫我安裝這個 plugin：https://github.com/jimmy0510/ntu-cool-plugin

Claude 會替你跑下面方法一的兩行指令。

### 方法一：自己輸入指令（之後好更新）

在 Claude Code 裡依序輸入：

```
/plugin marketplace add jimmy0510/ntu-cool-plugin
/plugin install ntu-cool@ntu-cool
```

### 方法二：下載 ZIP 再安裝

1. 打開 <https://github.com/jimmy0510/ntu-cool-plugin>，
   按綠色的「**Code**」→「**Download ZIP**」。
2. 解壓縮到一個**固定的位置**，例如 `C:\Users\你的名字\ntu-cool-plugin`
   （之後不要搬動或刪掉，Claude Code 會從這裡讀）。
3. 在 Claude Code 裡輸入（路徑換成你解壓縮的資料夾，裡面要看得到 `.claude-plugin`）：

   ```
   /plugin marketplace add C:\Users\你的名字\ntu-cool-plugin
   /plugin install ntu-cool@ntu-cool
   ```

### 裝好之後

重開 Claude Code，輸入 `/ntu-setup`，照著它一步一步做完就能用了（見下面〈兩條路線〉）。

### 開啟自動更新（建議）

自動更新預設是關的，開一次之後每次啟動 Claude Code 都會自己抓新版：

1. 在 Claude Code 輸入 `/plugin`。
2. 切到「**Marketplaces**」分頁，選 `ntu-cool`。
3. 選「**Enable auto-update**」。

沒開的話，也可以直接跟 Claude 說「幫我更新 ntu-cool plugin」，更新完重開 Claude Code。

### 手動更新與移除

```
/plugin marketplace update ntu-cool
/plugin update ntu-cool@ntu-cool
/plugin uninstall ntu-cool@ntu-cool
```

用 ZIP 安裝的人沒辦法自動更新，要重新下載 ZIP 覆蓋原本的資料夾，再跑上面兩行 `update`。

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
