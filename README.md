# NTU COOL plugin for Claude Code

在 Claude Code 裡直接操作台大 NTU COOL（Canvas LMS）：查課程、作業、公告、成績，
以及從本機繳交作業。優先走 REST API，不動你的瀏覽器。

## 🚫 散布限制

**本 plugin 未經開發者同意，切勿轉發、再散布或公開發佈。**
拿到這份東西的人請勿自行轉交第三方。

## ⚠️ 免責聲明

本工具為**非官方**專案，與**國立臺灣大學**及 **Instructure（Canvas）**均無任何關聯，
未經其審核或授權。

- 使用本工具需要建立一把 **Canvas 存取權杖**。台大將產生權杖的**介面**隱藏，
  但相關 API 並未關閉；使用此途徑取得憑證的風險與後果**由使用者自行承擔**，
  包含但不限於違反校方使用規範之可能。
- 權杖**等同你的帳號密碼**，預設不設到期日。任何取得該權杖的人都能以你的身分
  讀取課程資料與繳交作業。請自行負責保管。
- 繳交作業為**不可逆**動作。本工具預設要求先 `--dry-run` 確認，但最終送出與否
  由使用者決定，**因誤交、漏交、逾期所生之一切後果由使用者自負**。
- 作者不對資料遺失、繳交錯誤、帳號異常、成績爭議或校規爭議負任何責任。

**不同意以上條款請勿使用。**

## 安裝

```
/plugin marketplace add <你的 GitHub 帳號>/ntu-cool-plugin
/plugin install ntu-cool@ntu-cool
```

需要 **Node.js 20.12 以上**（用到 `process.loadEnvFile`）。無其他相依套件。

## 第一次設定

```
/ntu-setup
```

會引導你取得 cookie、換成永久權杖，並存到 `~/.ntu-cool/token.env`。

## 你的資料放哪

所有個人資料都在 `~/.ntu-cool/`，**不在 plugin 裡**，所以 plugin 更新不會弄丟：

| 檔案 | 內容 |
|---|---|
| `token.env` | 你的存取權杖。等同帳號密碼，權限 600，Claude 不會讀它 |
| `courses.json` | 課號快取。Claude 會讀寫這個檔，不是機密 |

**不要**把 `~/.ntu-cool/` 放進 OneDrive／Dropbox／iCloud 等會同步到雲端的位置，
也不要 commit 進任何 git repo。

## 用法

設定完就直接跟 Claude 講話：

- 「我這學期修了哪些課？」
- 「總體經濟學下週要交什麼？」
- 「幫我把 ./報告.pdf 交到個經第二次作業」（會先 dry-run 給你確認）

## 撤銷權杖

```bash
node --env-file="$HOME/.ntu-cool/token.env" "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --list
node --env-file="$HOME/.ntu-cool/token.env" "$CLAUDE_PLUGIN_ROOT/skills/ntu-cool/create-token.mjs" --delete <id>
```

刪掉之後記得把 `~/.ntu-cool/token.env` 也清掉。
