import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchQuestion, searchQuestions, searchReady, stemSnippet } from "../lib/questionSearch";
import { makeQuestion } from "./util";

const pool = [
  makeQuestion({ id: "a", type: "single", stem: "Which VLAN carries native traffic?", chapter: "交換器", tags: ["vlan"] }),
  makeQuestion({ id: "b", type: "single", stem: "OSPF 鄰居如何建立？", chapter: "路由", tags: ["ospf"] }),
  makeQuestion({ id: "c", type: "single", stem: "Choose the next hop.", chapter: "路由", tags: ["static"] }),
  makeQuestion({ id: "d", type: "single", stem: "什麼是路由？", chapter: "基礎", tags: [] }),
];

describe("searchReady / matchQuestion", () => {
  it("中文一個字就能搜，英文至少兩個", () => {
    assert.equal(searchReady("路"), true);
    assert.equal(searchReady("v"), false);
    assert.equal(searchReady("vl"), true);
  });

  it("先比題幹，再標籤，再章節", () => {
    assert.equal(matchQuestion(pool[0], "VLAN"), "stem");
    assert.equal(matchQuestion(pool[0], "vlan"), "stem");
    assert.equal(matchQuestion(pool[2], "static"), "tag");
    assert.equal(matchQuestion(pool[1], "路由"), "chapter");
  });
});

describe("searchQuestions / stemSnippet", () => {
  it("題幹命中排在章節命中前面", () => {
    const hits = searchQuestions(pool, "路由");
    assert.equal(hits[0]?.question.id, "d");
    assert.equal(hits[0]?.field, "stem");
  });

  it("截題幹並對齊關鍵字", () => {
    const long = "A".repeat(40) + "OSPF hello" + "B".repeat(40);
    const snippet = stemSnippet(long, "OSPF", 20);
    assert.ok(snippet.includes("OSPF"));
    assert.ok(snippet.startsWith("…"));
  });
});
