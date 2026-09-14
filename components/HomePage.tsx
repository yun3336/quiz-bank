"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TriviaCard } from "@/components/TriviaCard";
import { VendorMark } from "@/components/ui";
import { allLabs } from "@/lib/lab/labs";
import { homeHref, type HomeQuery } from "@/lib/homeSearch";
import { examResumeHref, practiceChapterHref, practiceQuestionHref, practiceResumeHref, practiceTodayHref } from "@/lib/quizStart";
import { cachedCatalog, loadCatalog } from "@/lib/questionClient";
import { searchQuestions, searchReady, stemSnippet } from "@/lib/questionSearch";
import { examClockRemaining, formatClock, type ExamSession, type PracticeSession } from "@/lib/session";
import { getStudyStreak, type StudyStreak } from "@/lib/stats";
import {
  clearExamSession,
  clearPracticeSession,
  loadDailyGoal,
  loadExamSession,
  loadLastVendor,
  loadPracticeSession,
  loadProgress,
  saveDailyGoal,
  saveLastVendor,
  subscribeProgress,
  subscribeSession,
} from "@/lib/storage";
import { DAILY_GOALS, todayAttemptCount, todaySessionSize, type DailyGoal } from "@/lib/todayPlan";
import type { Trivia } from "@/lib/trivia";
import type { ProgressStore } from "@/lib/types";
import { questionsByVendor, questionVendor, VENDORS, VENDOR_META, type Vendor } from "@/lib/vendor";

export function HomePage({
  trivia,
  guess,
  filter,
  homeQuery,
  searchQuery,
  vendors,
}: {
  trivia: Trivia;
  guess: boolean | null;
  filter: Vendor | "all";
  homeQuery: HomeQuery;
  searchQuery: string;
  vendors: Vendor[];
}) {
  const ciscoLabs = allLabs.filter((lab) => lab.engine === "ios").length;
  const huaweiLabs = allLabs.filter((lab) => lab.engine === "vrp").length;
  const [last, setLast] = useState<Vendor | null>(null);
  const [query, setQuery] = useState(searchQuery);
  const [progress, setProgress] = useState({ chapter: "" });
  const [store, setStore] = useState<ProgressStore>({
    attempts: [],
    examHistory: [],
    labCompletions: [],
    starredIds: [],
    notes: {},
  });
  const [goal, setGoal] = useState<DailyGoal>(10);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [catalog, setCatalog] = useState(() => cachedCatalog());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function sync(vendor = loadLastVendor()) {
      if (vendor) saveLastVendor(vendor);
      setLast(vendor);
      setStore(loadProgress());
      setGoal(loadDailyGoal());
      setPracticeSession(loadPracticeSession());
      setExamSession(loadExamSession());
      if (vendor) setProgress(vendorProgress(vendor));
    }
    sync();
    const stopProgress = subscribeProgress(() => sync(loadLastVendor()));
    const stopSession = subscribeSession(() => {
      setPracticeSession(loadPracticeSession());
      setExamSession(loadExamSession());
    });
    return () => {
      stopProgress();
      stopSession();
    };
  }, []);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((items) => {
        if (cancelled) return;
        setCatalog(items);
        const vendor = loadLastVendor();
        if (vendor) setProgress(vendorProgress(vendor, items));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function counts(vendor: Vendor): string {
    const total = questionsByVendor(vendor, catalog).length.toLocaleString("zh-Hant");
    if (vendor === "cisco") return `${total} 題 · ${ciscoLabs} 個 LAB`;
    if (vendor === "huawei") return `${total} 題 · ${huaweiLabs} 個 LAB`;
    return `${total} 題`;
  }

  function countLabel(vendor: Vendor): string {
    return `${questionsByVendor(vendor, catalog).length.toLocaleString("zh-Hant")} 題`;
  }

  const todayDone = todayAttemptCount(store.attempts);
  const sessionSize = todaySessionSize(goal, todayDone);
  const streak = getStudyStreak(store);
  const q = last ? `?vendor=${last}` : "";

  function changeGoal(next: DailyGoal) {
    setGoal(next);
    saveDailyGoal(next);
  }
  const shortcuts = [
    { href: `/practice${q}`, label: "練習", desc: "章節練習", icon: PracticeGlyph },
    { href: `/exam${q}`, label: "模考", desc: "模擬測驗", icon: ExamGlyph },
    { href: `/review${q}`, label: "複習", desc: "錯題複習", icon: ReviewGlyph },
    {
      href: last && VENDOR_META[last].hasLabs ? `/lab${q}` : `/stats${q}`,
      label: last && VENDOR_META[last].hasLabs ? "實驗" : "成績",
      desc: last && VENDOR_META[last].hasLabs ? "專題挑戰" : "作答紀錄",
      icon: last && VENDOR_META[last].hasLabs ? LabGlyph : StatsGlyph,
    },
  ];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return VENDORS;
    return VENDORS.filter((vendor) => {
      const meta = VENDOR_META[vendor];
      return `${meta.label} ${meta.subtitle} ${meta.short}`.toLowerCase().includes(needle);
    });
  }, [query]);

  const questionHits = useMemo(
    () => (searchReady(query) ? searchQuestions(catalog, query) : []),
    [catalog, query],
  );
  const clearHref = homeHref(homeQuery, { search: false, q: "" });
  const hasQuery = query.trim().length > 0;
  const emptySearch = hasQuery && filtered.length === 0 && questionHits.length === 0;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h1 className="text-pretty text-[1.85rem] font-extrabold tracking-tight text-slate-900">題庫刷題</h1>
          <p className="mt-1 text-sm text-slate-500">系統化刷題 · 精準提升</p>
        </div>
        <form
          id="home-search"
          method="get"
          action="/"
          className="relative"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--qb-navy)]">
            <SearchGlyph />
          </span>
          <label>
            <span className="sr-only">搜尋題幹、章節或題庫</span>
            <input
              ref={searchRef}
              name="q"
              defaultValue={searchQuery}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋題幹、章節、Cisco…"
              className="qb-input mt-0 pl-11 pr-12"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          {hasQuery ? (
            <a
              href={clearHref}
              data-full-nav
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-400"
              aria-label="清除搜尋"
            >
              <CloseGlyph />
            </a>
          ) : null}
        </form>
      </section>

      {hasQuery ? (
        <section id="banks" className="scroll-mt-20 space-y-5">
          <div className="flex items-end justify-between gap-3 px-1">
            <h2 className="text-base font-extrabold text-slate-900">
              {emptySearch ? "沒有符合的結果" : "搜尋結果"}
            </h2>
            <a href={clearHref} data-full-nav className="text-xs text-slate-400">
              取消
            </a>
          </div>
          {filtered.length > 0 ? (
            <div>
              <p className="mb-2 px-1 text-xs font-medium text-slate-400">題庫 · {filtered.length}</p>
              <div className="qb-group">
                {filtered.map((vendor) => (
                  <VendorRow key={vendor} vendor={vendor} counts={countLabel(vendor)} subtitle={VENDOR_META[vendor].subtitle} />
                ))}
              </div>
            </div>
          ) : null}
          {questionHits.length > 0 ? (
            <div>
              <p className="mb-2 px-1 text-xs font-medium text-slate-400">題目 · {questionHits.length}</p>
              <div className="qb-group">
                {questionHits.map((hit) => {
                  const vendor = questionVendor(hit.question);
                  const fieldLabel = hit.field === "stem" ? "題幹" : hit.field === "tag" ? "標籤" : "章節";
                  return (
                    <div key={hit.question.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-900">
                          {stemSnippet(hit.question.stem, query)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {VENDOR_META[vendor].label} · {hit.question.chapter} · {fieldLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <a
                          href={practiceQuestionHref(vendor, hit.question.id)}
                          data-full-nav
                          onClick={() => saveLastVendor(vendor)}
                          className="text-sm font-extrabold text-[var(--qb-navy)]"
                        >
                          練這題
                        </a>
                        <a
                          href={practiceChapterHref(vendor, hit.question.chapter)}
                          data-full-nav
                          onClick={() => saveLastVendor(vendor)}
                          className="text-xs text-slate-400"
                        >
                          練這章
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : searchReady(query) ? null : hasQuery ? (
            <p className="px-4 text-sm text-slate-500">再打一個字即可搜題幹與標籤。</p>
          ) : null}
          {emptySearch ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">試試題幹關鍵字，或 Cisco、華為、語言、數學、自然、職場</p>
          ) : null}
        </section>
      ) : (
        <>
          <ResumeList
            exam={examSession}
            practice={practiceSession}
            onDropExam={() => {
              clearExamSession();
              setExamSession(null);
            }}
            onDropPractice={() => {
              clearPracticeSession();
              setPracticeSession(null);
            }}
          />
          <ContinueCard
            last={last}
            chapter={progress.chapter}
            counts={last ? counts(last) : ""}
            streak={streak}
            todayDone={todayDone}
            goal={goal}
            sessionSize={sessionSize}
            onGoal={changeGoal}
          />

          <TriviaCard showPractice initialItem={trivia} initialGuess={guess} initialFilter={filter} />

          <section className="qb-card px-2 py-3 sm:px-3">
            <div className="grid grid-cols-4 gap-1">
              {shortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    data-full-nav
                    onClick={() => last && saveLastVendor(last)}
                    className="flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2 text-center"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--qb-wash)] text-[var(--qb-navy)]">
                      <Icon />
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">{item.label}</span>
                    <span className="text-[11px] leading-none text-slate-400">{item.desc}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="banks" className="scroll-mt-20">
            <div className="mb-2 flex items-end justify-between gap-3 px-1">
              <h2 className="text-base font-extrabold text-slate-900">精選題庫</h2>
            </div>
            <div className="qb-group">
              {vendors.map((vendor) => (
                <VendorRow key={vendor} vendor={vendor} counts={countLabel(vendor)} subtitle={VENDOR_META[vendor].subtitle} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ResumeList({
  exam,
  practice,
  onDropExam,
  onDropPractice,
}: {
  exam: ExamSession | null;
  practice: PracticeSession | null;
  onDropExam: () => void;
  onDropPractice: () => void;
}) {
  if (!exam && !practice) return null;
  return (
    <div className="space-y-2">
      {exam ? (
        <ResumeRow
          kicker={exam.pausedRemaining != null ? "未交卷的模考 · 已暫停" : "未交卷的模考"}
          title={`${VENDOR_META[exam.vendor].label} · 第 ${exam.index + 1}／${exam.questionIds.length} 題`}
          detail={`剩餘 ${formatClock(examClockRemaining(exam))}`}
          href={examResumeHref(exam.vendor)}
          onDrop={onDropExam}
        />
      ) : null}
      {practice ? (
        <ResumeRow
          kicker={practice.plan === "today" ? "未完成的今日刷" : "未完成的練習"}
          title={`${VENDOR_META[practice.vendor].label} · 第 ${practice.index + 1}／${practice.questionIds.length} 題`}
          detail={practice.submitted ? "這題已提交，接著下一題" : "可從這一題繼續"}
          href={practiceResumeHref(practice.vendor)}
          onDrop={onDropPractice}
        />
      ) : null}
    </div>
  );
}

function ResumeRow({
  kicker,
  title,
  detail,
  href,
  onDrop,
}: {
  kicker: string;
  title: string;
  detail: string;
  href: string;
  onDrop: () => void;
}) {
  return (
    <section className="qb-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{kicker}</p>
        <p className="mt-0.5 text-sm font-extrabold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{detail}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDrop}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-slate-500"
        >
          放棄
        </button>
        <Link
          href={href}
          data-full-nav
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--qb-navy)] px-4 text-sm font-extrabold text-white"
        >
          繼續
        </Link>
      </div>
    </section>
  );
}

function ContinueCard({
  last,
  chapter,
  counts,
  streak,
  todayDone,
  goal,
  sessionSize,
  onGoal,
}: {
  last: Vendor | null;
  chapter: string;
  counts: string;
  streak: StudyStreak;
  todayDone: number;
  goal: DailyGoal;
  sessionSize: number;
  onGoal: (goal: DailyGoal) => void;
}) {
  if (!last) {
    return (
      <section className="relative overflow-hidden rounded-[1.6rem] bg-[var(--qb-navy)] px-5 py-5 text-white shadow-[0_16px_36px_color-mix(in_srgb,var(--qb-navy)_28%,transparent)]">
        <p className="text-xs font-medium text-white/70">開始練習</p>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight">先選一題庫</h2>
        <p className="mt-1 text-sm text-white/70">Cisco、華為、語言、數學、自然或職場</p>
        <div className="mt-5">
          <a
            href="#banks"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--qb-wash)] px-5 text-sm font-extrabold text-[var(--qb-ink)]"
          >
            選擇題庫
          </a>
        </div>
        <HeroDoodle />
      </section>
    );
  }

  const meta = VENDOR_META[last];
  const lastLine = chapter ? `上次練習到 ${chapter}` : counts;
  const met = todayDone >= goal;
  const percent = Math.min(100, Math.round((todayDone / goal) * 100));
  const kicker = met
    ? streak.current > 0
      ? `今日達標 · 連續 ${streak.current} 天`
      : "今日達標"
    : streak.current > 0
      ? `連續 ${streak.current} 天`
      : "開始連勝";

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] bg-[var(--qb-navy)] px-5 py-5 text-white shadow-[0_16px_36px_color-mix(in_srgb,var(--qb-navy)_28%,transparent)]">
      <div className="relative z-10 pr-24">
        <p className="text-xs font-medium text-white/70">{kicker}</p>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight">{meta.label}</h2>
        <p className="mt-1 truncate text-sm text-white/70">{lastLine}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
          <span className="qb-mono text-sm font-semibold text-white">
            {Math.min(todayDone, goal)}/{goal}
          </span>
        </div>
        <fieldset className="mt-3">
          <legend className="sr-only">每日題數</legend>
          <div className="flex gap-1.5">
            {DAILY_GOALS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onGoal(item)}
                aria-pressed={item === goal}
                className={`min-h-8 rounded-full px-2.5 text-xs font-extrabold ${
                  item === goal ? "bg-white text-[var(--qb-ink)]" : "bg-white/15 text-white"
                }`}
              >
                {item} 題
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href={practiceTodayHref(last, sessionSize)}
            data-full-nav
            onClick={() => saveLastVendor(last)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#004f52] px-3 text-sm font-extrabold text-white"
          >
            {met ? "再刷一輪" : "今日刷"}
          </Link>
          <a
            href="#banks"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--qb-wash)] px-3 text-sm font-extrabold text-[var(--qb-ink)]"
          >
            改變科目
          </a>
        </div>
      </div>
      <HeroDoodle />
    </section>
  );
}

function VendorRow({ vendor, counts, subtitle }: { vendor: Vendor; counts: string; subtitle: string }) {
  return (
    <Link
      href={`/practice?vendor=${vendor}`}
      data-full-nav
      onClick={() => saveLastVendor(vendor)}
      className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-[var(--qb-wash)]"
    >
      <VendorMark vendor={vendor} className="h-12 w-12 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-900">{VENDOR_META[vendor].label}</p>
        <p className="truncate text-xs text-slate-400">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--qb-wash)] px-2.5 py-1 text-[11px] font-semibold text-[var(--qb-navy)]">
        {counts}
      </span>
      <ChevronGlyph />
    </Link>
  );
}

function vendorProgress(vendor: Vendor, catalog = cachedCatalog(vendor)): { chapter: string } {
  const store = loadProgress();
  const pool = questionsByVendor(vendor, catalog);
  const ids = new Set(pool.map((item) => item.id));
  const last = [...store.attempts].reverse().find((item) => ids.has(item.questionId));
  const chapter = last ? (pool.find((item) => item.id === last.questionId)?.chapter ?? "") : "";
  return { chapter };
}

function HeroDoodle() {
  return (
    <svg
      className="pointer-events-none absolute -right-2 top-3 h-28 w-28 text-white/90"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
    >
      <rect x="28" y="22" width="58" height="72" rx="10" fill="#e8f7f4" />
      <rect x="38" y="34" width="28" height="6" rx="3" fill="#00686b" opacity="0.35" />
      <path d="M38 50h8l3 3 7-8" stroke="#00686b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 68h8l3 3 7-8" stroke="#00686b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="74" y="48" width="12" height="46" rx="4" transform="rotate(28 74 48)" fill="#f4c430" />
      <path d="M86 42l10 5-4 8-10-5z" fill="#f4c430" />
      <path d="M94 40l6 3" stroke="#e8f7f4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function SearchGlyph() {
  return (
    <Glyph>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Glyph>
  );
}

function CloseGlyph() {
  return (
    <Glyph>
      <path d="M7 7l10 10M17 7 7 17" />
    </Glyph>
  );
}

function ChevronGlyph() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PracticeGlyph() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M20 12h-2M12 20v-2M4 12h2" />
    </Glyph>
  );
}

function ExamGlyph() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </Glyph>
  );
}

function ReviewGlyph() {
  return (
    <Glyph>
      <path d="M7 5h7a3 3 0 0 1 3 3v12l-5-2.5L7 20V5z" />
    </Glyph>
  );
}

function LabGlyph() {
  return (
    <Glyph>
      <path d="M9 3h6M10 3v5l-5 10a2 2 0 0 0 1.8 2.8h10.4A2 2 0 0 0 19 18L14 8V3" />
    </Glyph>
  );
}

function StatsGlyph() {
  return (
    <Glyph>
      <path d="M4 16l5-5 4 3 7-8" />
      <path d="M15 6h5v5" />
    </Glyph>
  );
}
