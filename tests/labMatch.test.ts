import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  labEngineForVendor,
  pickLabForQuestion,
  suggestLabsForQuestions,
} from "../lib/labMatch";
import { makeQuestion } from "./util";

describe("labEngineForVendor", () => {
  it("只有 Cisco／華為有實驗引擎", () => {
    assert.equal(labEngineForVendor("cisco"), "ios");
    assert.equal(labEngineForVendor("huawei"), "vrp");
    assert.equal(labEngineForVendor("math"), null);
    assert.equal(labEngineForVendor("language"), null);
  });
});

describe("pickLabForQuestion", () => {
  it("對不到就不推 LAB（理論題）", () => {
    const question = makeQuestion({
      type: "single",
      chapter: "計算機網路",
      tags: ["HTTP", "狀態碼"],
      stem: "HTTP 狀態碼 404 代表什麼？",
      explanation: "找不到資源。",
    });
    assert.equal(pickLabForQuestion(question, "ios"), null);
  });

  it("Native VLAN 題對到 LAB 7，而不是普通 Trunk", () => {
    const question = makeQuestion({
      type: "single",
      chapter: "計算機網路",
      tags: ["Trunk", "VLAN"],
      stem: "802.1Q trunk 上沒有打標籤的訊框，會被歸到哪一個 VLAN？",
      explanation: "未打 802.1Q 標籤的訊框走 native VLAN。設定請走 LAB 7。",
    });
    assert.equal(pickLabForQuestion(question, "ios")?.id, "native-vlan");
  });

  it("SVI 題對到管理 IP，而不是 Access VLAN", () => {
    const question = makeQuestion({
      type: "short",
      chapter: "計算機網路",
      tags: ["SVI"],
      stem: "要給 VLAN 10 設定三層位址，常用的介面名稱是？",
      explanation: "交換器的 VLAN 介面（SVI）寫成 interface vlan 10。",
    });
    assert.equal(pickLabForQuestion(question, "ios")?.id, "mgmt-svi");
  });

  it("解析寫 LAB 8 時對到樓層綜合", () => {
    const question = makeQuestion({
      type: "order",
      chapter: "計算機網路",
      tags: ["VLAN"],
      stem: "樓層交換器：先改名，再建 VLAN。",
      explanation: "請到 LAB 8 實作。",
    });
    assert.equal(pickLabForQuestion(question, "ios")?.id, "floor-switch");
  });

  it("華為 VRP 視圖對到基礎 LAB，不會誤推 Cisco", () => {
    const question = makeQuestion({
      type: "single",
      chapter: "HCIA 數通",
      tags: ["VRP", "視圖"],
      stem: "由使用者視圖進入系統視圖的指令是？",
      explanation: "輸入 system-view。enable / conf t 是 Cisco IOS。",
    });
    assert.equal(pickLabForQuestion(question, "vrp")?.id, "hcia-basic");
    assert.equal(pickLabForQuestion(question, "ios"), null);
  });

  it("Eth-Trunk 優先於普通 Trunk", () => {
    const question = makeQuestion({
      type: "single",
      chapter: "HCIP 數通",
      tags: ["Eth-Trunk"],
      stem: "Eth-Trunk 使用 LACP 時，主要好處是？",
      explanation: "鏈路聚合。",
    });
    assert.equal(pickLabForQuestion(question, "vrp")?.id, "hcip-eth-trunk");
  });

  it("iBGP 優先於普通 BGP", () => {
    const question = makeQuestion({
      type: "single",
      chapter: "HCIE 數通",
      tags: ["BGP"],
      stem: "同 AS 內的 iBGP 對等體如何建立？",
      explanation: "iBGP 與 eBGP 的 AS 號不同。",
    });
    assert.equal(pickLabForQuestion(question, "vrp")?.id, "hcie-ibgp");
  });

  it("空接 shutdown 對到關閉未使用埠", () => {
    const question = makeQuestion({
      type: "boolean",
      chapter: "HCIA 數通",
      tags: ["安全"],
      stem: "把長時間空接的交換器埠 shutdown，有助於降低被人亂插設備的風險。",
      explanation: "請到「關閉未使用埠」LAB 實際下指令。",
    });
    assert.equal(pickLabForQuestion(question, "vrp")?.id, "hcia-shutdown");
  });
});

describe("suggestLabsForQuestions", () => {
  it("多題聚合，未完成的 LAB 排前面", () => {
    const vlan = makeQuestion({
      type: "single",
      id: "a",
      tags: ["VLAN"],
      stem: "Access 埠劃入 VLAN",
      explanation: "switchport access vlan 10",
    });
    const trunk = makeQuestion({
      type: "single",
      id: "b",
      tags: ["Trunk"],
      stem: "上聯設成 trunk",
      explanation: "allowed vlan 10,20",
    });
    const trunk2 = makeQuestion({
      type: "single",
      id: "c",
      tags: ["Trunk"],
      stem: "802.1Q trunk 上聯",
      explanation: "switchport mode trunk",
    });
    const hits = suggestLabsForQuestions([vlan, trunk, trunk2], "ios", 3, new Set(["trunk-uplink"]));
    assert.equal(hits[0]?.id, "vlan-access");
    assert.ok(hits.some((item) => item.id === "trunk-uplink" && item.hits === 2));
  });
});
