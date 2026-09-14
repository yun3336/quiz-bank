import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectExamReview,
  examClockRemaining,
  formatClock,
  parseExamSession,
  parsePracticeSession,
  remainingExamSec,
  resolveSessionQuestions,
  restoreQuizIndex,
  resumeExamEndsAt,
  type ExamSession,
  type PracticeSession,
} from "../lib/session";
import { makeQuestion } from "./util";

const practice: PracticeSession = {
  version: 1,
  kind: "practice",
  vendor: "cisco",
  plan: "today",
  chapter: "全部章節",
  method: "mixed",
  difficulty: "all",
  questionIds: ["a", "b", "c"],
  index: 1,
  submitted: true,
  selected: ["x"],
  revealed: false,
  correctCount: 1,
  updatedAt: 1_700_000_000_000,
};

const exam: ExamSession = {
  version: 1,
  kind: "exam",
  vendor: "huawei",
  chapter: "HCIA",
  difficulty: 2,
  questionIds: ["e1", "e2"],
  index: 0,
  answers: { e1: ["A"] },
  flaggedIds: ["e2"],
  startedAt: 1_700_000_000_000,
  endsAt: 1_700_000_000_000 + 20 * 60 * 1000,
  minutes: 20,
  pausedRemaining: null,
  pauseMs: 0,
  updatedAt: 1_700_000_000_000,
};

describe("parsePracticeSession", () => {
  it("接受完整場次", () => {
    const parsed = parsePracticeSession(practice);
    assert.deepEqual(parsed, practice);
  });

  it("拒絕空題單或缺欄位", () => {
    assert.equal(parsePracticeSession(null), null);
    assert.equal(parsePracticeSession({ ...practice, questionIds: [] }), null);
    assert.equal(parsePracticeSession({ ...practice, vendor: "nope" }), null);
    assert.equal(parsePracticeSession({ ...practice, method: "essay" }), null);
  });

  it("題號超出範圍會夾回最後一題", () => {
    const parsed = parsePracticeSession({ ...practice, index: 99 });
    assert.equal(parsed?.index, 2);
  });
});

describe("parseExamSession / remainingExamSec", () => {
  it("接受完整場次", () => {
    const parsed = parseExamSession(exam);
    assert.equal(parsed?.vendor, "huawei");
    assert.deepEqual(parsed?.answers.e1, ["A"]);
    assert.deepEqual(parsed?.flaggedIds, ["e2"]);
  });

  it("舊場次沒有標記／暫停欄位仍可讀", () => {
    const { flaggedIds: _f, pausedRemaining: _p, pauseMs: _m, ...legacy } = exam;
    const parsed = parseExamSession(legacy);
    assert.equal(parsed?.pausedRemaining, null);
    assert.deepEqual(parsed?.flaggedIds, []);
    assert.equal(parsed?.pauseMs, 0);
  });

  it("剩餘時間依 endsAt 計算，不會是負的", () => {
    assert.equal(remainingExamSec(exam.endsAt, exam.startedAt), 20 * 60);
    assert.equal(remainingExamSec(exam.endsAt, exam.endsAt + 5_000), 0);
  });

  it("暫停時剩餘時間凍結", () => {
    assert.equal(examClockRemaining({ ...exam, pausedRemaining: 90 }, exam.endsAt), 90);
    assert.equal(examClockRemaining(exam, exam.startedAt), 20 * 60);
    assert.equal(resumeExamEndsAt(90, 1_000) - 1_000, 90_000);
  });

  it("formatClock 補零", () => {
    assert.equal(formatClock(125), "02:05");
    assert.equal(formatClock(-3), "00:00");
  });
});

describe("collectExamReview", () => {
  it("分開列出未答與已標", () => {
    const review = collectExamReview(["a", "b", "c"], (id) => id !== "b", ["c", "b"]);
    assert.deepEqual(review.unanswered, [1]);
    assert.deepEqual(review.flagged, [1, 2]);
  });
});

describe("resolveSessionQuestions / restoreQuizIndex", () => {
  it("依原順序解開，缺題就跳過", () => {
    const map = new Map([
      ["b", makeQuestion({ id: "b", type: "single" })],
      ["c", makeQuestion({ id: "c", type: "single" })],
    ]);
    const questions = resolveSessionQuestions(["a", "b", "c"], map);
    assert.deepEqual(
      questions.map((item) => item.id),
      ["b", "c"],
    );
    assert.equal(restoreQuizIndex(["a", "b", "c"], questions, 2), 1);
    assert.equal(restoreQuizIndex(["a", "b", "c"], questions, 0), 0);
  });
});
