import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHeatmap, heatLevel } from "../lib/heatmap";
import { dayKey } from "../lib/wrongBook";

describe("buildHeatmap / heatLevel", () => {
  it("從本週日開始往回 weeks 欄，今天之後標 future", () => {
    const friday = new Date(2026, 7, 21, 12).getTime();
    const cells = buildHeatmap([{ at: friday }, { at: friday }, { at: friday }], friday, 2);
    assert.equal(cells.length, 14);
    assert.equal(cells[0]?.weekday, 0);
    assert.equal(cells[0]?.key, "2026-08-09");
    const today = cells.find((item) => item.key === dayKey(friday));
    assert.equal(today?.count, 3);
    assert.equal(today?.future, false);
    assert.ok(cells.some((item) => item.future));
  });

  it("熱力分級", () => {
    assert.equal(heatLevel(0), 0);
    assert.equal(heatLevel(2), 1);
    assert.equal(heatLevel(5), 2);
    assert.equal(heatLevel(9), 3);
    assert.equal(heatLevel(10), 4);
  });
});
