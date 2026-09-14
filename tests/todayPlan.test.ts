import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayKey,
  parseDailyGoal,
  pickTodayQuiz,
  todayAttemptCount,
  todaySessionSize,
} from "../lib/todayPlan";
import type { ProgressStore } from "../lib/types";
import { attempt, makeQuestion } from "./util";

const now = Date.parse("2026-08-21T10:00:00+08:00");

function store(attempts: ProgressStore["attempts"] = []): ProgressStore {
  return { attempts, examHistory: [], labCompletions: [], starredIds: [], notes: {} };
}

function q(id: string, chapter: string, extra?: { passageId?: string }) {
  return makeQuestion({ id, chapter, type: "single", stem: id, ...extra });
}

describe("parseDailyGoal / todaySessionSize", () => {
  it("只接受 10、20、30", () => {
    assert.equal(parseDailyGoal("10"), 10);
    assert.equal(parseDailyGoal(20), 20);
    assert.equal(parseDailyGoal("30"), 30);
    assert.equal(parseDailyGoal("15"), 10);
    assert.equal(parseDailyGoal(null), 10);
  });

  it("未達標出剩餘，達標再出一整輪", () => {
    assert.equal(todaySessionSize(10, 0), 10);
    assert.equal(todaySessionSize(10, 7), 3);
    assert.equal(todaySessionSize(10, 10), 10);
    assert.equal(todaySessionSize(20, 25), 20);
  });
});

describe("todayAttemptCount", () => {
  it("只計今天的作答", () => {
    const attempts = [
      attempt("a", true, now - 86_400_000),
      attempt("b", false, now),
      attempt("c", true, now + 1_000),
    ];
    assert.equal(todayAttemptCount(attempts, now), 2);
    assert.equal(dayKey(now), dayKey(now + 1_000));
  });
});

describe("pickTodayQuiz", () => {
  const weakOld = q("weak-old", "弱章");
  const weakNew = q("weak-new", "弱章");
  const strong = q("strong", "強章");
  const strongB = q("strong-b", "強章");
  const fresh = q("fresh", "新章");
  const pool = [weakOld, weakNew, strong, strongB, fresh];

  it("先出未訂正錯題，舊的在前", () => {
    const picked = pickTodayQuiz({
      store: store([attempt("weak-old", false, 20), attempt("weak-new", false, 10)]),
      pool,
      count: 2,
      now,
      random: false,
    });
    assert.deepEqual(
      picked.questions.map((item) => item.id),
      ["weak-new", "weak-old"],
    );
    assert.equal(picked.fromWrong, 2);
  });

  it("錯題不夠時補最低正確率章節的未做題", () => {
    const picked = pickTodayQuiz({
      store: store([
        attempt("weak-old", false, 1),
        attempt("strong", true, 2),
        attempt("strong", true, 3),
      ]),
      pool,
      count: 2,
      now,
      random: false,
    });
    assert.deepEqual(
      picked.questions.map((item) => item.id),
      ["weak-old", "weak-new"],
    );
    assert.equal(picked.fromWrong, 1);
    assert.equal(picked.fromWeak, 1);
  });

  it("弱章補完後才出沒做過的新章", () => {
    const onlyWeak = q("weak-old", "弱章");
    const picked = pickTodayQuiz({
      store: store([
        attempt("weak-old", false, 1),
        attempt("strong", true, 2),
        attempt("strong", true, 3),
      ]),
      pool: [onlyWeak, strong, fresh],
      count: 2,
      now,
      random: false,
    });
    assert.equal(picked.questions[0]?.id, "weak-old");
    assert.equal(picked.questions[1]?.id, "fresh");
    assert.equal(picked.fromFresh, 1);
  });

  it("今天已做過、且不是未訂正錯題的，補題時跳過", () => {
    const picked = pickTodayQuiz({
      store: store([
        attempt("weak-old", false, 1),
        attempt("fresh", true, now),
      ]),
      pool,
      count: 2,
      now,
      random: false,
    });
    assert.equal(picked.questions[0]?.id, "weak-old");
    assert.equal(picked.questions[1]?.id, "weak-new");
    assert.equal(
      picked.questions.some((item) => item.id === "fresh"),
      false,
    );
  });

  it("今天才錯的題明天才進入今日刷", () => {
    const picked = pickTodayQuiz({
      store: store([attempt("weak-old", false, now)]),
      pool,
      count: 1,
      now,
      random: false,
    });
    assert.equal(picked.questions[0]?.id, "weak-new");
    assert.equal(picked.fromWrong, 0);
  });

  it("昨天錯的題今天到期，會優先抽出", () => {
    const yesterday = Date.parse("2026-08-20T10:00:00+08:00");
    const picked = pickTodayQuiz({
      store: store([attempt("weak-old", false, yesterday)]),
      pool,
      count: 1,
      now,
      random: false,
    });
    assert.equal(picked.questions[0]?.id, "weak-old");
    assert.equal(picked.fromWrong, 1);
  });

  it("閱讀同篇會整組帶出", () => {
    const p1 = q("p1", "閱讀", { passageId: "pass-1" });
    const p2 = q("p2", "閱讀", { passageId: "pass-1" });
    const extra = q("x", "其他");
    const picked = pickTodayQuiz({
      store: store([attempt("p1", false, 1)]),
      pool: [p1, extra, p2],
      count: 1,
      now,
      random: false,
    });
    assert.deepEqual(
      picked.questions.map((item) => item.id),
      ["p1", "p2"],
    );
  });
});
