"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LabSuggestLink, LabSuggestList } from "@/components/LabSuggest";
import { QuestionPlayer } from "@/components/QuestionPlayer";
import { NeedVendor, VendorBar } from "@/components/VendorBar";
import { EmptyState, PageHeader, ScoreRing } from "@/components/ui";
import { EmptyQuizRange, QuizSession } from "@/components/QuizChrome";
import { SegRadios } from "@/components/SegRadios";
import { StarControl } from "@/components/StarControl";
import { NoteControl } from "@/components/NoteControl";
import { isAnswered } from "@/lib/grade";
import { stopSpeaking } from "@/lib/languagePractice";
import {
  gradeRemote,
  loadCatalog,
  loadQuiz,
  OfflineGradeError,
} from "@/lib/questionClient";
import { consecutiveCorrect, dueLabel, dueWrongCount, expandForReview, isOpenWrong, openWrongCount, pickReviewQuiz, reviewItems, reviewTypeLabel, WRONG_CLEAR_STREAK, wrongDueDay, type ReviewTab } from "@/lib/review";
import { loadProgress, recordAttempts, subscribeProgress } from "@/lib/storage";
import type { Attempt, ProgressStore, Question } from "@/lib/types";
import { useActiveVendor } from "@/lib/useResolvedVendor";
import { VENDOR_META, vendorAccent } from "@/lib/vendor";

type Phase = "list" | "quiz" | "done";

function formatWhen(at: number): string {
  if (!at) return "尚未作答";
  return new Date(at).toLocaleString("zh-Hant");
}

export default function ReviewPage() {
  return <ReviewInner />;
}

function ReviewInner() {
  const { vendor } = useActiveVendor();
  const [store, setStore] = useState<ProgressStore>(loadProgress);
  const [tab, setTab] = useState<ReviewTab>("wrong");
  const [phase, setPhase] = useState<Phase>("list");
  const [count, setCount] = useState<number | "all">(10);
  const [random, setRandom] = useState(true);
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [pool, setPool] = useState<Question[]>([]);
  const [gradeError, setGradeError] = useState("");
  const [lastCorrect, setLastCorrect] = useState(true);

  useEffect(() => {
    const sync = () => setStore(loadProgress());
    sync();
    return subscribeProgress(sync);
  }, []);

  useEffect(() => {
    if (!vendor) return;
    const active = vendor;
    let cancelled = false;
    async function load() {
      const progress = loadProgress();
      const catalog = await loadCatalog(active);
      const known = new Set(catalog.map((item) => item.id));
      const extraIds = [
        ...progress.attempts.map((item) => item.questionId),
        ...progress.starredIds,
        ...Object.keys(progress.notes ?? {}),
      ].filter((id) => !known.has(id));
      const extra = extraIds.length > 0 ? await loadQuiz({ kind: "ids", vendor: active, ids: [...new Set(extraIds)] }) : [];
      if (!cancelled) setPool([...catalog, ...extra]);
    }
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [vendor]);

  useEffect(() => {
    setPhase("list");
    setTab("wrong");
  }, [vendor]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (!vendor) {
    return <NeedVendor />;
  }

  const accent = vendorAccent(vendor);
  const meta = VENDOR_META[vendor];
  const items = reviewItems(store, vendor, tab, pool);
  const wrongTotal = openWrongCount(store, vendor, pool);
  const dueTotal = dueWrongCount(store, vendor, pool);
  const starredTotal = reviewItems(store, vendor, "starred", pool).length;
  const notedTotal = reviewItems(store, vendor, "noted", pool).length;
  const current = quiz[index];
  const progress = quiz.length === 0 ? 0 : ((index + (submitted ? 1 : 0)) / quiz.length) * 100;

  function start(fromItems = items) {
    const picked = pickReviewQuiz(fromItems, count, random, pool);
    setQuiz(picked);
    setIndex(0);
    setSelected([]);
    setSubmitted(false);
    setCorrectCount(0);
    setPhase("quiz");
  }

  function startOne(question: Question) {
    setQuiz(expandForReview([question], pool));
    setIndex(0);
    setSelected([]);
    setSubmitted(false);
    setCorrectCount(0);
    setPhase("quiz");
  }

  async function submit() {
    if (!current || !isAnswered(current, selected)) return;
    setGradeError("");
    try {
      const result = await gradeRemote(current, selected);
      setQuiz((list) => list.map((item) => (item.id === result.question.id ? result.question : item)));
      const attempt: Attempt = {
        questionId: current.id,
        selected,
        correct: result.correct,
        at: Date.now(),
        mode: "practice",
      };
      recordAttempts([attempt]);
      if (result.correct) setCorrectCount((value) => value + 1);
      setLastCorrect(result.correct);
      setSubmitted(true);
    } catch (error) {
      setGradeError(error instanceof OfflineGradeError ? error.message : "批改失敗，請再試一次。");
    }
  }

  function next() {
    stopSpeaking();
    if (index + 1 >= quiz.length) {
      setPhase("done");
      return;
    }
    setIndex((value) => value + 1);
    setSelected([]);
    setSubmitted(false);
    setLastCorrect(true);
    setGradeError("");
  }

  if (phase === "done") {
    return (
      <div className="qb-card qb-in px-6 py-10 text-center">
        <p className={`text-sm font-medium ${accent.text}`}>{meta.label} · 複習</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">這輪複習完成</h1>
        <div className={`mt-6 ${accent.text}`}>
          <ScoreRing value={correctCount} total={quiz.length} />
        </div>
        <p className="mt-4 text-slate-600">
          答對 {correctCount} / {quiz.length} 題。錯題依 1／3／7 天回訪，連對三次才離開。
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => setPhase("list")} className={`rounded-xl px-5 py-3 font-medium text-white ${accent.btn}`}>
            回複習清單
          </button>
          <Link href={`/stats?vendor=${vendor}`} className="rounded-xl border border-slate-200 px-5 py-3">
            看統計
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    if (!current) {
      return (
        <EmptyQuizRange
          desc="這一輪沒有可複習的題，請回清單再選一次。"
          onBack={() => setPhase("list")}
          backLabel="回複習清單"
        />
      );
    }
    const canSubmit = isAnswered(current, selected);
    const justWrong = submitted && !lastCorrect;
    const stillOpen = isOpenWrong(store.attempts, current.id);
    const nextDue = stillOpen ? wrongDueDay(store.attempts, current.id) : null;
    return (
      <QuizSession
        accentBar={accent.bar}
        progress={progress}
        title={`${meta.label} · 複習 · 第 ${index + 1} / ${quiz.length} 題`}
        meta={`已對 ${correctCount} 題`}
        submitted={submitted}
        canSubmit={canSubmit}
        onSubmit={submit}
        onNext={next}
        actions={
          !submitted ? (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={`flex-1 rounded-xl px-4 py-3.5 font-medium text-white disabled:bg-slate-300 ${accent.btn}`}
            >
              提交
            </button>
          ) : (
            <button type="button" onClick={next} className="flex-1 rounded-xl bg-slate-900 px-4 py-3.5 font-medium text-white">
              {index + 1 >= quiz.length ? "看本輪結果" : "下一題"}
            </button>
          )
        }
      >
        <QuestionPlayer
          question={current}
          selected={selected}
          onChange={setSelected}
          disabled={submitted}
          showResult={submitted}
        />
        {justWrong ? (
          <p className="text-sm text-amber-800">間隔重置，明天會出現在今日刷。</p>
        ) : submitted && stillOpen && nextDue ? (
          <p className="text-sm text-slate-600">
            下次複習：{dueLabel(nextDue)}。再對 {WRONG_CLEAR_STREAK - consecutiveCorrect(store.attempts, current.id)}{" "}
            次會離開錯題本。
          </p>
        ) : submitted ? (
          <p className="text-sm text-emerald-700">已通過 1／3／7 天複習，將離開錯題本。</p>
        ) : null}
        {gradeError ? <p className="text-sm text-amber-800">{gradeError}</p> : null}
        {submitted && !lastCorrect ? <LabSuggestLink question={current} vendor={vendor} /> : null}
      </QuizSession>
    );
  }

  return (
    <div className="space-y-6 qb-in">
      <PageHeader title="複習" desc="錯題依 1／3／7 天回訪。到期的會進今日刷；收藏與筆記也留在這裡。" />
      <VendorBar vendor={vendor} />
      <div className="qb-seg">
        <button type="button" aria-pressed={tab === "wrong"} onClick={() => setTab("wrong")}>
          錯題 {wrongTotal}
          {dueTotal > 0 ? ` · 到期 ${dueTotal}` : ""}
        </button>
        <button type="button" aria-pressed={tab === "starred"} onClick={() => setTab("starred")}>
          收藏 {starredTotal}
        </button>
        <button type="button" aria-pressed={tab === "noted"} onClick={() => setTab("noted")}>
          筆記 {notedTotal}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={tab === "wrong" ? "目前沒有未訂正的錯題" : tab === "starred" ? "還沒有收藏" : "還沒有筆記"}
          desc={
            tab === "wrong"
              ? `先去做 ${meta.label} 練習或模考，答錯的題會出現在這裡。`
              : tab === "starred"
                ? "作答時點「收藏」，題目會留在這個清單。"
                : "作答時點「筆記」，寫給自己看的提示會出現在這裡。"
          }
        >
          <Link href={`/practice?vendor=${vendor}`} className={`inline-block rounded-xl px-4 py-3 text-white ${accent.btn}`}>
            去練習
          </Link>
        </EmptyState>
      ) : (
        <>
          {tab === "wrong" ? (
            <LabSuggestList
              questions={items.map((item) => item.question)}
              vendor={vendor}
              heading="錯題對應實驗"
              completedIds={new Set(store.labCompletions.map((item) => item.labId))}
            />
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              start();
            }}
          >
            <div>
              <p className="qb-section">本題複習題數</p>
              <SegRadios
                name="count"
                value={String(count)}
                options={([10, 20, "all"] as const).map((item) => ({
                  id: String(item),
                  label: item === "all" ? "全部" : `${item} 題`,
                }))}
                onChange={(id) => setCount(id === "all" ? "all" : Number(id))}
              />
            </div>
            <div>
              <p className="qb-section">出題順序</p>
              <SegRadios
                name="random"
                value={random ? "1" : "0"}
                options={[
                  { id: "0", label: tab === "wrong" ? "到期先" : "最近先" },
                  { id: "1", label: "亂序" },
                ]}
                onChange={(id) => setRandom(id === "1")}
              />
            </div>
            <button type="submit" className={`qb-press w-full rounded-2xl px-4 py-3.5 text-base font-extrabold text-white ${accent.btn}`}>
              開始複習這{tab === "wrong" ? "批錯題" : tab === "starred" ? "批收藏" : "批筆記"}
            </button>
          </form>

          <section className="qb-group">
            {items.map((item) => (
              <article key={item.question.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5">{item.question.chapter}</span>
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-white">{reviewTypeLabel(item.question)}</span>
                  {tab === "wrong" && item.dueDay ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 ${
                        item.due ? "bg-amber-100 text-amber-800" : "bg-slate-100"
                      }`}
                    >
                      {dueLabel(item.dueDay)}
                    </span>
                  ) : null}
                  <span>
                    {item.attemptCount === 0
                      ? "尚未作答"
                      : `錯過 ${item.wrongCount} 次${
                          tab === "wrong" && item.needed > 0 ? ` · 還差 ${item.needed} 次出庫` : ""
                        }`}
                  </span>
                  <StarControl questionId={item.question.id} />
                  <NoteControl questionId={item.question.id} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-900">{item.question.stem}</p>
                {tab === "noted" && store.notes[item.question.id] ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                    {store.notes[item.question.id]}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">{formatWhen(item.lastAt)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <LabSuggestLink question={item.question} vendor={vendor} className={`text-sm font-extrabold ${accent.text}`} />
                    <button
                      type="button"
                      onClick={() => startOne(item.question)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      再練這題
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
