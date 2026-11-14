# iOS／Capacitor 本機殼（離線批改）

本專案的 Capacitor 殼載入**打包後的本機 `www/`**，不是只開 production Vercel URL。

## 能力邊界

| 情境 | 行為 |
|------|------|
| 網站（Vercel） | 題目去正解；批改走 `/api/grade`。`public/` **不得**含 `offline-bank.json`。 |
| 原生殼 `www/` | 內建 `offline-bank.json`（含正解）；無網路時可抽題＋批改。 |
| 口說麥克風辨識 | 離線可能失敗；可改打字，本機仍可批改。 |

此 Linux 環境**不能**產出已簽名 IPA／也不驗證 Xcode Archive。請在 macOS + Xcode 完成本機建置與簽名。

## 本機建置步驟（開發者）

```bash
npm ci
npm run native:bank          # 產生 native/offline-bank.json
npm run native:www           # 靜態匯出 → www/（含離線題庫）
npx cap sync ios
```

在 **macOS** 上：

```bash
npx cap open ios
# 於 Xcode 選 Team、Bundle ID，Run／Archive
```

還原／確認網站安全：

```bash
test ! -f public/offline-bank.json && echo "public clean"
```

## 設定檔

- `capacitor.config.ts`：`webDir: "www"`，**無** `server.url`
- App ID 預設：`app.quizbank.practice`（上架前可由擁有者更改）
- `ios/`：由 `npx cap add ios` 產生的 Xcode 工程（若目錄存在）

## 風險（請如實認知）

1. **答案外洩**：原生包內含完整題庫；有能力者可自 IPA／檔案系統抽出。網站流量仍受伺服端保護。
2. **未簽名建置**：此倉庫 CI／Linux agent 無法證明 TestFlight／上架就緒。
3. **薄殼審核**：本殼提供本機離線練習價值；仍須通過 Apple 審核，不保證過關。
4. **靜態匯出**：`native:www` 會暫時移走 API 路由再還原；中斷建置時請確認 `app/api`、`proxy.ts`、`next.config.ts` 已還原。
