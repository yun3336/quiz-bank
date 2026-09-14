import { createDefaultHuawei } from "./switch";
import type { Lab, SwitchState } from "./types";

function ge(state: SwitchState, port: number) {
  return state.interfaces[`GE0/0/${port}`];
}

function withVlans(state: SwitchState, ids: number[]): SwitchState {
  for (const id of ids) {
    if (!state.vlans[id]) state.vlans[id] = { id, name: `vlan${id}` };
  }
  return state;
}

export const huaweiLabs: Lab[] = [
  {
    id: "hcia-basic",
    title: "HCIA LAB · VRP 基礎與 Access VLAN",
    level: "HCIA",
    track: "HCIA",
    engine: "vrp",
    scenario:
      "新華為交換器剛上電。請進入 system-view，主機名稱改成 SW1，用 vlan batch 一次建立 VLAN 10 與 20，把 GE0/0/1 設成 access 並劃入 VLAN 10，描述寫 PC1。",
    topology: "PC1 ── GE0/0/1 SW1",
    objectives: ["sysname 為 SW1", "已建立 VLAN 10 與 20", "GE0/0/1 為 access VLAN 10", "描述為 PC1"],
    hints: [
      "system-view",
      "sysname SW1",
      "vlan batch 10 20",
      "interface GE0/0/1",
      "port link-type access",
      "port default vlan 10",
      "description PC1",
    ],
    checks: [
      { id: "name", label: "sysname 為 SW1", pass: (s) => s.hostname === "SW1" },
      { id: "vlans", label: "存在 VLAN 10 與 20", pass: (s) => !!s.vlans[10] && !!s.vlans[20] },
      {
        id: "access",
        label: "GE0/0/1 access VLAN 10",
        pass: (s) => ge(s, 1)?.mode === "access" && ge(s, 1)?.accessVlan === 10,
      },
      { id: "desc", label: "GE0/0/1 描述為 PC1", pass: (s) => ge(s, 1)?.description === "PC1" },
    ],
  },
  {
    id: "hcia-trunk",
    title: "HCIA LAB · Trunk 上聯",
    level: "HCIA",
    track: "HCIA",
    engine: "vrp",
    scenario:
      "樓層交換器要以 GE0/0/24 上聯核心。請設成 trunk，允許 VLAN 10 與 20 通過，描述 UPLINK。VLAN 已預先建立。",
    topology: "SW1 GE0/0/24 ════ trunk ════ 核心",
    objectives: ["GE0/0/24 為 trunk", "允許 VLAN 10 與 20", "描述為 UPLINK"],
    hints: [
      "interface GigabitEthernet0/0/24",
      "port link-type trunk",
      "port trunk allow-pass vlan 10 20",
      "description UPLINK",
    ],
    initial: (state) => withVlans(state, [10, 20]),
    checks: [
      { id: "trunk", label: "GE0/0/24 為 trunk", pass: (s) => ge(s, 24)?.mode === "trunk" },
      {
        id: "allow",
        label: "允許 VLAN 10 與 20",
        pass: (s) => {
          const port = ge(s, 24);
          return !!port && port.allowedVlans !== "all" && port.allowedVlans.includes(10) && port.allowedVlans.includes(20);
        },
      },
      { id: "desc", label: "描述為 UPLINK", pass: (s) => ge(s, 24)?.description === "UPLINK" },
    ],
  },
  {
    id: "hcia-vlanif",
    title: "HCIA LAB · Vlanif 管理／三層介面",
    level: "HCIA",
    track: "HCIA",
    engine: "vrp",
    scenario:
      "三層交換器要給 VLAN 10 網段當閘道。請建立 VLAN 10，設定 Vlanif10 位址 192.168.10.1/24，並 undo shutdown。主機名稱 GW1。",
    topology: "VLAN10 終端 ── SW ── Vlanif10 192.168.10.1",
    objectives: ["sysname 為 GW1", "Vlanif10 為 192.168.10.1/24", "Vlanif10 已啟用"],
    hints: [
      "sysname GW1",
      "vlan batch 10",
      "interface Vlanif10",
      "ip address 192.168.10.1 24",
      "undo shutdown",
    ],
    checks: [
      { id: "name", label: "sysname 為 GW1", pass: (s) => s.hostname === "GW1" },
      {
        id: "ip",
        label: "Vlanif10 = 192.168.10.1 255.255.255.0",
        pass: (s) => s.svis[10]?.ip === "192.168.10.1" && s.svis[10]?.mask === "255.255.255.0",
      },
      { id: "up", label: "Vlanif10 undo shutdown", pass: (s) => s.svis[10]?.adminDown === false },
    ],
  },
  {
    id: "hcia-static",
    title: "HCIA LAB · 靜態路由",
    level: "HCIA",
    track: "HCIA",
    engine: "vrp",
    scenario:
      "本機已能服務 192.168.10.0/24。請加上靜態路由：到達 192.168.20.0/24，下一跳 10.1.12.2。",
    topology: "192.168.10.0/24 ── R1 ── 10.1.12.2 ── 192.168.20.0/24",
    objectives: ["靜態路由 192.168.20.0/24 下一跳 10.1.12.2"],
    hints: ["system-view", "ip route-static 192.168.20.0 255.255.255.0 10.1.12.2"],
    checks: [
      {
        id: "route",
        label: "靜態路由 192.168.20.0/24 via 10.1.12.2",
        pass: (s) =>
          s.staticRoutes.some(
            (route) =>
              route.dest === "192.168.20.0" &&
              route.mask === "255.255.255.0" &&
              route.nextHop === "10.1.12.2",
          ),
      },
    ],
  },
  {
    id: "hcip-eth-trunk",
    title: "HCIP LAB · Eth-Trunk",
    level: "HCIP",
    track: "HCIP",
    engine: "vrp",
    scenario:
      "兩條上聯要綁成 Eth-Trunk 1：GE0/0/1 與 GE0/0/2 加入聚合，Eth-Trunk1 設 trunk 並允許 VLAN 10、20。",
    topology: "SW GE0/0/1+GE0/0/2 ══ Eth-Trunk1 ══ 核心",
    objectives: ["兩成員加入 Eth-Trunk 1", "Eth-Trunk1 為 trunk", "允許 VLAN 10 與 20"],
    hints: [
      "interface GE0/0/1 → eth-trunk 1",
      "interface GE0/0/2 → eth-trunk 1",
      "interface Eth-Trunk1",
      "port link-type trunk",
      "port trunk allow-pass vlan 10 20",
    ],
    initial: (state) => withVlans(state, [10, 20]),
    checks: [
      {
        id: "members",
        label: "GE0/0/1 與 GE0/0/2 屬於 Eth-Trunk 1",
        pass: (s) => ge(s, 1)?.ethTrunkId === 1 && ge(s, 2)?.ethTrunkId === 1,
      },
      {
        id: "trunk",
        label: "Eth-Trunk1 為 trunk 且允許 10、20",
        pass: (s) => {
          const port = s.interfaces["Eth-Trunk1"];
          return (
            !!port &&
            port.mode === "trunk" &&
            port.allowedVlans !== "all" &&
            port.allowedVlans.includes(10) &&
            port.allowedVlans.includes(20)
          );
        },
      },
    ],
  },
  {
    id: "hcip-ospf",
    title: "HCIP LAB · OSPF 單區域",
    level: "HCIP",
    track: "HCIP",
    engine: "vrp",
    scenario:
      "請啟用 OSPF 進程 1，router-id 1.1.1.1，在 area 0 宣告 192.168.10.0/24（反掩碼 0.0.0.255）。Vlanif10 設 192.168.10.1/24 並啟用。",
    topology: "Vlanif10 192.168.10.1 ── OSPF area 0",
    objectives: ["OSPF router-id 1.1.1.1", "area 0 宣告 192.168.10.0/24", "Vlanif10 已配置並啟用"],
    hints: [
      "interface Vlanif10 → ip address 192.168.10.1 24 → undo shutdown",
      "ospf 1 router-id 1.1.1.1",
      "area 0",
      "network 192.168.10.0 0.0.0.255",
    ],
    checks: [
      { id: "rid", label: "OSPF router-id 1.1.1.1", pass: (s) => s.ospf?.routerId === "1.1.1.1" },
      {
        id: "net",
        label: "area 0 含 192.168.10.0 0.0.0.255",
        pass: (s) =>
          !!s.ospf?.areas["0.0.0.0"]?.networks.some((net) => net.ip === "192.168.10.0" && net.wildcard === "0.0.0.255"),
      },
      {
        id: "svi",
        label: "Vlanif10 192.168.10.1/24 已啟用",
        pass: (s) => s.svis[10]?.ip === "192.168.10.1" && s.svis[10]?.adminDown === false,
      },
    ],
  },
  {
    id: "hcip-vrrp-acl",
    title: "HCIP LAB · VRRP 與基本 ACL",
    level: "HCIP",
    track: "HCIP",
    engine: "vrp",
    scenario:
      "雙閘道場景：Vlanif10 位址 192.168.10.2/24 並啟用，VRRP VRID 1 虛擬 IP 192.168.10.254。另建 ACL 2000，拒絕來源 192.168.20.0/24。",
    topology: "主機預設閘道 192.168.10.254（VRRP）── 本機 192.168.10.2",
    objectives: ["Vlanif10 位址與 VRRP VIP", "ACL 2000 deny 192.168.20.0/24"],
    hints: [
      "interface Vlanif10",
      "ip address 192.168.10.2 24",
      "undo shutdown",
      "vrrp vrid 1 virtual-ip 192.168.10.254",
      "acl 2000",
      "rule deny source 192.168.20.0 0.0.0.255",
    ],
    checks: [
      {
        id: "vrrp",
        label: "Vlanif10 已設 192.168.10.2 且 VRRP VIP 192.168.10.254",
        pass: (s) =>
          s.svis[10]?.ip === "192.168.10.2" &&
          s.svis[10]?.vrrp.some((group) => group.vrid === 1 && group.vip === "192.168.10.254"),
      },
      {
        id: "acl",
        label: "ACL 2000 deny 192.168.20.0/24",
        pass: (s) =>
          !!s.acls[2000]?.some(
            (rule) => rule.action === "deny" && rule.source === "192.168.20.0" && rule.wildcard === "0.0.0.255",
          ),
      },
    ],
  },
  {
    id: "hcie-ospf-multi",
    title: "HCIE LAB · OSPF 多區域",
    level: "HCIE",
    track: "HCIE",
    engine: "vrp",
    scenario:
      "ABR 設計：OSPF 1、router-id 2.2.2.2。area 0 宣告 10.0.12.0/24，area 1 宣告 192.168.10.0/24。",
    topology: "area 1 192.168.10.0/24 ── ABR ── area 0 10.0.12.0/24",
    objectives: ["router-id 2.2.2.2", "area 0 與 area 1 網路宣告正確"],
    hints: [
      "ospf 1 router-id 2.2.2.2",
      "area 0 → network 10.0.12.0 0.0.0.255",
      "quit",
      "area 1 → network 192.168.10.0 0.0.0.255",
    ],
    checks: [
      { id: "rid", label: "router-id 2.2.2.2", pass: (s) => s.ospf?.routerId === "2.2.2.2" },
      {
        id: "a0",
        label: "area 0 宣告 10.0.12.0/24",
        pass: (s) =>
          !!s.ospf?.areas["0.0.0.0"]?.networks.some((net) => net.ip === "10.0.12.0" && net.wildcard === "0.0.0.255"),
      },
      {
        id: "a1",
        label: "area 1 宣告 192.168.10.0/24",
        pass: (s) =>
          !!s.ospf?.areas["0.0.0.1"]?.networks.some((net) => net.ip === "192.168.10.0" && net.wildcard === "0.0.0.255"),
      },
    ],
  },
  {
    id: "hcie-bgp",
    title: "HCIE LAB · BGP 對等體",
    level: "HCIE",
    track: "HCIE",
    engine: "vrp",
    scenario:
      "本端 AS 65001，router-id 1.1.1.1，與 10.0.12.2（AS 65002）建立 eBGP。宣告 192.168.10.0/24。",
    topology: "AS65001 1.1.1.1 ── eBGP ── 10.0.12.2 AS65002",
    objectives: ["BGP AS 65001 與 router-id", "peer 10.0.12.2 AS 65002", "network 192.168.10.0/24"],
    hints: [
      "bgp 65001",
      "router-id 1.1.1.1",
      "peer 10.0.12.2 as-number 65002",
      "network 192.168.10.0 255.255.255.0",
    ],
    checks: [
      {
        id: "as",
        label: "BGP AS 65001、router-id 1.1.1.1",
        pass: (s) => s.bgp?.localAs === 65001 && s.bgp?.routerId === "1.1.1.1",
      },
      {
        id: "peer",
        label: "peer 10.0.12.2 remote-AS 65002",
        pass: (s) => !!s.bgp?.peers.some((peer) => peer.ip === "10.0.12.2" && peer.remoteAs === 65002),
      },
      {
        id: "net",
        label: "宣告 192.168.10.0/24",
        pass: (s) =>
          !!s.bgp?.networks.some((net) => net.ip === "192.168.10.0" && net.mask === "255.255.255.0"),
      },
    ],
  },
  {
    id: "hcie-campus",
    title: "HCIE LAB · 園區核心綜合",
    level: "HCIE",
    track: "HCIE",
    engine: "vrp",
    scenario:
      "核心交換器 CORE：建立 VLAN 10/20；GE0/0/24 做 trunk 放行 10 與 20；Vlanif10 = 10.10.10.1/24 並啟用；OSPF 1 router-id 10.10.10.1，area 0 宣告 10.10.10.0/24。",
    topology: "接入層 ════ trunk GE0/0/24 ── CORE Vlanif10 10.10.10.1 ── OSPF",
    objectives: ["sysname CORE", "trunk 放行 10/20", "Vlanif10 與 OSPF area 0"],
    hints: [
      "sysname CORE",
      "vlan batch 10 20",
      "interface GE0/0/24 → port link-type trunk → port trunk allow-pass vlan 10 20",
      "interface Vlanif10 → ip address 10.10.10.1 24 → undo shutdown",
      "ospf 1 router-id 10.10.10.1 → area 0 → network 10.10.10.0 0.0.0.255",
    ],
    checks: [
      { id: "name", label: "sysname CORE", pass: (s) => s.hostname === "CORE" },
      {
        id: "trunk",
        label: "GE0/0/24 trunk 允許 10 與 20",
        pass: (s) => {
          const port = ge(s, 24);
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
        label: "Vlanif10 10.10.10.1/24 已啟用",
        pass: (s) => s.svis[10]?.ip === "10.10.10.1" && s.svis[10]?.adminDown === false,
      },
      {
        id: "ospf",
        label: "OSPF RID 10.10.10.1 且 area 0 宣告 10.10.10.0/24",
        pass: (s) =>
          s.ospf?.routerId === "10.10.10.1" &&
          !!s.ospf.areas["0.0.0.0"]?.networks.some((net) => net.ip === "10.10.10.0" && net.wildcard === "0.0.0.255"),
      },
    ],
  },
  {
    id: "hcia-shutdown",
    title: "HCIA LAB · 關閉未使用埠",
    level: "HCIA",
    track: "HCIA",
    engine: "vrp",
    scenario:
      "邊緣交換器 SW-EDGE：把沒接線的 GE0/0/5、GE0/0/6 關掉，避免被人亂插。本模擬器請逐一進入介面後 shutdown。",
    topology: "GE0/0/1–4 有接設備；GE0/0/5–6 空接",
    objectives: ["sysname 為 SW-EDGE", "GE0/0/5 與 GE0/0/6 皆 shutdown"],
    hints: [
      "system-view",
      "sysname SW-EDGE",
      "interface GE0/0/5 → shutdown",
      "quit",
      "interface GE0/0/6 → shutdown",
    ],
    checks: [
      { id: "name", label: "sysname 為 SW-EDGE", pass: (s) => s.hostname === "SW-EDGE" },
      {
        id: "down",
        label: "GE0/0/5 與 GE0/0/6 皆 shutdown",
        pass: (s) => ge(s, 5)?.adminDown === true && ge(s, 6)?.adminDown === true,
      },
    ],
  },
  {
    id: "hcip-default-route",
    title: "HCIP LAB · 預設路由",
    level: "HCIP",
    track: "HCIP",
    engine: "vrp",
    scenario:
      "出口路由器要把未知網段丟給上游 10.1.12.2。請設定預設路由 0.0.0.0/0，並另加一條到達 172.16.0.0/16、下一跳同樣是 10.1.12.2。",
    topology: "內網 ── R1 ── 10.1.12.2（上游）── 網際網路",
    objectives: ["預設路由 via 10.1.12.2", "172.16.0.0/16 via 10.1.12.2"],
    hints: [
      "system-view",
      "ip route-static 0.0.0.0 0.0.0.0 10.1.12.2",
      "ip route-static 172.16.0.0 255.255.0.0 10.1.12.2",
    ],
    checks: [
      {
        id: "default",
        label: "預設路由 0.0.0.0/0 via 10.1.12.2",
        pass: (s) =>
          s.staticRoutes.some(
            (route) => route.dest === "0.0.0.0" && route.mask === "0.0.0.0" && route.nextHop === "10.1.12.2",
          ),
      },
      {
        id: "specific",
        label: "172.16.0.0/16 via 10.1.12.2",
        pass: (s) =>
          s.staticRoutes.some(
            (route) => route.dest === "172.16.0.0" && route.mask === "255.255.0.0" && route.nextHop === "10.1.12.2",
          ),
      },
    ],
  },
  {
    id: "hcie-ibgp",
    title: "HCIE LAB · eBGP 與 iBGP",
    level: "HCIE",
    track: "HCIE",
    engine: "vrp",
    scenario:
      "本端 AS 65001、router-id 1.1.1.1。與 10.0.12.2（AS 65002）建 eBGP，與 10.0.13.3（同 AS 65001）建 iBGP。宣告 192.168.10.0/24。",
    topology: "10.0.13.3 iBGP ── AS65001 1.1.1.1 ── eBGP ── 10.0.12.2 AS65002",
    objectives: ["BGP AS 與 router-id", "eBGP 與 iBGP 對等體", "宣告 192.168.10.0/24"],
    hints: [
      "bgp 65001",
      "router-id 1.1.1.1",
      "peer 10.0.12.2 as-number 65002",
      "peer 10.0.13.3 as-number 65001",
      "network 192.168.10.0 255.255.255.0",
    ],
    checks: [
      {
        id: "as",
        label: "BGP AS 65001、router-id 1.1.1.1",
        pass: (s) => s.bgp?.localAs === 65001 && s.bgp?.routerId === "1.1.1.1",
      },
      {
        id: "ebgp",
        label: "eBGP peer 10.0.12.2 AS 65002",
        pass: (s) => !!s.bgp?.peers.some((peer) => peer.ip === "10.0.12.2" && peer.remoteAs === 65002),
      },
      {
        id: "ibgp",
        label: "iBGP peer 10.0.13.3 AS 65001",
        pass: (s) => !!s.bgp?.peers.some((peer) => peer.ip === "10.0.13.3" && peer.remoteAs === 65001),
      },
      {
        id: "net",
        label: "宣告 192.168.10.0/24",
        pass: (s) =>
          !!s.bgp?.networks.some((net) => net.ip === "192.168.10.0" && net.mask === "255.255.255.0"),
      },
    ],
  },
];

export function getHuaweiLab(id: string): Lab | undefined {
  return huaweiLabs.find((lab) => lab.id === id);
}

export function buildHuaweiState(lab: Lab): SwitchState {
  const state = createDefaultHuawei();
  return lab.initial ? lab.initial(state) : state;
}
