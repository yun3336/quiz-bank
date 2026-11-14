import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canGradeOffline, gradeOffline, questionHasGradingSecrets } from "../lib/offlineGrade";
import { toPublicQuestion } from "../lib/questionPublic";
import {
  expandPassageInPool,
  pickQuestionsFromPool,
  resolveQuestionInPool,
} from "../lib/quizPick.shared";
import type { Question } from "../lib/types";
import { makeQuestion } from "./util";

describe("offline grading secrets", () => {
  it("公開題（去正解）不能離線批改", () => {
    const full = makeQuestion({
      type: "single",
      answer: ["A"],
      options: [
        { id: "A", text: "對" },
        { id: "B", text: "錯" },
      ],
      explanation: "解析",
    });
    const published = toPublicQuestion(full);
    assert.equal(questionHasGradingSecrets(published), false);
    assert.equal(canGradeOffline(published), false);
  });

  it("完整單選可離線批改並還原解析", () => {
    const full = makeQuestion({
      type: "single",
      answer: ["B"],
      options: [
        { id: "A", text: "錯" },
        { id: "B", text: "對" },
      ],
      explanation: "選 B",
    });
    const result = gradeOffline(full, ["B"]);
    assert.equal(result.correct, true);
    assert.equal(result.reveal.explanation, "選 B");
    assert.deepEqual(result.reveal.answer, ["B"]);
  });

  it("填空用 blanks 離線批改", () => {
    const full = makeQuestion({
      type: "cloze",
      blanks: [["vlan", "VLAN"]],
      explanation: "VLAN",
    });
    assert.equal(canGradeOffline(full), true);
    assert.equal(gradeOffline(full, ["vlan"]).correct, true);
    assert.equal(gradeOffline(full, ["wrong"]).correct, false);
  });
});

describe("quizPick.shared offline pool", () => {
  it("依 vendor／數量抽題", () => {
    const pool: Question[] = [
      makeQuestion({ type: "single", chapter: "算術", answer: ["A"], id: "m1" }),
      makeQuestion({ type: "single", chapter: "算術", answer: ["A"], id: "m2" }),
      makeQuestion({ type: "single", chapter: "HCIA 基礎", answer: ["A"], id: "h1" }),
    ];
    const picked = pickQuestionsFromPool(pool, {
      vendor: "math",
      count: 1,
      random: false,
    });
    assert.equal(picked.length, 1);
    assert.equal(picked[0].chapter, "算術");
  });

  it("resolve match-bundle 與 expand passage", () => {
    const a = makeQuestion({ type: "single", id: "a", answer: ["A"], stem: "左1", chapter: "英語" });
    const b = makeQuestion({ type: "single", id: "b", answer: ["B"], stem: "左2", chapter: "英語" });
    const passage = makeQuestion({
      type: "single",
      id: "p1",
      passageId: "pass-1",
      answer: ["A"],
      chapter: "英語",
    });
    const passage2 = makeQuestion({
      type: "single",
      id: "p2",
      passageId: "pass-1",
      answer: ["B"],
      chapter: "英語",
    });
    const pool = [a, b, passage, passage2];
    const bundled = resolveQuestionInPool("match-bundle:a,b", pool);
    assert.ok(bundled);
    assert.equal(bundled?.type, "match");
    assert.equal(expandPassageInPool(passage, pool).length, 2);
  });
});
