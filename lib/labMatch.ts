import type { Question } from "./types";

export type LabEngine = "ios" | "vrp";

export interface LabTopic {
  id: string;
  engine: LabEngine;
  title: string;
  keys: string[];
}

export interface LabHit {
  id: string;
  title: string;
  engine: LabEngine;
  score: number;
  hits: number;
}

/** Cisco LAB 1–8，對應解析裡寫的「LAB 7」「請到 LAB 8」。 */
const IOS_BY_NUM = [
  "basic-setup",
  "vlan-access",
  "trunk-uplink",
  "mgmt-svi",
  "unused-ports",
  "port-security",
  "native-vlan",
  "floor-switch",
] as const;

/**
 * 題目標籤／題幹／解析 → 實操 LAB。
 * 鍵愈長愈具體；對不到就不要硬推（OSI、HTTP 等理論題會是 0 分）。
 */
export const LAB_TOPICS: LabTopic[] = [
  {
    id: "basic-setup",
    engine: "ios",
    title: "LAB 1 · 交換器基礎設定",
    keys: ["hostname", "enable secret", "conf t", "configure terminal", "特權", "description"],
  },
  {
    id: "vlan-access",
    engine: "ios",
    title: "LAB 2 · VLAN 與 Access 埠",
    keys: ["access vlan", "access 埠", "switchport access", "劃進", "劃入 vlan"],
  },
  {
    id: "trunk-uplink",
    engine: "ios",
    title: "LAB 3 · Trunk 上聯埠",
    keys: ["trunk", "802.1q", "allowed vlan", "上聯"],
  },
  {
    id: "mgmt-svi",
    engine: "ios",
    title: "LAB 4 · 管理 IP（SVI）",
    keys: ["svi", "interface vlan", "管理位址", "管理 ip", "vlan1"],
  },
  {
    id: "unused-ports",
    engine: "ios",
    title: "LAB 5 · 關閉未使用埠",
    keys: ["interface range", "空接", "未使用埠", "關閉未使用"],
  },
  {
    id: "port-security",
    engine: "ios",
    title: "LAB 6 · Port Security",
    keys: ["port-security", "port security", "埠安全"],
  },
  {
    id: "native-vlan",
    engine: "ios",
    title: "LAB 7 · Trunk Native VLAN",
    keys: ["native vlan", "native", "未標籤"],
  },
  {
    id: "floor-switch",
    engine: "ios",
    title: "LAB 8 · 樓層交換器綜合",
    keys: ["樓層交換器", "sw-fl2", "樓層"],
  },
  {
    id: "hcia-basic",
    engine: "vrp",
    title: "HCIA LAB · VRP 基礎與 Access VLAN",
    keys: ["system-view", "sysname", "vlan batch", "port default vlan", "視圖", "access"],
  },
  {
    id: "hcia-trunk",
    engine: "vrp",
    title: "HCIA LAB · Trunk 上聯",
    keys: ["trunk", "allow-pass", "上聯"],
  },
  {
    id: "hcia-vlanif",
    engine: "vrp",
    title: "HCIA LAB · Vlanif 管理／三層介面",
    keys: ["vlanif", "三層"],
  },
  {
    id: "hcia-static",
    engine: "vrp",
    title: "HCIA LAB · 靜態路由",
    keys: ["靜態路由", "route-static"],
  },
  {
    id: "hcia-shutdown",
    engine: "vrp",
    title: "HCIA LAB · 關閉未使用埠",
    keys: ["空接", "未使用埠", "關閉未使用", "亂插"],
  },
  {
    id: "hcip-eth-trunk",
    engine: "vrp",
    title: "HCIP LAB · Eth-Trunk",
    keys: ["eth-trunk", "lacp", "鏈路聚合"],
  },
  {
    id: "hcip-ospf",
    engine: "vrp",
    title: "HCIP LAB · OSPF 單區域",
    keys: ["ospf"],
  },
  {
    id: "hcip-vrrp-acl",
    engine: "vrp",
    title: "HCIP LAB · VRRP 與基本 ACL",
    keys: ["vrrp", "acl"],
  },
  {
    id: "hcip-default-route",
    engine: "vrp",
    title: "HCIP LAB · 預設路由",
    keys: ["預設路由", "default route", "0.0.0.0"],
  },
  {
    id: "hcie-ospf-multi",
    engine: "vrp",
    title: "HCIE LAB · OSPF 多區域",
    keys: ["多區域", "ospf 多", "area 1"],
  },
  {
    id: "hcie-bgp",
    engine: "vrp",
    title: "HCIE LAB · BGP 對等體",
    keys: ["bgp"],
  },
  {
    id: "hcie-ibgp",
    engine: "vrp",
    title: "HCIE LAB · eBGP 與 iBGP",
    keys: ["ibgp"],
  },
  {
    id: "hcie-campus",
    engine: "vrp",
    title: "HCIE LAB · 園區核心綜合",
    keys: ["園區", "vxlan", "evpn"],
  },
];

export function labEngineForVendor(vendor: string): LabEngine | null {
  if (vendor === "cisco") return "ios";
  if (vendor === "huawei") return "vrp";
  return null;
}

export function labHref(labId: string, vendor: string): string {
  return `/lab/${labId}?vendor=${encodeURIComponent(vendor)}`;
}

function haystack(question: Question): string {
  return [question.chapter, question.stem, question.explanation, ...(question.tags ?? []), ...(question.aliases ?? [])]
    .join("\n")
    .toLowerCase();
}

function isHuaweiChapter(chapter: string): boolean {
  return /hcia|hcip|hcie|華為/i.test(chapter);
}

function topicFitsQuestion(topic: LabTopic, question: Question): boolean {
  const huawei = isHuaweiChapter(question.chapter);
  return topic.engine === "vrp" ? huawei : !huawei;
}

function includesPhrase(text: string, phrase: string): boolean {
  const needle = phrase.toLowerCase().trim();
  if (!needle) return false;
  const hasLatin = /[a-z0-9]/.test(needle);
  const hasOther = /[^\x00-\x7f]/.test(needle);
  if (hasLatin) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9-])${escaped}`).test(text);
  }
  if (hasOther) return text.includes(needle);
  return includesKey(text, needle);
}

function includesKey(text: string, key: string): boolean {
  const needle = key.toLowerCase().trim();
  if (!needle) return false;
  if (/[^\x00-\x7f]/.test(needle)) return text.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9-])${escaped}(?=[^a-z0-9-]|$)`).test(text);
}

function shortTitle(title: string): string {
  const cut = title.split("·").pop() ?? title;
  return cut.trim().toLowerCase();
}

function scoreTopic(topic: LabTopic, text: string): number {
  let score = 0;
  for (const key of topic.keys) {
    if (includesKey(text, key)) score += key.length;
  }
  const brief = shortTitle(topic.title);
  if (brief.length >= 4 && includesPhrase(text, brief)) score += 40;
  if (topic.engine === "ios") {
    const numbered = text.match(/\blab\s*([1-8])\b/);
    if (numbered && IOS_BY_NUM[Number(numbered[1]) - 1] === topic.id) score += 50;
  }
  return score;
}

export function pickLabForQuestion(question: Question, engine: LabEngine): LabHit | null {
  const text = haystack(question);
  let best: LabHit | null = null;
  for (const topic of LAB_TOPICS) {
    if (topic.engine !== engine || !topicFitsQuestion(topic, question)) continue;
    const score = scoreTopic(topic, text);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { id: topic.id, title: topic.title, engine, score, hits: 1 };
    }
  }
  return best;
}

export function suggestLabsForQuestions(
  questions: Question[],
  engine: LabEngine,
  limit = 3,
  completedIds?: ReadonlySet<string>,
): LabHit[] {
  const map = new Map<string, LabHit>();
  for (const question of questions) {
    const hit = pickLabForQuestion(question, engine);
    if (!hit) continue;
    const prev = map.get(hit.id);
    if (prev) {
      prev.hits += 1;
      prev.score += hit.score;
    } else {
      map.set(hit.id, { ...hit });
    }
  }
  return [...map.values()]
    .sort((a, b) => {
      if (completedIds) {
        const aDone = completedIds.has(a.id) ? 1 : 0;
        const bDone = completedIds.has(b.id) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
      }
      return b.hits - a.hits || b.score - a.score;
    })
    .slice(0, limit);
}
