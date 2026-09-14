import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextRemindAt, parseRemindPref } from "../lib/remind";

describe("parseRemindPref / nextRemindAt", () => {
  it("預設關閉，小時只接受白名單", () => {
    assert.deepEqual(parseRemindPref(null), { enabled: false, hour: 20 });
    assert.equal(parseRemindPref({ enabled: true, hour: 18 }).hour, 18);
    assert.equal(parseRemindPref({ enabled: true, hour: 3 }).hour, 20);
  });

  it("今天這點已過就排明天", () => {
    const now = new Date(2026, 7, 21, 21, 0, 0).getTime();
    const next = nextRemindAt(20, now);
    const date = new Date(next);
    assert.equal(date.getDate(), 22);
    assert.equal(date.getHours(), 20);
  });

  it("還沒到點就排今天", () => {
    const now = new Date(2026, 7, 21, 19, 0, 0).getTime();
    const next = nextRemindAt(20, now);
    assert.equal(new Date(next).getDate(), 21);
  });
});
