# 音訊產製說明

`public/audio/` 內短句 WAV 供聽力／聽寫題使用。文字來源為 `scripts/audio-clips.json`。

## 格式

- PCM 16-bit little-endian WAV
- 取樣率 22050 Hz、單聲道（與既有 `en-*`／`zh-*` 一致）

## 既有英文／中文夾

Windows 可用：

```powershell
npm run audio:generate
```

（`scripts/generate-audio.ps1` 以系統 SAPI 依 `audio-clips.json` 合成。）

## 日文夾（Stage 0 補齊）

下列檔案原在題庫中引用但倉庫缺檔，已於 2026-11-14 以**原創短句 TTS**補上（非第三方錄音翻錄）：

| 檔案 | 文字（`audio-clips.json`） |
|------|----------------------------|
| `ja-book.wav` | これは本です。 |
| `ja-morning.wav` | おはようございます。 |
| `ja-thanks.wav` | ありがとうございます。 |

產製步驟（可重現）：

1. 使用 `edge-tts`（Microsoft Edge 線上神經語音介面）語音 `ja-JP-NanamiNeural`，將上表文字合成為暫存 MP3。
2. 以 `ffmpeg` 轉成 `pcm_s16le`、22050 Hz、mono WAV，寫入 `public/audio/`。

輔助腳本：`scripts/generate-ja-audio.sh`（需本機已安裝 `edge-tts` 與 `ffmpeg`）。

這些音檔僅為題庫短句朗讀；授權上視為以公開短句文字自行 TTS 產生的資產，並非複製市售有聲書或受版權保護的第三方音軌。
