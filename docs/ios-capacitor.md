# iOS／Capacitor 本機殼（不含正解）

本專案的 Capacitor 殼載入**打包後的本機 `www/` UI**，不是只開 production Vercel 整站 WebView。

## 能力邊界

| 情境 | 行為 |
|------|------|
| 網站（Vercel） | 題目去正解；批改走 `/api/grade`。 |
| 原生殼 `www/` | **不含**完整答案庫；離線可看已快取公開題並暫存待批改；**連線後**才呼叫 `NEXT_PUBLIC_API_BASE` 批改。 |
| 口說麥克風辨識 | 離線可能失敗。 |

此 Linux 環境**不能**產出已簽名 IPA／也不驗證 Xcode Archive。

## 本機建置步驟

```bash
npm ci
# 可選：指定線上 API（公開網址）
# export NEXT_PUBLIC_API_BASE=https://quiz-bank-bice.vercel.app
npm run native:www           # 靜態匯出 → www/（並掃描禁止 offline-bank）
npx cap sync ios
```

在 **macOS** 上：

```bash
npx cap open ios
# 於 Xcode 選 Team、Bundle ID，Run／Archive
```

確認無答案包：

```bash
test ! -f public/offline-bank.json && test ! -f www/offline-bank.json && echo "no answer bank artifacts"
```

## 設定檔

- `capacitor.config.ts`：`webDir: "www"`，**無** `server.url`
- App ID 預設：`app.quizbank.practice`
- 建置時寫入 `NEXT_PUBLIC_API_BASE` 供連線批改（預設 `https://quiz-bank-bice.vercel.app`）

## 風險與限制（請如實認知）

1. **答案不進原生包**；但仍可能有人對線上 API 自動化抓題／批改試探（有粗略 rate limit，無登入則非強固）。
2. **未簽名建置**：CI／Linux 無法證明 TestFlight／上架就緒。
3. **靜態匯出**：`native:www` 會暫時移走 API 路由再還原；中斷時請確認 `app/api`、`proxy.ts`、`next.config.ts` 已還原。
4. 離線待批改在記分前不會污染統計；連線沖洗採客戶端冪等鍵，避免重複記分。
