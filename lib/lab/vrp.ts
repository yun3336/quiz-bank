import { cloneState } from "./switch";
import type { CliSession, SwitchInterface, SwitchState } from "./types";

const ERR = "Error: Unrecognized command found at '^' position.";
const INC = "Error: Incomplete command found at '^' position.";

function match(token: string, word: string, min = 1): boolean {
  const t = token.toLowerCase();
  const w = word.toLowerCase();
  return t.length >= min && w.startsWith(t);
}

function tokensOf(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

function prefixToMask(prefix: number): string | null {
  if (prefix < 0 || prefix > 32) return null;
  const bits = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return [24, 16, 8, 0].map((shift) => ((bits >>> shift) & 255).toString()).join(".");
}

function parseMaskOrPrefix(token: string): string | null {
  if (/^\d+$/.test(token)) return prefixToMask(Number(token));
  if (/^\d+\.\d+\.\d+\.\d+$/.test(token)) return token;
  return null;
}

function parseVlanList(tokens: string[]): number[] | null {
  const ids: number[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].toLowerCase() === "to") continue;
    const start = Number(tokens[i]);
    if (!Number.isInteger(start)) return null;
    if (tokens[i + 1]?.toLowerCase() === "to" && tokens[i + 2]) {
      const end = Number(tokens[i + 2]);
      if (!Number.isInteger(end) || end < start) return null;
      for (let id = start; id <= end; id += 1) ids.push(id);
      i += 2;
      continue;
    }
    ids.push(start);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function areaId(raw: string): string {
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return `0.0.0.${n}`;
  }
  return raw;
}

export function parseHuaweiIf(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  let m = compact.match(/^(?:gigabitethernet|ge|g)(\d+)\/(\d+)\/(\d+)$/);
  if (m) return `GE${m[1]}/${m[2]}/${m[3]}`;
  m = compact.match(/^(?:vlanif)(\d+)$/);
  if (m) return `Vlanif${m[1]}`;
  m = compact.match(/^(?:eth-trunk|ethtrunk)(\d+)$/);
  if (m) return `Eth-Trunk${m[1]}`;
  return null;
}

function consumeIf(tokens: string[]): { name: string | null; rest: string[] } {
  if (tokens.length === 0) return { name: null, rest: tokens };
  const tryJoin = (n: number) => parseHuaweiIf(tokens.slice(0, n).join(""));
  for (const n of [3, 2, 1]) {
    if (tokens.length >= n) {
      const name = tryJoin(n);
      if (name) return { name, rest: tokens.slice(n) };
    }
  }
  return { name: null, rest: tokens };
}

export function vrpPrompt(session: CliSession): string {
  const host = session.state.hostname;
  if (session.mode === "user") return `<${host}>`;
  if (session.mode === "if") {
    const key = session.currentIfs[0];
    const iface = key ? session.state.interfaces[key] : undefined;
    const name = iface?.name ?? key ?? "Ethernet";
    return `[${host}-${name}]`;
  }
  if (session.mode === "vlan") return `[${host}-vlan${session.currentVlan}]`;
  if (session.mode === "ospf") return `[${host}-ospf-${session.ospfProcess}]`;
  if (session.mode === "ospf-area") return `[${host}-ospf-${session.ospfProcess}-area-${session.ospfArea}]`;
  if (session.mode === "bgp") return `[${host}-bgp]`;
  if (session.mode === "acl") return `[${host}-acl-basic-${session.aclId}]`;
  return `[${host}]`;
}

function ensureVlan(state: SwitchState, id: number) {
  if (!state.vlans[id]) {
    state.vlans[id] = { id, name: id === 1 ? "default" : `vlan${id}` };
  }
}

function ensureSvi(state: SwitchState, id: number) {
  ensureVlan(state, id);
  if (!state.svis[id]) {
    state.svis[id] = { id, ip: null, mask: null, adminDown: true, vrrp: [] };
  }
}

function ensureEthTrunk(state: SwitchState, id: number): SwitchInterface {
  const key = `Eth-Trunk${id}`;
  if (!state.interfaces[key]) {
    state.interfaces[key] = {
      name: `Eth-Trunk${id}`,
      shortName: key,
      kind: "eth-trunk",
      description: "",
      adminDown: false,
      mode: "access",
      accessVlan: 1,
      nativeVlan: 1,
      allowedVlans: "all",
      portSecurity: false,
      portSecurityMax: 1,
      ethTrunkId: id,
    };
  }
  return state.interfaces[key];
}

function currentPhy(session: CliSession): SwitchInterface[] {
  return session.currentIfs
    .map((key) => session.state.interfaces[key])
    .filter((iface): iface is SwitchInterface => !!iface);
}

function displayCurrent(state: SwitchState): string {
  const lines = ["#", `sysname ${state.hostname}`, "#"];
  const vlanIds = Object.keys(state.vlans)
    .map(Number)
    .filter((id) => id !== 1)
    .sort((a, b) => a - b);
  if (vlanIds.length) {
    lines.push(`vlan batch ${vlanIds.join(" ")}`);
    for (const id of vlanIds) {
      if (state.vlans[id].name !== `vlan${id}`) {
        lines.push(`vlan ${id}`, ` name ${state.vlans[id].name}`);
      }
    }
    lines.push("#");
  }
  const keys = Object.keys(state.interfaces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const key of keys) {
    const iface = state.interfaces[key];
    const body: string[] = [];
    if (iface.description) body.push(` description ${iface.description}`);
    if (iface.adminDown) body.push(" shutdown");
    if (iface.ethTrunkId && iface.kind !== "eth-trunk") body.push(` eth-trunk ${iface.ethTrunkId}`);
    if (iface.mode === "trunk") {
      body.push(" port link-type trunk");
      if (iface.allowedVlans !== "all") {
        body.push(` port trunk allow-pass vlan ${iface.allowedVlans.join(" ")}`);
      }
    } else if (iface.accessVlan !== 1) {
      body.push(" port link-type access");
      body.push(` port default vlan ${iface.accessVlan}`);
    }
    if (body.length) {
      lines.push(`interface ${iface.name}`, ...body, "#");
    }
  }
  const sviIds = Object.keys(state.svis)
    .map(Number)
    .sort((a, b) => a - b);
  for (const id of sviIds) {
    const svi = state.svis[id];
    const body: string[] = [];
    if (svi.ip && svi.mask) body.push(` ip address ${svi.ip} ${svi.mask}`);
    if (!svi.adminDown) body.push(" undo shutdown");
    for (const group of svi.vrrp) {
      body.push(` vrrp vrid ${group.vrid} virtual-ip ${group.vip}`);
    }
    if (body.length) {
      lines.push(`interface Vlanif${id}`, ...body, "#");
    }
  }
  for (const route of state.staticRoutes) {
    lines.push(`ip route-static ${route.dest} ${route.mask} ${route.nextHop}`);
  }
  if (state.ospf) {
    lines.push(`ospf ${state.ospf.processId}${state.ospf.routerId ? ` router-id ${state.ospf.routerId}` : ""}`);
    for (const [area, data] of Object.entries(state.ospf.areas)) {
      lines.push(` area ${area}`);
      for (const net of data.networks) {
        lines.push(`  network ${net.ip} ${net.wildcard}`);
      }
    }
    lines.push("#");
  }
  if (state.bgp) {
    lines.push(`bgp ${state.bgp.localAs}`);
    if (state.bgp.routerId) lines.push(` router-id ${state.bgp.routerId}`);
    for (const peer of state.bgp.peers) {
      lines.push(` peer ${peer.ip} as-number ${peer.remoteAs}`);
    }
    for (const net of state.bgp.networks) {
      lines.push(` network ${net.ip} ${net.mask}`);
    }
    lines.push("#");
  }
  for (const [aclId, rules] of Object.entries(state.acls)) {
    lines.push(`acl number ${aclId}`);
    for (const rule of rules) {
      const src = rule.source === "any" ? "any" : `${rule.source} ${rule.wildcard ?? "0.0.0.0"}`;
      lines.push(` rule ${rule.ruleId} ${rule.action} source ${src}`);
    }
    lines.push("#");
  }
  lines.push("return");
  return lines.join("\n");
}

function displayVlan(state: SwitchState): string {
  const lines = [
    "The total number of VLANs is: " + Object.keys(state.vlans).length,
    "--------------------------------------------------------------------------------",
    "U: Up;         D: Down;         TG: Tagged;         UT: Untagged;",
    "--------------------------------------------------------------------------------",
    "VID  Type    Ports",
  ];
  const ids = Object.keys(state.vlans)
    .map(Number)
    .sort((a, b) => a - b);
  for (const id of ids) {
    const ports = Object.values(state.interfaces)
      .filter((iface) => iface.kind !== "eth-trunk" && !iface.adminDown)
      .filter((iface) =>
        iface.mode === "access" ? iface.accessVlan === id : iface.allowedVlans === "all" || iface.allowedVlans.includes(id),
      )
      .map((iface) => iface.shortName);
    lines.push(`${String(id).padEnd(5, " ")}${state.vlans[id].name.padEnd(8, " ")}${ports.join(" ")}`);
  }
  return lines.join("\n");
}

function displayIpRouting(state: SwitchState): string {
  const lines = ["Destination/Mask    Proto   NextHop         Interface"];
  for (const svi of Object.values(state.svis)) {
    if (svi.ip && svi.mask && !svi.adminDown) {
      lines.push(`${svi.ip}/${svi.mask.startsWith("255.255.255.") ? "24" : "32"}  Direct  ${svi.ip}         Vlanif${svi.id}`);
    }
  }
  for (const route of state.staticRoutes) {
    lines.push(`${route.dest}    Static  ${route.nextHop}      -`);
  }
  return lines.join("\n");
}

function runDisplay(state: SwitchState, rest: string[]): string {
  if (rest.length === 0) return INC;
  if (match(rest[0], "current-configuration", 2) || rest[0].toLowerCase().startsWith("cu")) {
    return displayCurrent(state);
  }
  if (match(rest[0], "vlan", 1)) return displayVlan(state);
  if (match(rest[0], "ip", 2) && rest[1] && (match(rest[1], "routing-table", 3) || rest[1].toLowerCase().startsWith("rout"))) {
    return displayIpRouting(state);
  }
  if (match(rest[0], "ospf", 2)) {
    if (!state.ospf) return "OSPF is not enabled.";
    return `OSPF Process ${state.ospf.processId}\n Router ID: ${state.ospf.routerId ?? "unset"}\n Areas: ${Object.keys(state.ospf.areas).join(", ") || "none"}`;
  }
  if (match(rest[0], "bgp", 2) && rest[1] && match(rest[1], "peer", 2)) {
    if (!state.bgp) return "BGP is not configured.";
    return state.bgp.peers.map((peer) => `${peer.ip}  remote-AS ${peer.remoteAs}`).join("\n") || "No BGP peers.";
  }
  if (match(rest[0], "acl", 2)) {
    const keys = Object.keys(state.acls);
    if (!keys.length) return "No ACL.";
    return displayCurrent(state);
  }
  if (match(rest[0], "vrrp", 2)) {
    const rows: string[] = [];
    for (const svi of Object.values(state.svis)) {
      for (const group of svi.vrrp) {
        rows.push(`Vlanif${svi.id}  VRID ${group.vrid}  VIP ${group.vip}`);
      }
    }
    return rows.join("\n") || "No VRRP group.";
  }
  return ERR;
}

function help(mode: CliSession["mode"]): string {
  if (mode === "user") {
    return "system-view    Enter system view\ndisplay vlan | current-configuration | ip routing-table\n?";
  }
  if (mode === "config") {
    return [
      "sysname NAME",
      "vlan batch 10 20 | vlan 10",
      "interface GigabitEthernet0/0/1 | Vlanif 10 | Eth-Trunk 1",
      "ip route-static DEST MASK NEXTHOP",
      "ospf 1 router-id A.B.C.D",
      "bgp ASN",
      "acl 2000",
      "quit | return",
    ].join("\n");
  }
  return [
    "port link-type access | trunk",
    "port default vlan ID",
    "port trunk allow-pass vlan 10 20",
    "ip address A.B.C.D MASK",
    "undo shutdown",
    "eth-trunk ID",
    "vrrp vrid N virtual-ip A.B.C.D",
    "quit | return",
  ].join("\n");
}

function enterIf(session: CliSession, name: string): string {
  if (name.startsWith("Vlanif")) {
    const id = Number(name.replace("Vlanif", ""));
    if (!Number.isInteger(id)) return ERR;
    ensureSvi(session.state, id);
    session.currentIfs = [name];
    session.mode = "if";
    return "";
  }
  if (name.startsWith("Eth-Trunk")) {
    const id = Number(name.replace("Eth-Trunk", ""));
    ensureEthTrunk(session.state, id);
    session.currentIfs = [name];
    session.mode = "if";
    return "";
  }
  if (!session.state.interfaces[name]) return `Error: Wrong parameter found at '^' position. (${name})`;
  session.currentIfs = [name];
  session.mode = "if";
  return "";
}

function execSystem(session: CliSession, tokens: string[]): string {
  if (tokens[0] === "?" ) return help("config");
  if (match(tokens[0], "quit", 1) || match(tokens[0], "return", 3)) {
    session.mode = "user";
    session.currentIfs = [];
    session.currentVlan = null;
    session.ospfProcess = null;
    session.ospfArea = null;
    session.aclId = null;
    return "";
  }
  if (match(tokens[0], "sysname", 3)) {
    if (!tokens[1]) return INC;
    session.state.hostname = tokens[1];
    return "";
  }
  if (match(tokens[0], "vlan", 2) && tokens[1] && match(tokens[1], "batch", 1)) {
    const ids = parseVlanList(tokens.slice(2));
    if (!ids?.length) return INC;
    for (const id of ids) ensureVlan(session.state, id);
    return "";
  }
  if (match(tokens[0], "vlan", 2)) {
    const id = Number(tokens[1]);
    if (!Number.isInteger(id)) return ERR;
    ensureVlan(session.state, id);
    session.currentVlan = id;
    session.mode = "vlan";
    return "";
  }
  if (match(tokens[0], "interface", 3) || match(tokens[0], "int", 3)) {
    const parsed = consumeIf(tokens.slice(1));
    if (!parsed.name) return INC;
    return enterIf(session, parsed.name);
  }
  if (match(tokens[0], "ip", 2) && tokens[1] && match(tokens[1], "route-static", 5)) {
    if (!tokens[2] || !tokens[3] || !tokens[4]) return INC;
    const mask = parseMaskOrPrefix(tokens[3]);
    if (!mask) return ERR;
    session.state.staticRoutes = session.state.staticRoutes.filter(
      (route) => !(route.dest === tokens[2] && route.mask === mask),
    );
    session.state.staticRoutes.push({ dest: tokens[2], mask, nextHop: tokens[4] });
    return "";
  }
  if (match(tokens[0], "ospf", 2)) {
    const processId = Number(tokens[1] ?? 1);
    if (!Number.isInteger(processId)) return ERR;
    if (!session.state.ospf || session.state.ospf.processId !== processId) {
      session.state.ospf = { processId, routerId: session.state.ospf?.routerId ?? null, areas: session.state.ospf?.areas ?? {} };
      session.state.ospf.processId = processId;
    }
    if (tokens[2] && match(tokens[2], "router-id", 6) && tokens[3]) {
      session.state.ospf.routerId = tokens[3];
    }
    session.ospfProcess = processId;
    session.mode = "ospf";
    return "";
  }
  if (match(tokens[0], "bgp", 2)) {
    const localAs = Number(tokens[1]);
    if (!Number.isInteger(localAs)) return INC;
    session.state.bgp = session.state.bgp ?? { localAs, routerId: null, peers: [], networks: [] };
    session.state.bgp.localAs = localAs;
    session.mode = "bgp";
    return "";
  }
  if (match(tokens[0], "acl", 2)) {
    const id = Number(tokens[1] === "number" ? tokens[2] : tokens[1]);
    if (!Number.isInteger(id)) return INC;
    if (!session.state.acls[id]) session.state.acls[id] = [];
    session.aclId = id;
    session.mode = "acl";
    return "";
  }
  if (match(tokens[0], "display", 2) || match(tokens[0], "dis", 3)) {
    return runDisplay(session.state, tokens.slice(1));
  }
  return ERR;
}

function execVlan(session: CliSession, tokens: string[]): string {
  if (match(tokens[0], "quit", 1)) {
    session.mode = "config";
    session.currentVlan = null;
    return "";
  }
  if (match(tokens[0], "return", 3)) {
    session.mode = "user";
    session.currentVlan = null;
    return "";
  }
  if (match(tokens[0], "name", 1)) {
    if (!tokens[1] || session.currentVlan == null) return INC;
    session.state.vlans[session.currentVlan].name = tokens.slice(1).join(" ");
    return "";
  }
  if (match(tokens[0], "vlan", 2) || match(tokens[0], "interface", 3) || match(tokens[0], "int", 3)) {
    session.mode = "config";
    session.currentVlan = null;
    return execSystem(session, tokens);
  }
  return ERR;
}

function execOspf(session: CliSession, tokens: string[]): string {
  if (match(tokens[0], "quit", 1)) {
    if (session.mode === "ospf-area") {
      session.mode = "ospf";
      session.ospfArea = null;
      return "";
    }
    session.mode = "config";
    session.ospfProcess = null;
    return "";
  }
  if (match(tokens[0], "return", 3)) {
    session.mode = "user";
    session.ospfProcess = null;
    session.ospfArea = null;
    return "";
  }
  if (!session.state.ospf) return ERR;
  if (match(tokens[0], "router-id", 6)) {
    if (!tokens[1]) return INC;
    session.state.ospf.routerId = tokens[1];
    return "";
  }
  if (match(tokens[0], "area", 1)) {
    if (!tokens[1]) return INC;
    const id = areaId(tokens[1]);
    if (!session.state.ospf.areas[id]) session.state.ospf.areas[id] = { networks: [] };
    session.ospfArea = id;
    session.mode = "ospf-area";
    return "";
  }
  if (session.mode === "ospf-area" && match(tokens[0], "network", 3)) {
    if (!tokens[1] || !tokens[2] || !session.ospfArea) return INC;
    const area = session.state.ospf.areas[session.ospfArea];
    area.networks = area.networks.filter((net) => !(net.ip === tokens[1] && net.wildcard === tokens[2]));
    area.networks.push({ ip: tokens[1], wildcard: tokens[2] });
    return "";
  }
  return ERR;
}

function execBgp(session: CliSession, tokens: string[]): string {
  if (match(tokens[0], "quit", 1)) {
    session.mode = "config";
    return "";
  }
  if (match(tokens[0], "return", 3)) {
    session.mode = "user";
    return "";
  }
  if (!session.state.bgp) return ERR;
  if (match(tokens[0], "router-id", 6)) {
    if (!tokens[1]) return INC;
    session.state.bgp.routerId = tokens[1];
    return "";
  }
  if (match(tokens[0], "peer", 2)) {
    if (!tokens[1] || !tokens[2] || !match(tokens[2], "as-number", 2) || !tokens[3]) return INC;
    const ip = tokens[1];
    const remoteAs = Number(tokens[3]);
    session.state.bgp.peers = session.state.bgp.peers.filter((peer) => peer.ip !== ip);
    session.state.bgp.peers.push({ ip, remoteAs });
    return "";
  }
  if (match(tokens[0], "network", 3)) {
    if (!tokens[1] || !tokens[2]) return INC;
    const mask = parseMaskOrPrefix(tokens[2]);
    if (!mask) return ERR;
    session.state.bgp.networks = session.state.bgp.networks.filter((net) => !(net.ip === tokens[1] && net.mask === mask));
    session.state.bgp.networks.push({ ip: tokens[1], mask });
    return "";
  }
  return ERR;
}

function execAcl(session: CliSession, tokens: string[]): string {
  if (match(tokens[0], "quit", 1)) {
    session.mode = "config";
    session.aclId = null;
    return "";
  }
  if (match(tokens[0], "return", 3)) {
    session.mode = "user";
    session.aclId = null;
    return "";
  }
  if (match(tokens[0], "rule", 1)) {
    if (session.aclId == null) return ERR;
    let idx = 1;
    let ruleId = Number(tokens[idx]);
    if (Number.isInteger(ruleId)) idx += 1;
    else ruleId = (session.state.acls[session.aclId].at(-1)?.ruleId ?? 0) + 5;
    const actionTok = tokens[idx];
    if (!actionTok) return INC;
    const action = match(actionTok, "permit", 1) ? "permit" : match(actionTok, "deny", 1) ? "deny" : null;
    if (!action) return ERR;
    idx += 1;
    if (tokens[idx] && match(tokens[idx], "source", 1)) idx += 1;
    const source = tokens[idx] ?? "any";
    const wildcard = source === "any" ? null : (tokens[idx + 1] ?? "0.0.0.0");
    session.state.acls[session.aclId] = session.state.acls[session.aclId].filter((rule) => rule.ruleId !== ruleId);
    session.state.acls[session.aclId].push({
      ruleId,
      action,
      source,
      wildcard: source === "any" ? null : wildcard,
    });
    return "";
  }
  return ERR;
}

function execIf(session: CliSession, tokens: string[]): string {
  if (tokens[0] === "?") return help("if");
  if (match(tokens[0], "quit", 1)) {
    session.mode = "config";
    session.currentIfs = [];
    return "";
  }
  if (match(tokens[0], "return", 3)) {
    session.mode = "user";
    session.currentIfs = [];
    return "";
  }
  if (match(tokens[0], "interface", 3) || match(tokens[0], "int", 3) || match(tokens[0], "vlan", 2)) {
    session.mode = "config";
    session.currentIfs = [];
    return execSystem(session, tokens);
  }

  const isVlanif = session.currentIfs[0]?.startsWith("Vlanif");
  if (isVlanif) {
    const id = Number(session.currentIfs[0].replace("Vlanif", ""));
    const svi = session.state.svis[id];
    if (!svi) return ERR;
    if (match(tokens[0], "ip", 2) && tokens[1] && match(tokens[1], "address", 3)) {
      if (!tokens[2] || !tokens[3]) return INC;
      const mask = parseMaskOrPrefix(tokens[3]);
      if (!mask) return ERR;
      svi.ip = tokens[2];
      svi.mask = mask;
      return "";
    }
    if (match(tokens[0], "undo", 1) && tokens[1] && match(tokens[1], "shutdown", 2)) {
      svi.adminDown = false;
      return "";
    }
    if (match(tokens[0], "shutdown", 2)) {
      svi.adminDown = true;
      return "";
    }
    if (match(tokens[0], "vrrp", 2) && tokens[1] && match(tokens[1], "vrid", 2)) {
      const vrid = Number(tokens[2]);
      if (!tokens[3] || !match(tokens[3], "virtual-ip", 3) || !tokens[4]) return INC;
      svi.vrrp = svi.vrrp.filter((group) => group.vrid !== vrid);
      svi.vrrp.push({ vrid, vip: tokens[4] });
      return "";
    }
    return ERR;
  }

  if (match(tokens[0], "description", 3) || match(tokens[0], "desc", 4)) {
    const text = tokens.slice(1).join(" ");
    for (const iface of currentPhy(session)) iface.description = text;
    return "";
  }
  if (match(tokens[0], "shutdown", 2)) {
    for (const iface of currentPhy(session)) iface.adminDown = true;
    return "";
  }
  if (match(tokens[0], "undo", 1) && tokens[1] && match(tokens[1], "shutdown", 2)) {
    for (const iface of currentPhy(session)) iface.adminDown = false;
    return "";
  }
  if (match(tokens[0], "port", 2) && tokens[1] && match(tokens[1], "link-type", 1)) {
    if (!tokens[2]) return INC;
    if (match(tokens[2], "access", 1)) {
      for (const iface of currentPhy(session)) iface.mode = "access";
      return "";
    }
    if (match(tokens[2], "trunk", 1)) {
      for (const iface of currentPhy(session)) iface.mode = "trunk";
      return "";
    }
    return ERR;
  }
  if (match(tokens[0], "port", 2) && tokens[1] && match(tokens[1], "default", 3) && tokens[2] && match(tokens[2], "vlan", 1)) {
    const id = Number(tokens[3]);
    if (!Number.isInteger(id)) return INC;
    ensureVlan(session.state, id);
    for (const iface of currentPhy(session)) {
      iface.mode = "access";
      iface.accessVlan = id;
    }
    return "";
  }
  if (match(tokens[0], "port", 2) && tokens[1] && match(tokens[1], "trunk", 1) && tokens[2] && match(tokens[2], "allow-pass", 1)) {
    const start = tokens[3] && match(tokens[3], "vlan", 1) ? 4 : 3;
    const ids = parseVlanList(tokens.slice(start));
    if (!ids?.length) return INC;
    for (const id of ids) ensureVlan(session.state, id);
    for (const iface of currentPhy(session)) {
      iface.mode = "trunk";
      iface.allowedVlans = ids;
    }
    return "";
  }
  if (match(tokens[0], "eth-trunk", 3)) {
    const id = Number(tokens[1]);
    if (!Number.isInteger(id)) return INC;
    ensureEthTrunk(session.state, id);
    for (const iface of currentPhy(session)) iface.ethTrunkId = id;
    return "";
  }
  return ERR;
}

export function vrpExecute(session: CliSession, rawLine: string): string {
  const line = rawLine.replace(/\r/g, "");
  if (!line.trim()) return "";
  const tokens = tokensOf(line);
  if (session.mode === "user") {
    if (tokens[0] === "?") return help("user");
    if (match(tokens[0], "system-view", 3) || match(tokens[0], "sys", 3)) {
      session.mode = "config";
      return "Enter system view, return user view with Ctrl+Z.";
    }
    if (match(tokens[0], "display", 2) || match(tokens[0], "dis", 3)) {
      return runDisplay(session.state, tokens.slice(1));
    }
    if (match(tokens[0], "save", 2)) return "The current configuration will be written to the device. Success.";
    return ERR;
  }
  if (session.mode === "config") return execSystem(session, tokens);
  if (session.mode === "vlan") return execVlan(session, tokens);
  if (session.mode === "ospf" || session.mode === "ospf-area") return execOspf(session, tokens);
  if (session.mode === "bgp") return execBgp(session, tokens);
  if (session.mode === "acl") return execAcl(session, tokens);
  return execIf(session, tokens);
}

export function createVrpSession(state: SwitchState): CliSession {
  return {
    state: cloneState(state),
    mode: "user",
    currentIfs: [],
    currentVlan: null,
    awaitingPassword: false,
    ospfProcess: null,
    ospfArea: null,
    aclId: null,
  };
}
