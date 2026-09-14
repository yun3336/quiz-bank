"use client";

import { useEffect, useRef, useState } from "react";
import { speakLang, speakText, stopSpeaking } from "@/lib/languagePractice";
import { spokenText } from "@/lib/grade";
import type { Question } from "@/lib/types";

export function AudioPlayer({
  question,
  autoPlay = false,
  label = "播放錄音",
}: {
  question: Question;
  autoPlay?: boolean;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const src = question.audioSrc;
  const text = spokenText(question);
  const lang = speakLang(text, question.chapter, question.speakLang);
  const [fileOk, setFileOk] = useState(Boolean(src));

  useEffect(() => {
    setFileOk(Boolean(src));
  }, [question.id, src]);

  function fallbackSpeak() {
    setFileOk(false);
    speakText(text, lang);
  }

  useEffect(() => {
    if (!autoPlay) return;
    if (src && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => fallbackSpeak());
      return () => {
        audioRef.current?.pause();
        stopSpeaking();
      };
    }
    speakText(text, lang);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, src, autoPlay, text, lang]);

  function replay() {
    if (src && fileOk && audioRef.current) {
      stopSpeaking();
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => fallbackSpeak());
      return;
    }
    speakText(text, lang);
  }

  const showFile = Boolean(src) && fileOk;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          className="hidden"
          onError={() => setFileOk(false)}
        />
      ) : null}
      <button
        type="button"
        onClick={replay}
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {showFile ? label : "朗讀（無錄音檔）"}
      </button>
      {showFile ? (
        <span className="text-xs text-slate-500">錄音檔</span>
      ) : (
        <span className="text-xs text-slate-400">瀏覽器語音</span>
      )}
    </div>
  );
}
