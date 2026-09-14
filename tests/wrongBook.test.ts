import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consecutiveCorrect,
  dayKey,
  dueLabel,
  isDueWrong,
  isOpenWrong,
  shiftDay,
  SRS_INTERVALS,
  WRONG_CLEAR_STREAK,
  wrongDueDay,
} from "../lib/wrongBook";
import { attempt } from "./util";

const now = Date.parse("2026-08-21T10:00:00+08:00");
const yesterday = Date.parse("2026-08-20T10:00:00+08:00");
const twoDaysAgo = Date.parse("2026-08-19T10:00:00+08:00");

describe("wrong book SRS", () => {
  it("間隔是 1、3、7 天，連對三次才出庫", () => {
    assert.deepEqual([...SRS_INTERVALS], [1, 3, 7]);
    assert.equal(WRONG_CLEAR_STREAK, 3);
  });

  it("沒錯過的題不算未訂正", () => {
    const attempts = [attempt("q1", true, 1), attempt("q1", true, 2)];
    assert.equal(isOpenWrong(attempts, "q1"), false);
    assert.equal(consecutiveCorrect(attempts, "q1"), 2);
  });

  it("今天才錯的題明天才到期", () => {
    const attempts = [attempt("q1", false, now)];
    assert.equal(isOpenWrong(attempts, "q1"), true);
    assert.equal(isDueWrong(attempts, "q1", now), false);
    assert.equal(dueLabel(wrongDueDay(attempts, "q1") ?? "", now), "明天");
  });

  it("昨天錯的題今天到期", () => {
    const attempts = [attempt("q1", false, yesterday)];
    assert.equal(isDueWrong(attempts, "q1", now), true);
    assert.equal(dueLabel(wrongDueDay(attempts, "q1") ?? "", now), "已到期");
  });

  it("答對後間隔改為 3 天", () => {
    const attempts = [attempt("q1", false, twoDaysAgo), attempt("q1", true, yesterday)];
    assert.equal(isOpenWrong(attempts, "q1"), true);
    assert.equal(wrongDueDay(attempts, "q1"), shiftDay(dayKey(yesterday), 3));
    assert.equal(isDueWrong(attempts, "q1", now), false);
  });

  it("到期文案：當天、明天、N 天後", () => {
    const today = dayKey(now);
    assert.equal(dueLabel(today, now), "已到期");
    assert.equal(dueLabel(shiftDay(today, 1), now), "明天");
    assert.equal(dueLabel(shiftDay(today, 3), now), "3 天後");
  });

  it("連對三次才離開；兩次仍留在本裡", () => {
    const one = [attempt("q1", false, 1), attempt("q1", true, 2)];
    const two = [...one, attempt("q1", true, 3)];
    const three = [...two, attempt("q1", true, 4)];
    assert.equal(isOpenWrong(one, "q1"), true);
    assert.equal(isOpenWrong(two, "q1"), true);
    assert.equal(isOpenWrong(three, "q1"), false);
    assert.equal(isDueWrong(three, "q1", now), false);
  });

  it("離開後再錯會重置為明天到期", () => {
    const attempts = [
      attempt("q1", false, 1),
      attempt("q1", true, 2),
      attempt("q1", true, 3),
      attempt("q1", true, 4),
      attempt("q1", false, now),
    ];
    assert.equal(isOpenWrong(attempts, "q1"), true);
    assert.equal(consecutiveCorrect(attempts, "q1"), 0);
    assert.equal(isDueWrong(attempts, "q1", now), false);
  });

  it("中間夾雜其他題不打斷連對", () => {
    const attempts = [
      attempt("q1", false, 1),
      attempt("q2", false, 2),
      attempt("q1", true, 3),
      attempt("q2", true, 4),
      attempt("q1", true, 5),
      attempt("q1", true, 6),
    ];
    assert.equal(consecutiveCorrect(attempts, "q1"), 3);
    assert.equal(isOpenWrong(attempts, "q1"), false);
    assert.equal(isOpenWrong(attempts, "q2"), true);
  });
});
