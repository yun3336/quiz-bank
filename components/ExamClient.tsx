"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DifficultyPicker } from "@/components/LanguagePractice";
import { QuestionPlayer } from "@/components/QuestionPlayer";
import { NeedVendor, VendorBar } from "@/components/VendorBar";
import { PageHeader } from "@/components/ui";
import { QuizActionBar } from "@/components/QuizChrome";
import { SegRadios } from "@/components/SegRadios";
import { examResumeHref, examStartHref, type ExamStart } from "@/lib/quizStart";
import { isAnswered } from "@/lib/grade";
import { stopSpeaking } from "@/lib/languagePractice";
import { ALL_CHAPTER, type DifficultyFilter } from "@/lib/questions";
import { gradeExamRemote, loadCatalog, loadQuiz, OfflineGradeError, OFFLINE_GRADE_MESSAGE } from "@/lib/questionClient";
import { applyReveal } from "@/lib/questionPublic";
import {
  clearExamSession,
  loadExamSession,
  recordExam,
  saveExamResult,
  saveExamSession,
  subscribeSession,
} from "@/lib/storage";
import {
  collectExamReview,
  examClockRemaining,
  formatClock,
  remainingExamSec,
  restoreQuizIndex,
  resumeExamEndsAt,
  type ExamSession,
} from "@/lib/session";
import type { Attempt, ExamResultItem, Question } from "@/lib/types";
import { useActiveVendor } from "@/lib/useResolvedVendor";
import { allChapterLabel, getChaptersByVendor, VENDOR_META, vendorAccent } from "@/lib/vendor";

type Phase = "boot" | "setup" | "exam";

export function ExamClient({ start }: { start: ExamStart | null }) {
  const router = useRouter();
  const { vendor: ctxVendor } = useActiveVendor();
  const vendor = start?.vendor ?? ctxVendor;
  const isResume = Boolean(start?.resume);
  const [chapters, setChapters] = useState([ALL_CHAPTER]);
  const [gradeError, setGradeError] = useState("");
  const [phase, setPhase] = useState<Phase>(isResume || start?.go ? "boot" : "setup");
  const [chapter, setChapter] = useState(start?.chapter ?? ALL_CHAPTER);
  const [count, setCount] = useState(start?.count ?? 20);
  const [minutes, setMinutes] = useState(start?.minutes ?? 20);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(start?.difficulty ?? "all");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [remaining, setRemaining] = useState(start?.go ? start.minutes * 60 : 0);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [pauseMs, setPauseMs] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saved, setSaved] = useState<ExamSession | null>(null);
  const submittedRef = useRef(false);
  const answersRef = useRef<Record<string, string[]>>({});
  answersRef.current = answers;
  const startedAtRef = useRef(0);
  startedAtRef.current = startedAt;
  const pauseStartedAtRef = useRef<number | null>(null);

  const prevVendor = useRef(vendor);
  useEffect(() => {
    if (prevVendor.current === vendor) return;
    prevVendor.current = vendor;
    setChapter(ALL_CHAPTER);
    setPhase(isResume ? "boot" : "setup");
    setDifficulty("all");
  }, [vendor, isResume]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    setSaved(loadExamSession());
    return subscribeSession(() => setSaved(loadExamSession()));
  }, []);

  useEffect(() => {
    if (!vendor) return;
    loadCatalog(vendor)
      .then((items) => setChapters([ALL_CHAPTER, ...getChaptersByVendor(vendor, items)]))
      .catch(() => undefined);
  }, [vendor]);

  useEffect(() => {
    if (!isResume && !start?.go) return;
    let cancelled = false;
    async function boot() {
      try {
      const session = loadExamSession();
      if (session && vendor) {
        const questions = await loadQuiz({ kind: "ids", vendor, ids: session.questionIds });
        if (cancelled) return;
        if (questions.length > 0) {
          setChapter(session.chapter);
          setDifficulty(session.difficulty);
          setMinutes(session.minutes);
          setQuiz(questions);
          setIndex(restoreQuizIndex(session.questionIds, questions, session.index));
          setAnswers(session.answers);
          setFlaggedIds(session.flaggedIds);
          setStartedAt(session.startedAt);
          setEndsAt(session.endsAt);
          setPausedRemaining(session.pausedRemaining);
          setPauseMs(session.pauseMs);
          setRemaining(examClockRemaining(session));
          setReviewOpen(false);
          submittedRef.current = false;
          pauseStartedAtRef.current = session.pausedRemaining != null ? Date.now() : null;
          setPhase("exam");
          return;
        }
        clearExamSession();
      }
      if (isResume || !start?.go || !vendor) {
        if (!cancelled) setPhase("setup");
        return;
      }
      const questions = await loadQuiz({
        kind: "exam",
        vendor,
        chapter: start.chapter,
        count: start.count,
        difficulty: start.difficulty,
      });
      if (cancelled) return;
      if (questions.length === 0) {
        setPhase("setup");
        return;
      }
      const now = Date.now();
      setQuiz(questions);
      setIndex(0);
      setAnswers({});
      setFlaggedIds([]);
      setStartedAt(now);
      setEndsAt(now + start.minutes * 60 * 1000);
      setPausedRemaining(null);
      setPauseMs(0);
      setRemaining(start.minutes * 60);
      setReviewOpen(false);
      submittedRef.current = false;
      pauseStartedAtRef.current = null;
      setPhase("exam");
      } catch {
        if (!cancelled) {
          setGradeError("需連線抽題，請連上網路再試。");
          setPhase("setup");
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResume, start?.go, vendor]);

  const current = quiz[index];

  async function finishExam(options?: { skipConfirm?: boolean }) {
    if (submittedRef.current || quiz.length === 0) return;
    if (!options?.skipConfirm) {
      setReviewOpen(true);
      return;
    }
    submittedRef.current = true;
    const now = Date.now();
    const origin = startedAtRef.current || now;
    const left = pausedRemaining != null ? pausedRemaining : remaining;
    const durationSec = Math.max(1, minutes * 60 - left);
    const latestAnswers = answersRef.current;
    try {
      const graded = await gradeExamRemote(
        quiz.map((question) => ({
          questionId: question.id,
          selected: latestAnswers[question.id] ?? [],
        })),
      );
      const byId = new Map(quiz.map((question) => [question.id, question]));
      const items: ExamResultItem[] = graded.map((item) => {
        const base = byId.get(item.questionId);
        return {
          questionId: item.questionId,
          selected: item.selected,
          correct: item.correct,
          question: base ? applyReveal(base, item.reveal) : undefined,
        };
      });
      const score = items.filter((item) => item.correct).length;
      const record = {
        id: `exam-${now}`,
        startedAt: origin,
        durationSec,
        score,
        total: quiz.length,
        chapter: chapter === ALL_CHAPTER && vendor ? allChapterLabel(vendor) : chapter,
      };
      const attempts: Attempt[] = items.map((item) => ({
        questionId: item.questionId,
        selected: item.selected,
        correct: item.correct,
        at: now,
        mode: "exam" as const,
      }));
      clearExamSession();
      recordExam(record, attempts);
      saveExamResult({ record, items });
      router.push("/exam/result");
    } catch (error) {
      submittedRef.current = false;
      setGradeError(error instanceof OfflineGradeError ? OFFLINE_GRADE_MESSAGE : "交卷批改失敗，請連線後再試。");
    }
  }

  useEffect(() => {
    if (phase !== "exam" || endsAt <= 0 || pausedRemaining != null) return;
    const tick = () => setRemaining(remainingExamSec(endsAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [phase, endsAt, pausedRemaining]);

  useEffect(() => {
    if (phase === "exam" && endsAt > 0 && remaining === 0 && pausedRemaining == null) {
      finishExam({ skipConfirm: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining, endsAt, pausedRemaining]);

  useEffect(() => {
    if (phase !== "exam") return;
    document.getElementById(`exam-q-${index}`)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [phase, index]);

  useEffect(() => {
    if (phase !== "exam" || !vendor || quiz.length === 0 || endsAt <= 0) return;
    saveExamSession({
      version: 1,
      kind: "exam",
      vendor,
      chapter,
      difficulty,
      questionIds: quiz.map((item) => item.id),
      index,
      answers,
      flaggedIds,
      startedAt,
      endsAt,
      minutes,
      pausedRemaining,
      pauseMs,
      updatedAt: Date.now(),
    });
  }, [phase, vendor, chapter, difficulty, quiz, index, answers, flaggedIds, startedAt, endsAt, minutes, pausedRemaining, pauseMs]);

  function pauseClock() {
    if (pausedRemaining != null || remaining <= 0) return;
    pauseStartedAtRef.current = Date.now();
    setPausedRemaining(remaining);
    setReviewOpen(false);
  }

  function resumeClock() {
    if (pausedRemaining == null) return;
    const left = pausedRemaining;
    const now = Date.now();
    if (pauseStartedAtRef.current != null) {
      setPauseMs((value) => value + (now - pauseStartedAtRef.current!));
    }
    pauseStartedAtRef.current = null;
    setEndsAt(resumeExamEndsAt(left, now));
    setRemaining(left);
    setPausedRemaining(null);
  }

  function toggleFlag(questionId: string) {
    setFlaggedIds((list) =>
      list.includes(questionId) ? list.filter((item) => item !== questionId) : [...list, questionId],
    );
  }

  if (!vendor) {
    return <NeedVendor />;
  }

  if (phase === "boot") {
    return (
      <div className="qb-card px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">{isResume ? "載入未完成的考試…" : "準備考試…"}</p>
      </div>
    );
  }

  if (phase === "setup") {
    const accent = vendorAccent(vendor);
    return (
      <div className="space-y-6 qb-quiz">
        <PageHeader title="模考" desc="考試中不顯示解析。可標記、暫停；時間到會自動交卷。離開後可從首頁接著考。" />
        <VendorBar vendor={vendor} />
        {gradeError ? <p className="text-sm text-amber-800">{gradeError}</p> : null}
        {saved && saved.questionIds.length > 0 ? (
          <div className="qb-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-slate-600">
              有未交卷的考試 · 第 {saved.index + 1}／{saved.questionIds.length} 題 ·{" "}
              {saved.pausedRemaining != null ? "已暫停 · " : ""}剩餘{" "}
              {formatClock(examClockRemaining(saved))}
            </p>
            <a
              href={examResumeHref(saved.vendor)}
              data-full-nav
              className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white ${accent.btn}`}
            >
              繼續
            </a>
          </div>
        ) : null}
        <form id="exam-setup" className="space-y-5" method="get" action="/exam" target="_top">
          <input type="hidden" name="vendor" value={vendor} />
          <input type="hidden" name="go" value="1" />
          <div className="qb-group">
            <label className="qb-row">
              <span className="shrink-0 text-sm text-slate-500">範圍</span>
              <select name="chapter" defaultValue={chapter} className="qb-row-value">
                {chapters.map((item) => (
                  <option key={item} value={item}>
                    {item === ALL_CHAPTER ? `全部${VENDOR_META[vendor].label}題` : item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DifficultyPicker vendor={vendor} value={difficulty} onChange={setDifficulty} />
          <div>
            <p className="qb-section">題數</p>
            <SegRadios
              name="count"
              value={String(count)}
              options={[10, 20, 30, 50].map((item) => ({ id: String(item), label: `${item} 題` }))}
              onChange={(id) => setCount(Number(id))}
            />
          </div>
          <div>
            <p className="qb-section">時限</p>
            <SegRadios
              name="minutes"
              value={String(minutes)}
              options={[10, 20, 30, 45].map((item) => ({ id: String(item), label: `${item} 分` }))}
              onChange={(id) => setMinutes(Number(id))}
            />
          </div>
          <p className="px-1 text-xs text-slate-500">閱讀同一篇會整組帶出，實際題數可能略多。網路實操請走實驗。</p>
          <QuizActionBar>
            <a
              href={examStartHref({ vendor, chapter, count, minutes, difficulty })}
              target="_top"
              onClick={(event) => {
                if (saved && !window.confirm("有未交卷的考試，開始新的會放棄上一場。繼續？")) {
                  event.preventDefault();
                  return;
                }
                clearExamSession();
              }}
              className={`qb-press flex flex-1 items-center justify-center rounded-2xl px-4 py-3.5 text-center text-base font-extrabold text-white ${vendorAccent(vendor).btn}`}
            >
              開始 {VENDOR_META[vendor].label} 考試
            </a>
          </QuizActionBar>
        </form>
      </div>
    );
  }

  if (!current) {
    return <p className="qb-card p-6">這個範圍目前沒有題目。</p>;
  }

  const accent = vendorAccent(vendor);
  const clockPaused = pausedRemaining != null;
  const flagged = flaggedIds.includes(current.id);
  const review = collectExamReview(
    quiz.map((item) => item.id),
    (id) => {
      const question = quiz.find((item) => item.id === id);
      return question ? isAnswered(question, answers[id] ?? []) : false;
    },
    flaggedIds,
  );

  return (
    <div className="qb-exam qb-quiz space-y-4">
      <div className="qb-hud -mx-4 space-y-3 px-4 py-3 sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 text-sm text-slate-600">
            第 {index + 1} / {quiz.length} 題 · {VENDOR_META[vendor].label}
            {current.passageId ? " · 閱讀同篇" : ""}
            {clockPaused ? " · 已暫停" : ""}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clockPaused ? resumeClock : pauseClock}
              disabled={!clockPaused && remaining <= 0}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 disabled:text-slate-400"
            >
              {clockPaused ? "繼續" : "暫停"}
            </button>
            <span
              className={`qb-mono rounded-full px-3 py-1 text-base font-medium tabular-nums sm:text-lg ${
                remaining <= 60 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-900"
              }`}
            >
              {formatClock(remaining)}
            </span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {quiz.map((question, questionIndex) => {
            const answered = isAnswered(question, answers[question.id] ?? []);
            const marked = flaggedIds.includes(question.id);
            return (
              <button
                key={question.id}
                id={`exam-q-${questionIndex}`}
                type="button"
                onClick={() => {
                  setIndex(questionIndex);
                  setReviewOpen(false);
                }}
                className={`relative h-11 w-11 shrink-0 rounded-lg text-sm font-medium transition-colors ${
                  questionIndex === index
                    ? `${accent.mark} shadow-sm`
                    : answered
                      ? accent.pill
                      : "bg-white text-slate-600 shadow-sm"
                } ${marked ? "ring-2 ring-amber-400" : ""}`}
                aria-current={questionIndex === index ? "true" : undefined}
                aria-label={`第 ${questionIndex + 1} 題${answered ? "，已答" : "，未答"}${marked ? "，已標記" : ""}`}
              >
                {questionIndex + 1}
              </button>
            );
          })}
        </div>
      </div>
      {gradeError ? <p className="text-sm text-amber-800">{gradeError}</p> : null}

      {reviewOpen ? (
        <ExamReviewSheet
          unanswered={review.unanswered}
          flagged={review.flagged}
          onJump={(questionIndex) => {
            setIndex(questionIndex);
            setReviewOpen(false);
          }}
          onBack={() => setReviewOpen(false)}
          onSubmit={() => void finishExam({ skipConfirm: true })}
        />
      ) : clockPaused ? (
        <div className="qb-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-500">考試已暫停</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">剩餘 {formatClock(remaining)}</h2>
          <p className="mt-2 text-sm text-slate-500">倒數已凍結。繼續後才會再計時。</p>
          <button
            type="button"
            onClick={resumeClock}
            className={`mt-6 rounded-2xl px-5 py-3 text-base font-extrabold text-white ${accent.btn}`}
          >
            繼續作答
          </button>
        </div>
      ) : (
        <QuestionPlayer
          question={current}
          selected={answers[current.id] ?? []}
          onChange={(selected) =>
            setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: selected }))
          }
          examMode
        />
      )}

      <QuizActionBar>
        {reviewOpen ? (
          <>
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm sm:px-4 sm:text-base"
            >
              返回作答
            </button>
            <button
              type="button"
              onClick={() => finishExam({ skipConfirm: true })}
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-white sm:px-4 sm:text-base"
            >
              確定交卷
            </button>
          </>
        ) : clockPaused ? (
          <>
            <button
              type="button"
              onClick={resumeClock}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm sm:px-4 sm:text-base"
            >
              繼續作答
            </button>
            <button
              type="button"
              onClick={() => finishExam()}
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-white sm:px-4 sm:text-base"
            >
              交卷
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:text-slate-400 sm:px-4 sm:text-base"
            >
              上一題
            </button>
            <button
              type="button"
              onClick={() => toggleFlag(current.id)}
              className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm sm:px-4 sm:text-base ${
                flagged ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white"
              }`}
            >
              {flagged ? "已標記" : "標記"}
            </button>
            <button
              type="button"
              disabled={index === quiz.length - 1}
              onClick={() => setIndex((value) => Math.min(quiz.length - 1, value + 1))}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:text-slate-400 sm:px-4 sm:text-base"
            >
              下一題
            </button>
            <button
              type="button"
              onClick={() => finishExam()}
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-white sm:px-4 sm:text-base"
            >
              交卷
            </button>
          </>
        )}
      </QuizActionBar>
    </div>
  );
}

function ExamReviewSheet({
  unanswered,
  flagged,
  onJump,
  onBack,
  onSubmit,
}: {
  unanswered: number[];
  flagged: number[];
  onJump: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="qb-card space-y-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">交卷前檢查</h2>
        <p className="mt-1 text-sm text-slate-500">交卷後不能再改答案。可先跳去未答或標記的題。</p>
      </div>
      <ReviewGroup title={`未答 ${unanswered.length} 題`} indexes={unanswered} empty="都答完了" onJump={onJump} />
      <ReviewGroup title={`已標記 ${flagged.length} 題`} indexes={flagged} empty="沒有標記" onJump={onJump} />
      <div className="hidden gap-2 sm:flex">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
        >
          返回作答
        </button>
        <button type="button" onClick={onSubmit} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
          確定交卷
        </button>
      </div>
    </div>
  );
}

function ReviewGroup({
  title,
  indexes,
  empty,
  onJump,
}: {
  title: string;
  indexes: number[];
  empty: string;
  onJump: (index: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {indexes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {indexes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onJump(item)}
              className="h-11 w-11 rounded-lg bg-slate-100 text-sm font-medium text-slate-800"
            >
              {item + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
