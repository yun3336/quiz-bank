import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessChapter, isPaidChapter, PAID_CHAPTERS } from "../lib/access";
import { gradeQuestion } from "../lib/grade";
import { publicQuestionHasSecrets, toPublicQuestion } from "../lib/questionPublic";
import { makeQuestion } from "./util";

describe("toPublicQuestion", () => {
  it("拿掉解析、正解與別名", () => {
    const full = makeQuestion({
      type: "single",
      explanation: "這是不該外洩的解析",
      options: [
        { id: "A", text: "錯" },
        { id: "B", text: "對" },
      ],
      answer: ["B"],
      aliases: ["對"],
    });
    const published = toPublicQuestion(full);
    assert.equal(published.explanation, "");
    assert.equal(published.answer, undefined);
    assert.equal(published.aliases, undefined);
    assert.equal(publicQuestionHasSecrets(published), false);
    assert.equal(published.stem, full.stem);
    assert.deepEqual(
      published.options?.map((item) => item.text),
      ["錯", "對"],
    );
  });

  it("填空只留空格數，聽寫拿掉 prompt", () => {
    const cloze = toPublicQuestion(
      makeQuestion({
        type: "cloze",
        blanks: [["goes"], ["went"]],
        explanation: "解析",
      }),
    );
    assert.equal(cloze.blanks?.length, 2);
    assert.deepEqual(cloze.blanks?.[0], []);
    assert.deepEqual(cloze.blanks?.[1], []);

    const dictation = toPublicQuestion(
      makeQuestion({
        type: "dictation",
        prompt: "good morning",
        aliases: ["good morning"],
        explanation: "解析",
      }),
    );
    assert.equal(dictation.prompt, undefined);
    assert.equal(publicQuestionHasSecrets(dictation), false);
  });

  it("排序打亂後仍能用完整題批改", () => {
    const full = makeQuestion({
      type: "order",
      tokens: [
        { id: "1", text: "enable" },
        { id: "2", text: "conf t" },
        { id: "3", text: "hostname SW" },
      ],
      explanation: "先進入特權再設定",
    });
    const published = toPublicQuestion(full);
    const publishedIds = (published.tokens ?? []).map((token) => token.id).sort();
    assert.deepEqual(publishedIds, ["1", "2", "3"]);
    assert.equal(publicQuestionHasSecrets(published), false);
    assert.equal(gradeQuestion(full, ["1", "2", "3"]), true);
    assert.equal(gradeQuestion(full, ["3", "2", "1"]), false);
  });

  it("配對右側打亂後仍能用完整題批改", () => {
    const full = makeQuestion({
      type: "match",
      pairs: [
        { left: "蘋果", right: "apple" },
        { left: "書", right: "book" },
      ],
      explanation: "對應單字",
    });
    const published = toPublicQuestion(full);
    assert.deepEqual(
      (published.pairs ?? []).map((pair) => pair.left),
      ["蘋果", "書"],
    );
    const rights = (published.pairs ?? []).map((pair) => pair.right).sort();
    assert.deepEqual(rights, ["apple", "book"]);
    assert.equal(publicQuestionHasSecrets(published), false);
    assert.equal(gradeQuestion(full, ["Apple", "BOOK"]), true);
    assert.equal(gradeQuestion(full, ["book", "apple"]), false);
  });
});

describe("access 預留", () => {
  it("標出之後要收費的章，現在一律放行", () => {
    assert.ok(PAID_CHAPTERS.includes("HCIE 數通"));
    assert.equal(isPaidChapter("HCIE 數通"), true);
    assert.equal(isPaidChapter("HCIA 數通"), false);
    assert.equal(canAccessChapter("HCIE 數通"), true);
    assert.equal(canAccessChapter("計算機基礎"), true);
  });
});
