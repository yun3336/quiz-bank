#!/usr/bin/env bash
# Regenerate Japanese clips listed in audio-clips.json (ja-*).
# Requires: edge-tts on PATH, ffmpeg. Output: public/audio/*.wav (pcm_s16le 22050Hz mono).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/audio"
TMP="${TMPDIR:-/tmp}/quiz-bank-ja-audio"
mkdir -p "$OUT" "$TMP"

VOICE="${EDGE_TTS_VOICE:-ja-JP-NanamiNeural}"

gen() {
  local file="$1" text="$2"
  local mp3="$TMP/${file%.wav}.mp3"
  edge-tts --voice "$VOICE" --text "$text" --write-media "$mp3"
  ffmpeg -y -i "$mp3" -acodec pcm_s16le -ar 22050 -ac 1 "$OUT/$file" </dev/null
  echo "Wrote $OUT/$file"
}

gen "ja-book.wav" "これは本です。"
gen "ja-morning.wav" "おはようございます。"
gen "ja-thanks.wav" "ありがとうございます。"
