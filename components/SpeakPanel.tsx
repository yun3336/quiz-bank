"use client";

import { useEffect, useRef, useState } from "react";
import { canRecognizeSpeech, speakLang, startSpeechRecognition } from "@/lib/languagePractice";
import { spokenText } from "@/lib/grade";
import type { Question } from "@/lib/types";

export function SpeakPanel({
  question,
  selected,
  onChange,
  disabled,
  examMode,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
  examMode: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const text = spokenText(question);
  const lang = speakLang(text, question.chapter, question.speakLang);
  const supported = canRecognizeSpeech();

  useEffect(() => {
    return () => stopRef.current?.();
  }, [question.id]);

  function record() {
    if (disabled) return;
    setError("");
    setListening(true);
    stopRef.current = startSpeechRecognition(
      lang,
      (transcript) => {
        onChange([transcript]);
      },
      (message) => setError(message),
      () => setListening(false),
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-900">{text}</p>
      <p className="text-sm text-slate-500">
        {examMode
          ? "口說批改不穩，模考仍從寬比對。請允許麥克風。"
          : "瀏覽器語音辨識可能漏字或聽錯，接近即可。也可手動打出你說的內容。"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !supported || listening}
          onClick={record}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
        >
          {listening ? "辨識中…" : "開始錄音"}
        </button>
      </div>
      {!supported ? (
        <p className="text-sm text-amber-800">這個瀏覽器沒有語音辨識（建議 Edge／Chrome）。請在下方打出朗讀內容。</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <textarea
        value={selected[0] ?? ""}
        disabled={disabled}
        autoComplete="off"
        rows={3}
        placeholder={supported ? "辨識結果會出現在這裡，也可自行修改" : "請打出你朗讀的句子"}
        onChange={(event) => onChange([event.target.value])}
        className="qb-input mt-0 min-h-24 resize-y"
      />
    </div>
  );
}
