import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactAttempts, compactExamHistory, mergeAttempts, mergeNotes, mergeProgressStores, normalizeNote } from "../lib/progress";
import { isOpenWrong } from "../lib/wrongBook";
import { attempt } from "./util";
import type { ProgressStore } from "../lib/types";

function emptyStore(overrides: Partial<ProgressStore> = {}): ProgressStore {
  return {
    attempts: [],
    examHistory: [],
    labCompletions: [],
    starredIds: [],
    notes: {},
    ...overrides,
  };
}

describe("mergeAttempts", () => {
  it("同一筆作答只留一次，並依時間排序", () => {
    const a = attempt("q1", false, 20, { selected: ["A"] });
    const b = attempt("q1", false, 20, { selected: ["A"] });
    const c = attempt("q2", true, 10);
    const merged = mergeAttempts([a], [b, c]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].questionId, "q2");
    assert.equal(merged[1].questionId, "q1");
  });
});

describe("compactAttempts", () => {
  it("未超過上限原樣保留", () => {
    const attempts = [attempt("q1", true, 1), attempt("q2", false, 2)];
    assert.equal(compactAttempts(attempts, 10), attempts);
  });

  it("收斂時仍保留未訂正錯題的最後一次錯誤", () => {
    const oldWrong = attempt("open", false, 1);
    const filler = Array.from({ length: 8 }, (_, index) => attempt("other", true, 100 + index));
    const compacted = compactAttempts([oldWrong, ...filler], 5);
    assert.ok(compacted.some((item) => item.questionId === "open" && !item.correct));
    assert.equal(isOpenWrong(compacted, "open"), true);
    assert.ok(compacted.length <= 6);
  });

  it("已連對三次的舊錯題可以丟掉", () => {
    const oldWrong = attempt("cleared", false, 1);
    const filler = Array.from({ length: 8 }, (_, index) => attempt("other", true, 100 + index));
    const recent = [
      attempt("cleared", true, 200),
      attempt("cleared", true, 201),
      attempt("cleared", true, 202),
    ];
    const compacted = compactAttempts([oldWrong, ...filler, ...recent], 5);
    assert.equal(
      compacted.some((item) => item.questionId === "cleared" && !item.correct),
      false,
    );
    assert.equal(isOpenWrong(compacted, "cleared"), false);
  });
});

describe("compactExamHistory / mergeProgressStores", () => {
  it("模考只留最新的幾場", () => {
    const exams = Array.from({ length: 5 }, (_, index) => ({
      id: `e${index}`,
      startedAt: index,
      durationSec: 60,
      score: 1,
      total: 10,
    }));
    const kept = compactExamHistory(exams, 3);
    assert.deepEqual(
      kept.map((item) => item.id),
      ["e4", "e3", "e2"],
    );
  });

  it("合併收藏與實驗，實驗保留較早完成時間", () => {
    const merged = mergeProgressStores(
      emptyStore({
        starredIds: ["a"],
        labCompletions: [{ labId: "basic-setup", at: 50 }],
      }),
      emptyStore({
        starredIds: ["a", "b"],
        labCompletions: [{ labId: "basic-setup", at: 20 }],
      }),
    );
    assert.deepEqual(merged.starredIds.sort(), ["a", "b"]);
    assert.equal(merged.labCompletions[0]?.at, 20);
  });

  it("合併筆記時空白丟掉，兩邊都有則留較長的", () => {
    const merged = mergeProgressStores(
      emptyStore({ notes: { a: "短", b: "留下", c: "   " } }),
      emptyStore({ notes: { a: "比較長的備註", c: "新的", d: "只有檔案" } }),
    );
    assert.equal(merged.notes.a, "比較長的備註");
    assert.equal(merged.notes.b, "留下");
    assert.equal(merged.notes.c, "新的");
    assert.equal(merged.notes.d, "只有檔案");
  });
});

describe("normalizeNote / mergeNotes", () => {
  it("去掉空白並截到上限", () => {
    assert.equal(normalizeNote("  hi  "), "hi");
    assert.equal(normalizeNote("  "), "");
    assert.equal(normalizeNote("x".repeat(2001)).length, 2000);
  });

  it("空字串不覆蓋已有筆記", () => {
    assert.deepEqual(mergeNotes({ a: "留著" }, { a: "   " }), { a: "留著" });
  });
});
