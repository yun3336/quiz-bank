"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EmptyState } from "@/components/ui";

export function QuizHud({ children }: { children: ReactNode }) {
  return <div className="qb-hud -mx-4 space-y-2 px-4 py-3 sm:-mx-5 sm:px-5">{children}</div>;
}

export function QuizActionBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const apply = () => {
      document.documentElement.style.setProperty("--qb-action-h", `${bar.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--qb-action-h");
    };
  }, []);

  return (
    <div ref={ref} className="qb-action-bar">
      <div className="mx-auto flex max-w-5xl gap-2 px-4">{children}</div>
    </div>
  );
}

export function QuizFrame({ children }: { children: ReactNode }) {
  return <div className="qb-quiz space-y-4">{children}</div>;
}

export function useQuizHotkeys(options: {
  active: boolean;
  submitted: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const { active, submitted, canSubmit, onSubmit, onNext } = options;

  useEffect(() => {
    if (!active) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return;
      if (tag === "INPUT") {
        const type = (target as HTMLInputElement).type;
        if (type !== "button" && type !== "submit") return;
      }
      if (!submitted && canSubmit) {
        event.preventDefault();
        onSubmit();
        return;
      }
      if (submitted) {
        event.preventDefault();
        onNext();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, submitted, canSubmit, onSubmit, onNext]);
}

export function QuizSession({
  accentBar,
  progress,
  title,
  meta,
  extraMeta,
  submitted,
  canSubmit,
  onSubmit,
  onNext,
  actions,
  children,
}: {
  accentBar: string;
  progress: number;
  title: string;
  meta?: string;
  extraMeta?: ReactNode;
  submitted: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onNext: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  useQuizHotkeys({ active: true, submitted, canSubmit, onSubmit, onNext });

  return (
    <QuizFrame>
      <QuizHud>
        <div className="flex items-start justify-between gap-2 text-sm text-slate-600 sm:items-center">
          <span className="min-w-0 line-clamp-2 font-medium sm:line-clamp-none">{title}</span>
          {extraMeta ?? <span className="shrink-0 tabular-nums">{meta}</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/80 shadow-inner">
          <div className={`h-full rounded-full transition-all ${accentBar}`} style={{ width: `${progress}%` }} />
        </div>
      </QuizHud>
      {children}
      <QuizActionBar>{actions}</QuizActionBar>
    </QuizFrame>
  );
}

export function EmptyQuizRange({
  desc,
  onBack,
  onRelaxFilters,
  canRelaxFilters,
  backLabel = "回設定",
}: {
  desc: string;
  onBack: () => void;
  onRelaxFilters?: () => void;
  canRelaxFilters?: boolean;
  backLabel?: string;
}) {
  return (
    <EmptyState title="這個範圍目前沒有題目" desc={desc}>
      <div className="flex flex-wrap justify-center gap-2">
        {canRelaxFilters && onRelaxFilters ? (
          <button type="button" onClick={onRelaxFilters} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
            改為全部章節與難度
          </button>
        ) : null}
        <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
          {backLabel}
        </button>
      </div>
    </EmptyState>
  );
}
