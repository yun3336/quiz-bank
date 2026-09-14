import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gradeChoice,
  gradeQuestion,
  gradeSpeak,
  isAnswered,
  normalizeAnswer,
  revealAnswer,
} from "../lib/grade";
import { makeQuestion } from "./util";

describe("normalizeAnswer", () => {
  it("寬字轉半形並忽略大小寫", () => {
    assert.equal(normalizeAnswer("Ｇｏｅｓ"), "goes");
  });

  it("寬鬆模式去掉中間標點", () => {
    assert.equal(normalizeAnswer("hello, world!", "loose"), "hello world");
  });

  it("嚴格模式只去掉句尾標點", () => {
    assert.equal(normalizeAnswer("hello, world.", "strict"), "hello, world");
  });
});

describe("gradeChoice", () => {
  it("多選不計順序", () => {
    assert.equal(gradeChoice(["A", "C"], ["C", "A"]), true);
  });

  it("少選或多選都錯", () => {
    assert.equal(gradeChoice(["A", "C"], ["A"]), false);
    assert.equal(gradeChoice(["A"], ["A", "B"]), false);
  });
});

describe("gradeQuestion", () => {
  it("單選／是非／看圖比對選項 id", () => {
    const single = makeQuestion({ type: "single", answer: ["B"], options: [] });
    assert.equal(gradeQuestion(single, ["B"]), true);
    assert.equal(gradeQuestion(single, ["A"]), false);

    const hotspot = makeQuestion({ type: "hotspot", answer: ["n2"] });
    assert.equal(gradeQuestion(hotspot, ["n2"]), true);
    assert.equal(gradeQuestion(hotspot, ["n1"]), false);
  });

  it("填空接受別名，寬鬆可帶句號", () => {
    const cloze = makeQuestion({ type: "cloze", blanks: [["goes", "goe s"]] });
    assert.equal(gradeQuestion(cloze, ["Goes"]), true);
    assert.equal(gradeQuestion(cloze, ["goes."]), true);
    assert.equal(gradeQuestion(cloze, ["went"]), false);
    assert.equal(gradeQuestion(cloze, ["goes", "extra"]), false);
  });

  it("簡答與翻譯可用別名；模考嚴格不忽略逗號", () => {
    const short = makeQuestion({ type: "short", aliases: ["謝謝", "多谢"] });
    assert.equal(gradeQuestion(short, ["謝謝"]), true);
    assert.equal(gradeQuestion(short, ["多谢"]), true);
    assert.equal(gradeQuestion(short, [""]), false);

    const translate = makeQuestion({ type: "translate", aliases: ["hello"] });
    assert.equal(gradeQuestion(translate, ["Hello,"], { strict: false }), true);
    assert.equal(gradeQuestion(translate, ["Hello,"], { strict: true }), false);
    assert.equal(gradeQuestion(translate, ["Hello."], { strict: true }), true);
  });

  it("聽寫走別名表，口說永遠從寬", () => {
    const dictation = makeQuestion({ type: "dictation", aliases: ["good morning"] });
    assert.equal(gradeQuestion(dictation, ["Good morning!"]), true);

    const speak = makeQuestion({ type: "speak", aliases: ["good morning"] });
    assert.equal(gradeQuestion(speak, ["I said good morning today"], { strict: true }), true);
    assert.equal(gradeQuestion(speak, ["hello there"], { strict: true }), false);
  });

  it("排序必須完全同序", () => {
    const order = makeQuestion({
      type: "order",
      tokens: [
        { id: "1", text: "enable" },
        { id: "2", text: "conf t" },
        { id: "3", text: "hostname SW" },
      ],
    });
    assert.equal(gradeQuestion(order, ["1", "2", "3"]), true);
    assert.equal(gradeQuestion(order, ["2", "1", "3"]), false);
  });

  it("配對比對右側文字並正規化", () => {
    const match = makeQuestion({
      type: "match",
      pairs: [
        { left: "蘋果", right: "apple" },
        { left: "書", right: "book" },
      ],
    });
    assert.equal(gradeQuestion(match, ["Apple", "BOOK"]), true);
    assert.equal(gradeQuestion(match, ["book", "apple"]), false);
  });
});

describe("gradeSpeak", () => {
  it("空白或無關句子不算對", () => {
    assert.equal(gradeSpeak("", ["hello"]), false);
    assert.equal(gradeSpeak("hmm", ["good morning"]), false);
  });

  it("包含關鍵句且夠長可算對", () => {
    assert.equal(gradeSpeak("please good morning everyone", ["good morning"]), true);
  });
});

describe("isAnswered / revealAnswer", () => {
  it("填空每一格都要有字", () => {
    const cloze = makeQuestion({ type: "cloze", blanks: [["a"], ["b"]] });
    assert.equal(isAnswered(cloze, ["a", ""]), false);
    assert.equal(isAnswered(cloze, ["a", "b"]), true);
    assert.equal(revealAnswer(cloze), "a、b");
  });

  it("選擇題有選就算作答，揭示用選項文字", () => {
    const single = makeQuestion({
      type: "single",
      answer: ["B"],
      options: [
        { id: "A", text: "錯" },
        { id: "B", text: "對" },
      ],
    });
    assert.equal(isAnswered(single, []), false);
    assert.equal(isAnswered(single, ["B"]), true);
    assert.equal(revealAnswer(single), "對");
  });
});
