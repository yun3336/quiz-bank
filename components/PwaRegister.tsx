"use client";

import { useEffect, useState } from "react";
import { dayKey } from "@/lib/wrongBook";
import { nextRemindAt } from "@/lib/remind";
import { getStudyStreak } from "@/lib/stats";
import {
  hideInstallPrompt,
  loadInstallHidden,
  loadProgress,
  loadRemindLastDay,
  loadRemindPref,
  saveRemindLastDay,
  subscribeRemind,
} from "@/lib/storage";

function isStandaloneDisplay(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    setHidden(loadInstallHidden() || isStandaloneDisplay());
    if (!loadInstallHidden() && !isStandaloneDisplay() && isIosSafari()) {
      setShowIos(true);
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowIos(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    let timer = 0;
    function arm() {
      window.clearTimeout(timer);
      const pref = loadRemindPref();
      if (!pref.enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const delay = Math.max(1_000, nextRemindAt(pref.hour) - Date.now());
      timer = window.setTimeout(async () => {
        const today = dayKey(Date.now());
        if (loadRemindLastDay() === today) {
          arm();
          return;
        }
        saveRemindLastDay(today);
        if (!getStudyStreak(loadProgress()).studiedToday) {
          const title = "今天還沒刷";
          const body = "打開題庫，連勝才不會斷。";
          let shown = false;
          if (navigator.serviceWorker?.controller) {
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(title, {
                body,
                tag: "quiz-bank-daily",
                icon: "/icons/192",
              });
              shown = true;
            } catch {
              shown = false;
            }
          }
          if (!shown && Notification.permission === "granted") {
            new Notification(title, { body, tag: "quiz-bank-daily" });
          }
        }
        arm();
      }, delay);
    }
    arm();
    const stop = subscribeRemind(arm);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, []);

  if (hidden || (!installEvent && !showIos)) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setInstallEvent(null);
  }

  function dismiss() {
    hideInstallPrompt();
    setHidden(true);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4">
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center gap-3 rounded-2xl bg-[var(--qb-navy)] px-4 py-3 text-white shadow-lg">
        <p className="min-w-0 flex-1 text-sm">
          {installEvent ? "加到主畫面。已看過的題可離線作答，批改需連線。" : "用分享鈕 → 加入主畫面。批改需連線。"}
        </p>
        {installEvent ? (
          <button type="button" onClick={() => void install()} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-[var(--qb-navy)]">
            安裝
          </button>
        ) : null}
        <button type="button" onClick={dismiss} className="shrink-0 text-sm text-white/70">
          稍後
        </button>
      </div>
    </div>
  );
}
