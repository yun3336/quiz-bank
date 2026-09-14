import { createDefaultSwitch } from "./switch";
import { huaweiLabs, buildHuaweiState } from "./huaweiLabs";
import type { Lab, SwitchState } from "./types";

function iface(state: SwitchState, key: string) {
  return state.interfaces[key];
}

function withVlans(state: SwitchState, vlans: { id: number; name: string }[]): SwitchState {
  for (const vlan of vlans) state.vlans[vlan.id] = vlan;
  return state;
}

export const labs: Lab[] = [
  {
    id: "basic-setup",
    title: "LAB 1 · 交換器基礎設定",
    level: "入門",
    track: "Cisco",
    engine: "ios",
    scenario:
      "新交換器剛開箱。請進入特權與全域設定模式，把主機名稱改成 SW-ACCESS，設定 enable secret 為 class，並幫 Fa0/1 寫上描述 PC-1。",
    topology: "管理電腦 ── console ── Switch（Fa0/1 接員工電腦）",
    objectives: [
      "主機名稱為 SW-ACCESS",
      "設定 enable secret class",
      "Fa0/1 描述為 PC-1",
    ],
    hints: [
      "使用者模式先打 enable，再 conf t。",
      "hostname SW-ACCESS",
      "enable secret class",
      "int fa0/1 然後 description PC-1",
    ],
    checks: [
      { id: "hostname", label: "hostname 為 SW-ACCESS", pass: (s) => s.hostname === "SW-ACCESS" },
      { id: "secret", label: "enable secret 為 class", pass: (s) => s.enableSecret === "class" },
      {
        id: "desc",
        label: "Fa0/1 description 為 PC-1",
        pass: (s) => iface(s, "Fa0/1")?.description === "PC-1",
      },
    ],
  },
  {
    id: "vlan-access",
    title: "LAB 2 · VLAN 與 Access 埠",
    level: "入門",
    track: "Cisco",
    engine: "ios",
    scenario:
      "業務部與資訊部要隔離廣播域。建立 VLAN 10（SALES）、VLAN 20（IT），Fa0/1 劃進業務、Fa0/2 劃進資訊，兩埠都必須是 access 且不要 shutdown。",
    topology: "PC-SALES ── Fa0/1 Switch Fa0/2 ── PC-IT",
    objectives: [
      "VLAN 10 名稱 SALES",
      "VLAN 20 名稱 IT",
      "Fa0/1 access VLAN 10 且啟用",
      "Fa0/2 access VLAN 20 且啟用",
    ],
    hints: [
      "conf t → vlan 10 → name SALES → exit",
      "vlan 20 → name IT → exit",
      "int fa0/1 → switchport mode access → switchport access vlan 10 → no shutdown",
      "int fa0/2 同樣劃到 vlan 20",
    ],
    checks: [
      {
        id: "vlan10",
        label: "VLAN 10 名稱為 SALES",
        pass: (s) => s.vlans[10]?.name.toUpperCase() === "SALES",
      },
      {
        id: "vlan20",
        label: "VLAN 20 名稱為 IT",
        pass: (s) => s.vlans[20]?.name.toUpperCase() === "IT",
      },
      {
        id: "fa01",
        label: "Fa0/1 為 access VLAN 10（未關閉）",
        pass: (s) => {
          const port = iface(s, "Fa0/1");
          return !!port && port.mode === "access" && port.accessVlan === 10 && !port.adminDown;
        },
      },
      {
        id: "fa02",
        label: "Fa0/2 為 access VLAN 20（未關閉）",
        pass: (s) => {
          const port = iface(s, "Fa0/2");
          return !!port && port.mode === "access" && port.accessVlan === 20 && !port.adminDown;
        },
      },
    ],
  },
  {
    id: "trunk-uplink",
    title: "LAB 3 · Trunk 上聯埠",
    level: "進階",
    track: "Cisco",
    engine: "ios",
    scenario:
      "這台樓層交換器要用 Gi0/1 接到核心交換器，並讓 VLAN 10 與 20 通過。請把 Gi0/1 設成 trunk、允許 10 與 20、描述寫 UPLINK。VLAN 10/20 已預先建立。",
    topology: "SW-ACCESS Gi0/1 ════ trunk ════ 核心交換器",
    objectives: [
      "Gi0/1 為 trunk",
      "允許 VLAN 10,20",
      "描述為 UPLINK",
      "埠未關閉",
    ],
    hints: [
      "int gi0/1",
      "switchport mode trunk",
      "switchport trunk allowed vlan 10,20",
      "description UPLINK 與 no shutdown",
    ],
    initial: (state) => withVlans(state, [
      { id: 10, name: "SALES" },
      { id: 20, name: "IT" },
    ]),
    checks: [
      {
        id: "mode",
        label: "Gi0/1 為 trunk 且未關閉",
        pass: (s) => {
          const port = iface(s, "Gi0/1");
          return !!port && port.mode === "trunk" && !port.adminDown;
        },
      },
      {
        id: "allowed",
        label: "Trunk 允許 VLAN 10 與 20",
        pass: (s) => {
          const port = iface(s, "Gi0/1");
          if (!port || port.allowedVlans === "all") return false;
          return port.allowedVlans.includes(10) && port.allowedVlans.includes(20);
        },
      },
      {
        id: "desc",
        label: "Gi0/1 description 為 UPLINK",
        pass: (s) => iface(s, "Gi0/1")?.description === "UPLINK",
      },
    ],
  },
  {
    id: "mgmt-svi",
    title: "LAB 4 · 管理 IP（SVI）",
    level: "進階",
    track: "Cisco",
    engine: "ios",
    scenario:
      "遠端要能管理這台交換器。請設定主機名稱 SW1，在 Vlan1 設定 IP 192.168.10.2 /24，並 no shutdown。",
    topology: "管理電腦 192.168.10.10 ── 區網 ── Switch Vlan1 192.168.10.2",
    objectives: [
      "hostname 為 SW1",
      "Vlan1 IP 為 192.168.10.2 255.255.255.0",
      "Vlan1 介面啟用",
    ],
    hints: [
      "conf t → hostname SW1",
      "interface vlan 1",
      "ip address 192.168.10.2 255.255.255.0",
      "no shutdown",
    ],
    checks: [
      { id: "hostname", label: "hostname 為 SW1", pass: (s) => s.hostname === "SW1" },
      {
        id: "ip",
        label: "Vlan1 位址 192.168.10.2 255.255.255.0",
        pass: (s) => s.svis[1]?.ip === "192.168.10.2" && s.svis[1]?.mask === "255.255.255.0",
      },
      { id: "up", label: "Vlan1 已 no shutdown", pass: (s) => s.svis[1]?.adminDown === false },
    ],
  },
  {
    id: "unused-ports",
    title: "LAB 5 · 關閉未使用埠",
    level: "入門",
    track: "Cisco",
    engine: "ios",
    scenario:
      "安全規範要求把沒接線的埠關掉。請一次把 Fa0/5 到 Fa0/8 全部 shutdown。可用 interface range。",
    topology: "Fa0/1–4 有接設備；Fa0/5–8 空接",
    objectives: ["Fa0/5、Fa0/6、Fa0/7、Fa0/8 皆為 shutdown"],
    hints: [
      "conf t",
      "interface range fa0/5-8",
      "shutdown",
    ],
    checks: [
      {
        id: "down",
        label: "Fa0/5–8 皆 shutdown",
        pass: (s) => ["Fa0/5", "Fa0/6", "Fa0/7", "Fa0/8"].every((key) => iface(s, key)?.adminDown === true),
      },
    ],
  },
  {
    id: "port-security",
    title: "LAB 6 · Port Security",
    level: "進階",
    track: "Cisco",
    engine: "ios",
    scenario:
      "Fa0/1 只准接一台電腦，避免亂插交換器。請設成 access VLAN 10、開啟 port-security，並限制最多 1 個 MAC。VLAN 10 已建立。",
    topology: "唯一授權 PC ── Fa0/1 Switch",
    objectives: [
      "Fa0/1 為 access VLAN 10",
      "已啟用 port-security（最多 1 個 MAC）",
    ],
    hints: [
      "int fa0/1",
      "switchport mode access",
      "switchport access vlan 10",
      "switchport port-security",
      "switchport port-security maximum 1",
    ],
    initial: (state) => withVlans(state, [{ id: 10, name: "USERS" }]),
    checks: [
      {
        id: "access",
        label: "Fa0/1 access VLAN 10",
        pass: (s) => iface(s, "Fa0/1")?.mode === "access" && iface(s, "Fa0/1")?.accessVlan === 10,
      },
      {
        id: "ps",
        label: "已開啟 port-security（maximum 1）",
        pass: (s) => iface(s, "Fa0/1")?.portSecurity === true && iface(s, "Fa0/1")?.portSecurityMax === 1,
      },
    ],
  },
  {
    id: "native-vlan",
    title: "LAB 7 · Trunk Native VLAN",
    level: "進階",
    track: "Cisco",
    engine: "ios",
    scenario:
      "上聯 Gi0/1 已規劃跑 VLAN 10 與 20。請設成 trunk，允許 10、20、99 通過，並把 native VLAN 改成 99（管理 VLAN）。相關 VLAN 已建立。",
    topology: "接入層 ════ Gi0/1 trunk（native 99）════ 核心",
    objectives: ["Gi0/1 為 trunk", "允許 VLAN 10、20、99", "native VLAN 為 99"],
    hints: [
      "int gi0/1",
      "switchport mode trunk",
      "switchport trunk allowed vlan 10,20,99",
      "switchport trunk native vlan 99",
    ],
    initial: (state) =>
      withVlans(state, [
        { id: 10, name: "USERS" },
        { id: 20, name: "VOICE" },
        { id: 99, name: "MGMT" },
      ]),
    checks: [
      { id: "mode", label: "Gi0/1 為 trunk", pass: (s) => iface(s, "Gi0/1")?.mode === "trunk" },
      {
        id: "allowed",
        label: "允許 VLAN 10、20、99",
        pass: (s) => {
          const port = iface(s, "Gi0/1");
          if (!port) return false;
          const allowed = port.allowedVlans;
          if (allowed === "all") return false;
          return [10, 20, 99].every((id) => allowed.includes(id));
        },
      },
      { id: "native", label: "native VLAN 為 99", pass: (s) => iface(s, "Gi0/1")?.nativeVlan === 99 },
    ],
  },
  {
    id: "floor-switch",
    title: "LAB 8 · 樓層交換器綜合",
    level: "中等",
    track: "Cisco",
    engine: "ios",
    scenario:
      "二樓接入交換器：主機名稱 SW-FL2。建立 VLAN 10（SALES）、VLAN 20（IT）。Fa0/1 給業務、Fa0/2 給資訊（皆 access 且啟用）。Gi0/1 上聯 trunk，只放行 10 與 20。Vlan 10 管理位址 192.168.10.2/24 並 no shutdown。",
    topology: "PC-SALES ── Fa0/1 SW-FL2 Fa0/2 ── PC-IT；Gi0/1 ════ 核心",
    objectives: [
      "hostname 為 SW-FL2",
      "VLAN 10／20 名稱正確",
      "Fa0/1、Fa0/2 劃對 VLAN",
      "Gi0/1 trunk 放行 10、20",
      "SVI 10 位址已啟用",
    ],
    hints: [
      "hostname SW-FL2",
      "vlan 10 → name SALES；vlan 20 → name IT",
      "int fa0/1 → switchport mode access → switchport access vlan 10 → no shutdown",
      "int fa0/2 劃到 vlan 20",
      "int gi0/1 → switchport mode trunk → switchport trunk allowed vlan 10,20",
      "int vlan 10 → ip address 192.168.10.2 255.255.255.0 → no shutdown",
    ],
    checks: [
      { id: "hostname", label: "hostname 為 SW-FL2", pass: (s) => s.hostname === "SW-FL2" },
      {
        id: "vlans",
        label: "VLAN 10＝SALES、VLAN 20＝IT",
        pass: (s) => s.vlans[10]?.name.toUpperCase() === "SALES" && s.vlans[20]?.name.toUpperCase() === "IT",
      },
      {
        id: "access",
        label: "Fa0/1 VLAN 10、Fa0/2 VLAN 20（未關閉）",
        pass: (s) => {
          const a = iface(s, "Fa0/1");
          const b = iface(s, "Fa0/2");
          return (
            !!a &&
            !!b &&
            a.mode === "access" &&
            a.accessVlan === 10 &&
            !a.adminDown &&
            b.mode === "access" &&
            b.accessVlan === 20 &&
            !b.adminDown
          );
        },
      },
      {
        id: "trunk",
        label: "Gi0/1 trunk 允許 10 與 20",
        pass: (s) => {
          const port = iface(s, "Gi0/1");
          return (
            !!port &&
            port.mode === "trunk" &&
            port.allowedVlans !== "all" &&
            port.allowedVlans.includes(10) &&
            port.allowedVlans.includes(20)
          );
        },
      },
      {
        id: "svi",
        label: "Vlan10 為 192.168.10.2/24 且已啟用",
        pass: (s) =>
          s.svis[10]?.ip === "192.168.10.2" &&
          s.svis[10]?.mask === "255.255.255.0" &&
          s.svis[10]?.adminDown === false,
      },
    ],
  },
];

export const allLabs: Lab[] = [...labs, ...huaweiLabs];

export function getLab(id: string): Lab | undefined {
  return allLabs.find((lab) => lab.id === id);
}

export function buildLabState(lab: Lab): SwitchState {
  if (lab.engine === "vrp") return buildHuaweiState(lab);
  const state = createDefaultSwitch();
  return lab.initial ? lab.initial(state) : state;
}
