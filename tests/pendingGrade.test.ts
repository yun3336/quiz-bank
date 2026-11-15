import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyPendingQueue,
  enqueueExamBatch,
  enqueueGrade,
  markGradeSettled,
  openPendingGrades,
  parsePendingQueue,
  pendingCounts,
  removeSettled,
} from "../lib/pendingGrade";
import { checkRateLimit, resetRateLimitBuckets } from "../lib/rateLimit";
import { publicQuestionHasSecrets, toPublicQuestion } from "../lib/questionPublic";
import { makeQuestion } from "./util";

describe("pending grade queue", () => {
  it("enqueue 不重複同一題同一作答", () => {
    let queue = emptyPendingQueue();
    queue = enqueueGrade(queue, {
      questionId: "q1",
      selected: ["A"],
      mode: "practice",
      at: 1,
    });
    queue = enqueueGrade(queue, {
      questionId: "q1",
      selected: ["A"],
      mode: "practice",
      at: 2,
    });
    assert.equal(openPendingGrades(queue).length, 1);
  });

  it("settle 後不再算 open；冪等可再標記", () => {
    let queue = enqueueGrade(emptyPendingQueue(), {
      id: "pg-1",
      questionId: "q1",
      selected: ["B"],
      mode: "practice",
      at: 10,
    });
    queue = markGradeSettled(queue, "pg-1", 20);
    assert.equal(openPendingGrades(queue).length, 0);
    queue = removeSettled(queue, 0, 20);
    assert.equal(queue.grades.length, 0);
  });

  it("exam batch 計入 pendingCounts 且同內容不重複", () => {
    const payload = {
      items: [{ questionId: "q1", selected: ["A"] }],
      startedAt: 1,
      durationSec: 60,
      chapter: "測試",
      total: 1,
      at: 2,
    };
    let queue = emptyPendingQueue();
    queue = enqueueExamBatch(queue, payload);
    queue = enqueueExamBatch(queue, payload);
    const counts = pendingCounts(queue);
    assert.equal(counts.exams, 1);
    assert.equal(counts.total, 1);
  });

  it("parse 壞資料回空佇列", () => {
    assert.deepEqual(parsePendingQueue(null), emptyPendingQueue());
    assert.deepEqual(parsePendingQueue({ version: 1, grades: "x" }).grades, []);
  });

  it("冪等 settle：重複標記仍只有一筆已結案", () => {
    let queue = enqueueGrade(emptyPendingQueue(), {
      id: "pg-idem",
      questionId: "q9",
      selected: ["A"],
      mode: "practice",
      at: 1,
    });
    queue = markGradeSettled(queue, "pg-idem", 2);
    queue = markGradeSettled(queue, "pg-idem", 3);
    assert.equal(openPendingGrades(queue).length, 0);
    assert.equal(queue.grades.filter((g) => g.settledAt).length, 1);
  });
});

describe("rateLimit in-memory", () => {
  it("超過上限回 retry", () => {
    resetRateLimitBuckets();
    const key = "test:ip";
    assert.equal(checkRateLimit(key, 2, 60_000, 1000).ok, true);
    assert.equal(checkRateLimit(key, 2, 60_000, 1000).ok, true);
    const blocked = checkRateLimit(key, 2, 60_000, 1000);
    assert.equal(blocked.ok, false);
  });
});

describe("public questions exclude secrets", () => {
  it("toPublicQuestion 去掉 explanation／answer", () => {
    const full = makeQuestion({
      type: "single",
      answer: ["A"],
      explanation: "機密解析",
      options: [
        { id: "A", text: "對" },
        { id: "B", text: "錯" },
      ],
    });
    const published = toPublicQuestion(full);
    assert.equal(publicQuestionHasSecrets(published), false);
    assert.equal(published.explanation, "");
    assert.equal(published.answer, undefined);
  });
});
