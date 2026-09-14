"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FlashPanel,
  LanguageModePicker,
  DifficultyPicker,
  ListenPanel,
  SpeedHud,
} from "@/components/LanguagePractice";
import { QuestionPlayer } from "@/components/QuestionPlayer";
import { NeedVendor, VendorBar } from "@/components/VendorBar";
import { PageHeader, ScoreRing } from "@/components/ui";
import { LabSuggestLink, LabSuggestList } from "@/components/LabSuggest";
import { TriviaCard } from "@/components/TriviaCard";
import { SegRadios } from "@/components/SegRadios";
import { EmptyQuizRange, QuizActionBar, QuizSession } from "@/components/QuizChrome";
import { practiceResumeHref, practiceStartHref, type PracticeStart } from "@/lib/quizStart";
import { isAnswered } from "@/lib/grade";
import {
  MATCH_MAX,
  SPEED_SECONDS,
  defaultDrillMode,
  languageModeLabel,
  stopSpeaking,
  type LanguagePracticeMode,
} from "@/lib/languagePractice";
import { ALL_CHAPTER, type DifficultyFilter } from "@/lib/questions";
import {
  gradeRemote,
  loadCatalog,
  loadQuiz,
  OfflineGradeError,
  OFFLINE_GRADE_MESSAGE,
} from "@/lib/questionClient";
import {
  clearPracticeSession,
  loadDailyGoal,
  loadPracticeSession,
  loadProgress,
  recordAttempts,
  savePracticeSession,
  subscribeSession,
} from "@/lib/storage";
import { restoreQuizIndex, type PracticeSession } from "@/lib/session";
import type { Attempt, Question } from "@/lib/types";
import { useActiveVendor } from "@/lib/useResolvedVendor";
import { getChaptersByVendor, hasDrillModes, VENDOR_META, vendorAccent } from "@/lib/vendor";

type Phase = "boot" | "setup" | "quiz" | "done";

export function PracticeClient({ start }: { start: PracticeStart | null }) {
  const { vendor: ctxVendor } = useActiveVendor();
  const vendor = start?.vendor ?? ctxVendor;
  const isResume = Boolean(start?.resume);
  const [todayPlan, setTodayPlan] = useState(start?.plan === "today");
  const [chapters, setChapters] = useState([ALL_CHAPTER]);
  const [gradeError, setGradeError] = useState("");
  const [lastCorrect, setLastCorrect] = useState(true);
  const [phase, setPhase] = useState<Phase>(
    isResume || start?.plan === "today" || start?.go || start?.qid ? "boot" : "setup",
  );
  const [chapter, setChapter] = useState(start?.chapter ?? ALL_CHAPTER);
  const [count, setCount] = useState<number | "all">(start?.count ?? 10);
  const [random, setRandom] = useState(start?.random ?? true);
  const [method, setMethod] = useState<LanguagePracticeMode>(
    start?.method ?? (vendor ? defaultDrillMode(vendor) : "choice"),
  );
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(start?.difficulty ?? "all");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundWrong, setRoundWrong] = useState<Question[]>([]);
  const [remaining, setRemaining] = useState(SPEED_SECONDS);
  const [paused, setPaused] = useState<PracticeSession | null>(null);

  const prevVendor = useRef(vendor);
  useEffect(() => {
    if (prevVendor.current === vendor) return;
    prevVendor.current = vendor;
    setChapter(ALL_CHAPTER);
    setMethod(vendor ? defaultDrillMode(vendor) : "choice");
    setDifficulty("all");
    if (!isResume && !todayPlan) setPhase("setup");
  }, [vendor, isResume, todayPlan]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    setPaused(loadPracticeSession());
    return subscribeSession(() => setPaused(loadPracticeSession()));
  }, []);

  useEffect(() => {
    if (!vendor) return;
    let cancelled = false;
    loadCatalog(vendor)
      .then((items) => {
        if (cancelled) return;
        setChapters([ALL_CHAPTER, ...getChaptersByVendor(vendor, items)]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [vendor]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (isResume) {
        const session = loadPracticeSession();
        if (!session || !(await applyPracticeSession(session))) {
          if (!cancelled) {
            clearPracticeSession();
            setPhase("setup");
          }
        }
        return;
      }
      if (todayPlan && vendor) {
        const session = loadPracticeSession();
        if (session?.plan === "today" && session.vendor === vendor && (await applyPracticeSession(session))) return;
        if (!cancelled) await beginToday(false);
        return;
      }
      if (start?.qid && vendor) {
        try {
          const picked = await loadQuiz({ kind: "ids", vendor, qid: start.qid, ids: [start.qid] });
          if (cancelled) return;
          if (picked.length > 0) {
            setQuiz(picked);
            setChapter(picked[0]?.chapter ?? chapter);
            setPhase("quiz");
          } else setPhase("setup");
        } catch {
          if (!cancelled) setPhase("setup");
        }
        return;
      }
      if (start?.go && vendor) {
        const session = loadPracticeSession();
        if (session && session.vendor === vendor && (await applyPracticeSession(session))) return;
        if (cancelled) return;
        await beginQuiz(start.chapter, start.difficulty);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResume, todayPlan, vendor, start?.go, start?.qid]);

  const current = quiz[index];
  const progress = quiz.length === 0 ? 0 : ((index + (submitted ? 1 : 0)) / quiz.length) * 100;
  const accent = vendor ? vendorAccent(vendor) : vendorAccent("cisco");
  const isDrill = Boolean(vendor && hasDrillModes(vendor));
  const isSpeed = isDrill && method === "speed";

  async function applyPracticeSession(session: PracticeSession): Promise<boolean> {
    if (!vendor) return false;
    let questions = await loadQuiz({ kind: "ids", vendor, ids: session.questionIds });
    if (questions.length === 0) return false;
    const resumeIndex = restoreQuizIndex(session.questionIds, questions, session.index);
    const current = questions[resumeIndex];
    if (current && (session.submitted || session.revealed)) {
      try {
        const result = await gradeRemote(current, session.selected, { peek: true });
        questions = questions.map((item) => (item.id === result.question.id ? result.question : item));
      } catch {
        /* 離線續看題幹，先不揭曉 */
      }
    }
    setTodayPlan(session.plan === "today");
    setChapter(session.chapter);
    setMethod(session.method);
    setDifficulty(session.difficulty);
    setQuiz(questions);
    setIndex(resumeIndex);
    setSelected(session.selected);
    setRevealed(session.revealed);
    setSubmitted(session.submitted);
    setCorrectCount(session.correctCount);
    setRemaining(SPEED_SECONDS);
    setPhase("quiz");
    return true;
  }

  function resetItem() {
    setSelected([]);
    setRevealed(false);
    setSubmitted(false);
    setRemaining(SPEED_SECONDS);
  }

  async function beginToday(fullRound: boolean) {
    if (!vendor) return;
    setGradeError("");
    const goal = loadDailyGoal();
    const size = fullRound || start?.count === "all" || typeof start?.count !== "number" ? goal : start.count;
    try {
      const picked = await loadQuiz({
        kind: "today",
        vendor,
        count: size,
        store: loadProgress(),
      });
      setChapter(ALL_CHAPTER);
      setMethod(defaultDrillMode(vendor));
      setQuiz(picked);
      setIndex(0);
      setCorrectCount(0);
      setRoundWrong([]);
      resetItem();
      setTodayPlan(true);
      setPhase("quiz");
    } catch {
      setGradeError("需連線抽題，請連上網路再試。");
    }
  }

  async function beginQuiz(nextChapter = chapter, nextDifficulty = difficulty) {
    if (!vendor) return;
    setGradeError("");
    try {
      const picked = await loadQuiz({
        kind: "practice",
        vendor,
        chapter: nextChapter,
        count,
        random,
        method,
        difficulty: nextDifficulty,
      });
      setChapter(nextChapter);
      setDifficulty(nextDifficulty);
      setQuiz(picked);
      setIndex(0);
      setCorrectCount(0);
      setRoundWrong([]);
      resetItem();
      setTodayPlan(false);
      setPhase("quiz");
    } catch {
      setGradeError("需連線抽題，請連上網路再試。");
    }
  }

  function saveAttempt(question: Question, chosen: string[], correct: boolean) {
    const attempt: Attempt = {
      questionId: question.id,
      selected: chosen,
      correct,
      at: Date.now(),
      mode: "practice",
    };
    recordAttempts([attempt]);
    if (correct) setCorrectCount((value) => value + 1);
    else setRoundWrong((list) => [...list, question]);
    setLastCorrect(correct);
    setSubmitted(true);
  }

  async function submitChoice() {
    if (!current || !isAnswered(current, selected)) return;
    setGradeError("");
    try {
      const result = await gradeRemote(current, selected);
      setQuiz((list) => list.map((item) => (item.id === result.question.id ? result.question : item)));
      saveAttempt(result.question, selected, result.correct);
    } catch (error) {
      setGradeError(error instanceof OfflineGradeError ? OFFLINE_GRADE_MESSAGE : "批改失敗，請再試一次。");
    }
  }

  function submitFlash(remembered: boolean) {
    if (!current) return;
    saveAttempt(current, [remembered ? "remember" : "forgot"], remembered);
  }

  async function peekFlash() {
    if (!current) return;
    setGradeError("");
    try {
      const result = await gradeRemote(current, [], { peek: true });
      setQuiz((list) => list.map((item) => (item.id === result.question.id ? result.question : item)));
      setRevealed(true);
    } catch (error) {
      setGradeError(error instanceof OfflineGradeError ? OFFLINE_GRADE_MESSAGE : "需連線才能看答案。");
    }
  }

  async function submitTimeout() {
    if (!current || submitted) return;
    setGradeError("");
    try {
      const result = await gradeRemote(current, selected, { peek: true });
      setQuiz((list) => list.map((item) => (item.id === result.question.id ? result.question : item)));
      saveAttempt(result.question, selected, false);
    } catch (error) {
      setGradeError(error instanceof OfflineGradeError ? OFFLINE_GRADE_MESSAGE : "批改失敗，請再試一次。");
      saveAttempt(current, selected, false);
    }
  }

  function next() {
    stopSpeaking();
    if (index + 1 >= quiz.length) {
      clearPracticeSession();
      setPhase("done");
      return;
    }
    setIndex((value) => value + 1);
    resetItem();
  }

  useEffect(() => {
    if (phase !== "quiz" || !vendor || quiz.length === 0) return;
    savePracticeSession({
      version: 1,
      kind: "practice",
      vendor,
      plan: todayPlan ? "today" : null,
      chapter,
      method,
      difficulty,
      questionIds: quiz.map((item) => item.id),
      index,
      submitted,
      selected,
      revealed,
      correctCount,
      updatedAt: Date.now(),
    });
  }, [phase, vendor, todayPlan, chapter, method, difficulty, quiz, index, submitted, selected, revealed, correctCount]);

  useEffect(() => {
    if (phase !== "quiz" || !isSpeed || submitted) return;
    setRemaining(SPEED_SECONDS);
    const timer = window.setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, isSpeed, submitted, index]);

  useEffect(() => {
    if (phase === "quiz" && isSpeed && remaining === 0 && !submitted) {
      submitTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, isSpeed, submitted]);

  if (!vendor) {
    return <NeedVendor />;
  }

  if (phase === "boot") {
    return (
      <div className="qb-card px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">
          {isResume ? "載入未完成的練習…" : todayPlan ? "準備今日題目…" : "載入練習…"}
        </p>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="space-y-6 qb-quiz">
        <PageHeader
          title="練習"
          desc={
            vendor === "cisco" || vendor === "huawei"
              ? "可選綜合或只練看圖。交換器設定請走實驗。"
              : "先選方法，再選章節、題數與難度。"
          }
        />
        <VendorBar vendor={vendor} />
        {gradeError ? <p className="text-sm text-amber-800">{gradeError}</p> : null}
        {paused && paused.questionIds.length > 0 ? (
          <div className="qb-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-slate-600">
              有未完成的練習 · 第 {paused.index + 1}／{paused.questionIds.length} 題
            </p>
            <a
              href={practiceResumeHref(paused.vendor)}
              data-full-nav
              className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white ${accent.btn}`}
            >
              繼續
            </a>
          </div>
        ) : null}
        <form id="practice-setup" className="space-y-5" method="get" action="/practice" target="_top">
          <input type="hidden" name="vendor" value={vendor} />
          <input type="hidden" name="go" value="1" />
          {isDrill ? (
            <LanguageModePicker key={vendor} vendor={vendor} value={method} onChange={setMethod} />
          ) : (
            <input type="hidden" name="method" value={method} />
          )}
          <div className="qb-group">
            <label className="qb-row">
              <span className="shrink-0 text-sm text-slate-500">章節</span>
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
            <p className="qb-section">{method === "match" ? "配對組數" : method === "reading" ? "閱讀篇數" : "題數"}</p>
            <SegRadios
              name="count"
              value={String(count)}
              options={([10, 20, "all"] as const).map((item) => ({
                id: String(item),
                label: item === "all" ? "全部" : method === "reading" ? `${item} 篇` : `${item} 題`,
              }))}
              onChange={(id) => setCount(id === "all" ? "all" : Number(id))}
            />
            {method === "mixed" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">綜合會混出選擇、填空、排序與看圖。交換器設定請走實驗。</p>
            ) : null}
            {method === "match" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">
                優先出原生配對題；不夠時會把選擇題編成一組，每組最多 {MATCH_MAX} 對。
              </p>
            ) : null}
            {method === "reading" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">同一篇短文的 2～4 題會整組出，不會拆開。</p>
            ) : null}
            {method === "translate" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">中→英、英→日。練習可用別名；模考批改較嚴。</p>
            ) : null}
            {method === "dictation" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">有錄音檔就播檔；沒有才用瀏覽器朗讀。</p>
            ) : null}
            {method === "hotspot" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">在圖上點選正確區域。網路設定仍請走實驗。</p>
            ) : null}
            {method === "speak" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">需麥克風。語音辨識不穩，接近即可。</p>
            ) : null}
            {method === "audio" ? (
              <p className="mt-2 px-1 text-xs text-slate-500">播放錄音檔後作答。</p>
            ) : null}
          </div>
          <div>
            <p className="qb-section">出題順序</p>
            <SegRadios
              name="random"
              value={random ? "1" : "0"}
              options={[
                { id: "0", label: "順序" },
                { id: "1", label: "亂序" },
              ]}
              onChange={(id) => setRandom(id === "1")}
            />
          </div>
          <QuizActionBar>
            <a
              href={practiceStartHref({ vendor, chapter, count, random, method, difficulty })}
              target="_top"
              onClick={(event) => {
                if (
                  paused &&
                  !window.confirm("有未完成的練習，開始新的一輪會放棄上一輪。繼續？")
                ) {
                  event.preventDefault();
                  return;
                }
                clearPracticeSession();
              }}
              className={`qb-press flex flex-1 items-center justify-center rounded-2xl px-4 py-3.5 text-center text-base font-extrabold text-white ${accent.btn}`}
            >
              開始{isDrill ? languageModeLabel(method) : ""}練習
            </a>
          </QuizActionBar>
        </form>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-5">
        <div className="qb-card px-6 py-10 text-center">
          <p className={`text-sm font-medium ${accent.text}`}>
            {VENDOR_META[vendor].label}
            {todayPlan ? " · 今日刷" : isDrill ? ` · ${languageModeLabel(method)}` : ""}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{todayPlan ? "今日刷完成" : "練習完成"}</h1>
          <div className={`mt-6 ${accent.text}`}>
            <ScoreRing value={correctCount} total={quiz.length} />
          </div>
          <p className="mt-4 text-slate-600">
            答對 {correctCount} / {quiz.length} 題
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => (todayPlan ? beginToday(true) : setPhase("setup"))}
              className={`rounded-xl px-5 py-3 font-medium text-white ${accent.btn}`}
            >
              再練一輪
            </button>
            <Link href={todayPlan ? "/" : "/stats"} className="rounded-xl border border-slate-200 px-5 py-3">
              {todayPlan ? "回首頁" : "看統計"}
            </Link>
          </div>
        </div>
        <LabSuggestList questions={roundWrong} vendor={vendor} heading="這輪錯題對應實驗" />
        <TriviaCard vendor={vendor} compact start="open" />
      </div>
    );
  }

  if (phase === "quiz" && quiz.length === 0) {
    const canRelax = chapter !== ALL_CHAPTER || difficulty !== "all";
    return (
      <div className="space-y-6 qb-in">
        <EmptyQuizRange
          desc={
            canRelax
              ? "目前篩選（章節或難度）沒有題可出。可放寬條件，或回設定改練習方法。"
              : "這個方法或章節暫時沒有題。請回設定換方法或章節。"
          }
          onBack={() => setPhase("setup")}
          canRelaxFilters={canRelax}
          onRelaxFilters={() => beginQuiz(ALL_CHAPTER, "all")}
        />
      </div>
    );
  }

  if (!current) {
    return (
      <EmptyQuizRange desc="這一輪沒有可作答的題。" onBack={() => setPhase("setup")} />
    );
  }

  const canSubmit = isAnswered(current, selected);

  return (
    <QuizSession
      accentBar={accent.bar}
      progress={progress}
      title={`${VENDOR_META[vendor].label}${
        todayPlan ? " · 今日刷" : isDrill ? ` · ${languageModeLabel(method)}` : ""
      }${current.passageId ? " · 閱讀同篇" : ""} · 第 ${index + 1} / ${quiz.length} 題`}
      meta={isSpeed && !submitted ? undefined : `已對 ${correctCount} 題`}
      extraMeta={isSpeed && !submitted ? <SpeedHud remaining={remaining} /> : undefined}
      submitted={submitted}
      canSubmit={method === "flash" ? false : canSubmit}
      onSubmit={submitChoice}
      onNext={next}
      actions={
        method === "flash" && isDrill ? (
          submitted ? (
            <button type="button" onClick={next} className="flex-1 rounded-xl bg-slate-900 px-4 py-3.5 font-medium text-white">
              {index + 1 >= quiz.length ? "看本輪結果" : "下一張"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!revealed}
                onClick={() => submitFlash(true)}
                className={`flex-1 rounded-xl px-4 py-3.5 font-medium text-white disabled:bg-slate-300 ${accent.btn}`}
              >
                記得
              </button>
              <button
                type="button"
                disabled={!revealed}
                onClick={() => submitFlash(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium disabled:text-slate-300"
              >
                還不熟
              </button>
            </>
          )
        ) : !submitted ? (
          <button
            type="button"
            onClick={submitChoice}
            disabled={!canSubmit}
            className={`flex-1 rounded-xl px-4 py-3.5 font-medium text-white disabled:bg-slate-300 ${accent.btn}`}
          >
            {isSpeed ? "提交（逾時算錯）" : "提交"}
          </button>
        ) : (
          <button type="button" onClick={next} className="flex-1 rounded-xl bg-slate-900 px-4 py-3.5 font-medium text-white">
            {index + 1 >= quiz.length ? "看本輪結果" : "下一題"}
          </button>
        )
      }
    >
      {method === "flash" && isDrill ? (
        <FlashPanel question={current} revealed={revealed} onReveal={() => void peekFlash()} />
      ) : method === "listen" && vendor === "language" ? (
        <ListenPanel question={current} selected={selected} onChange={setSelected} submitted={submitted} />
      ) : (
        <QuestionPlayer
          question={current}
          selected={selected}
          onChange={setSelected}
          disabled={submitted}
          showResult={submitted}
        />
      )}
      {gradeError ? <p className="text-sm text-amber-800">{gradeError}</p> : null}
      {submitted && method !== "flash" && current && !lastCorrect ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-800">
            已列入錯題本，明天會進今日刷。可到{" "}
            <Link href={`/review?vendor=${vendor}`} className="underline">
              複習
            </Link>{" "}
            再練。
          </p>
          <LabSuggestLink question={current} vendor={vendor} />
        </div>
      ) : null}
    </QuizSession>
  );
}
