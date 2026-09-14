import { cloneState } from "./switch";
import type { CliMode, CliSession, SwitchInterface, SwitchState } from "./types";

const INVALID = "% Invalid input detected.";
const INCOMPLETE = "% Incomplete command.";

function match(token: string, word: string, min = 2): boolean {
  const t = token.toLowerCase();
  const w = word.toLowerCase();
  return t.length >= min && w.startsWith(t);
}

function tokensOf(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

export function parseInterfaceName(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  let matched = compact.match(/^(?:fastethernet|fa|f)(\d+)\/(\d+)$/);
  if (matched) return `Fa${matched[1]}/${matched[2]}`;
  matched = compact.match(/^(?:gigabitethernet|gi|g)(\d+)\/(\d+)$/);
  if (matched) return `Gi${matched[1]}/${matched[2]}`;
  matched = compact.match(/^vlan(\d+)$/);
  if (matched) return `Vlan${matched[1]}`;
  return null;
}

function parseInterfaceRange(raw: string): string[] | null {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const matched = compact.match(/^(?:fastethernet|fa|f|gigabitethernet|gi|g)(\d+)\/(\d+)-(\d+)$/);
  if (!matched) {
    const single = parseInterfaceName(raw);
    return single ? [single] : null;
  }
  const kind = compact.startsWith("g") || compact.startsWith("gi") || compact.startsWith("gigabit") ? "Gi" : "Fa";
  const slot = matched[1];
  const start = Number(matched[2]);
  const end = Number(matched[3]);
  if (end < start) return null;
  const keys: string[] = [];
  for (let port = start; port <= end; port += 1) keys.push(`${kind}${slot}/${port}`);
  return keys;
}

function consumeInterfaceTokens(tokens: string[]): { name: string | null; rest: string[] } {
  if (tokens.length === 0) return { name: null, rest: tokens };
  const joined = tokens.slice(0, 2).join("");
  const two = parseInterfaceName(joined);
  if (two && tokens.length >= 2 && /^\d+\/\d+$/.test(tokens[1])) {
    return { name: two, rest: tokens.slice(2) };
  }
  const one = parseInterfaceName(tokens[0]);
  if (one) return { name: one, rest: tokens.slice(1) };
  return { name: null, rest: tokens };
}

export function prompt(session: CliSession): string {
  const host = session.state.hostname;
  if (session.awaitingPassword) return "Password: ";
  if (session.mode === "user") return `${host}>`;
  if (session.mode === "priv") return `${host}#`;
  if (session.mode === "config") return `${host}(config)#`;
  if (session.mode === "vlan") return `${host}(config-vlan)#`;
  return `${host}(config-if)#`;
}

function ensureVlan(state: SwitchState, id: number) {
  if (!state.vlans[id]) {
    state.vlans[id] = { id, name: id === 1 ? "default" : `VLAN${String(id).padStart(4, "0")}` };
  }
}

function applyToIfs(session: CliSession, fn: (iface: SwitchInterface) => string | void): string {
  if (session.currentIfs.length === 0) return INVALID;
  const lines: string[] = [];
  for (const key of session.currentIfs) {
    if (key.startsWith("Vlan")) {
      lines.push("% This command is not valid on SVI.");
      continue;
    }
    const iface = session.state.interfaces[key];
    if (!iface) return `% Interface ${key} does not exist.`;
    const msg = fn(iface);
    if (typeof msg === "string" && msg) lines.push(msg);
  }
  return lines.join("\n");
}

function allowedText(iface: SwitchInterface): string {
  if (iface.allowedVlans === "all") return "ALL";
  return iface.allowedVlans.join(",");
}

function showRunningConfig(state: SwitchState): string {
  const lines = ["!", `hostname ${state.hostname}`, "!"];
  if (state.enableSecret) {
    lines.push(`enable secret ${state.enableSecret}`, "!");
  }
  const vlanIds = Object.keys(state.vlans)
    .map(Number)
    .sort((a, b) => a - b)
    .filter((id) => id !== 1);
  for (const id of vlanIds) {
    lines.push(`vlan ${id}`, ` name ${state.vlans[id].name}`, "!");
  }
  const keys = Object.keys(state.interfaces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const key of keys) {
    const iface = state.interfaces[key];
    const body: string[] = [];
    if (iface.description) body.push(` description ${iface.description}`);
    if (iface.adminDown) body.push(" shutdown");
    if (iface.mode === "trunk") {
      body.push(" switchport mode trunk");
      if (iface.nativeVlan !== 1) body.push(` switchport trunk native vlan ${iface.nativeVlan}`);
      if (iface.allowedVlans !== "all") {
        body.push(` switchport trunk allowed vlan ${iface.allowedVlans.join(",")}`);
      }
    } else {
      if (iface.accessVlan !== 1) {
        body.push(" switchport mode access");
        body.push(` switchport access vlan ${iface.accessVlan}`);
      } else if (iface.portSecurity) {
        body.push(" switchport mode access");
      }
    }
    if (iface.portSecurity) {
      body.push(" switchport port-security");
      if (iface.portSecurityMax !== 1) {
        body.push(` switchport port-security maximum ${iface.portSecurityMax}`);
      }
    }
    if (body.length > 0) {
      lines.push(`interface ${iface.name}`, ...body, "!");
    }
  }
  const sviIds = Object.keys(state.svis)
    .map(Number)
    .sort((a, b) => a - b);
  for (const id of sviIds) {
    const svi = state.svis[id];
    const body: string[] = [];
    if (svi.ip && svi.mask) body.push(` ip address ${svi.ip} ${svi.mask}`);
    if (!svi.adminDown) body.push(" no shutdown");
    if (svi.adminDown && (svi.ip || id !== 1)) body.push(" shutdown");
    if (body.length > 0) {
      lines.push(`interface Vlan${id}`, ...body, "!");
    }
  }
  lines.push("end");
  return lines.join("\n");
}

function showVlanBrief(state: SwitchState): string {
  const header = [
    "VLAN Name                             Status    Ports",
    "---- -------------------------------- --------- -------------------------------",
  ];
  const ids = Object.keys(state.vlans)
    .map(Number)
    .sort((a, b) => a - b);
  const rows = ids.map((id) => {
    const vlan = state.vlans[id];
    const ports = Object.values(state.interfaces)
      .filter((iface) => !iface.adminDown && iface.mode === "access" && iface.accessVlan === id)
      .map((iface) => iface.shortName)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const name = vlan.name.padEnd(32, " ").slice(0, 32);
    const portText = ports.join(", ");
    return `${String(id).padEnd(4, " ")} ${name} active    ${portText}`.trimEnd();
  });
  return [...header, ...rows].join("\n");
}

function showIfaceStatus(state: SwitchState): string {
  const lines = [
    "Port      Name               Status       Vlan       Duplex  Speed Type",
  ];
  const keys = Object.keys(state.interfaces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const key of keys) {
    const iface = state.interfaces[key];
    const status = iface.adminDown ? "disabled" : "connected";
    const vlan = iface.mode === "trunk" ? "trunk" : String(iface.accessVlan);
    const speed = iface.kind === "gi" ? "a-1000" : "a-100";
    const type = iface.kind === "gi" ? "1000BaseTX" : "10/100BaseTX";
    lines.push(
      `${iface.shortName.padEnd(10, " ")}${(iface.description || "").slice(0, 18).padEnd(19, " ")}${status.padEnd(13, " ")}${vlan.padEnd(11, " ")}a-full  ${speed.padEnd(6, " ")}${type}`,
    );
  }
  return lines.join("\n");
}

function showIpBrief(state: SwitchState): string {
  const lines = [
    "Interface              IP-Address      OK? Method Status                Protocol",
  ];
  const sviIds = Object.keys(state.svis)
    .map(Number)
    .sort((a, b) => a - b);
  for (const id of sviIds) {
    const svi = state.svis[id];
    const ip = (svi.ip ?? "unassigned").padEnd(16, " ");
    const status = svi.adminDown ? "administratively down" : "up";
    const proto = svi.adminDown ? "down" : "up";
    lines.push(`Vlan${String(id).padEnd(20, " ")}${ip}YES manual ${status.padEnd(22, " ")}${proto}`);
  }
  const keys = Object.keys(state.interfaces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const key of keys) {
    const iface = state.interfaces[key];
    const status = iface.adminDown ? "administratively down" : "up";
    const proto = iface.adminDown ? "down" : "up";
    lines.push(
      `${iface.name.padEnd(23, " ")}${"unassigned".padEnd(16, " ")}YES unset  ${status.padEnd(22, " ")}${proto}`,
    );
  }
  return lines.join("\n");
}

function showTrunk(state: SwitchState): string {
  const trunks = Object.values(state.interfaces).filter((iface) => iface.mode === "trunk");
  if (trunks.length === 0) return "";
  const lines = [
    "Port        Mode             Encapsulation  Status        Native vlan",
  ];
  for (const iface of trunks) {
    const status = iface.adminDown ? "down" : "trunking";
    lines.push(
      `${iface.shortName.padEnd(12, " ")}on               802.1q         ${status.padEnd(14, " ")}${iface.nativeVlan}`,
    );
  }
  lines.push("", "Port        Vlans allowed on trunk");
  for (const iface of trunks) {
    lines.push(`${iface.shortName.padEnd(12, " ")}${allowedText(iface)}`);
  }
  return lines.join("\n");
}

function runShow(state: SwitchState, rest: string[]): string {
  if (rest.length === 0) return INCOMPLETE;
  if (match(rest[0], "running-config", 3) || match(rest[0], "run", 3)) {
    return showRunningConfig(state);
  }
  if (match(rest[0], "vlan", 1)) {
    if (rest.length === 1 || match(rest[1], "brief", 2)) return showVlanBrief(state);
    return INVALID;
  }
  if (match(rest[0], "interfaces", 3) || match(rest[0], "interface", 3)) {
    if (rest.length === 1) return showIfaceStatus(state);
    if (match(rest[1], "status", 2)) return showIfaceStatus(state);
    if (match(rest[1], "trunk", 2)) return showTrunk(state);
    return INVALID;
  }
  if (match(rest[0], "ip", 2) && rest[1] && match(rest[1], "interface", 3) && rest[2] && match(rest[2], "brief", 2)) {
    return showIpBrief(state);
  }
  if (match(rest[0], "ip", 2) && rest[1] && match(rest[1], "brief", 2)) {
    return showIpBrief(state);
  }
  return INVALID;
}

function helpFor(mode: CliMode): string {
  if (mode === "user") {
    return ["enable    Enter privileged mode", "show      Show system information", "?         Help"].join("\n");
  }
  if (mode === "priv") {
    return [
      "configure terminal    Enter configuration mode",
      "disable               Back to user mode",
      "show running-config   Display current configuration",
      "show vlan brief       VLAN summary",
      "show interfaces status",
      "show interfaces trunk",
      "show ip interface brief",
    ].join("\n");
  }
  if (mode === "config") {
    return [
      "hostname NAME",
      "enable secret PASSWORD",
      "vlan ID",
      "interface FastEthernet0/1",
      "interface range fa0/5-8",
      "interface vlan 1",
      "exit | end",
      "do show ...",
    ].join("\n");
  }
  if (mode === "vlan") {
    return ["name VLAN-NAME", "exit | end"].join("\n");
  }
  return [
    "description TEXT",
    "shutdown | no shutdown",
    "switchport mode access | trunk",
    "switchport access vlan ID",
    "switchport trunk allowed vlan LIST",
    "switchport trunk native vlan ID",
    "switchport port-security",
    "switchport port-security maximum N",
    "ip address A.B.C.D MASK   (SVI only)",
    "exit | end",
  ].join("\n");
}

function enterInterface(session: CliSession, keys: string[]): string {
  for (const key of keys) {
    if (key.startsWith("Vlan")) {
      const id = Number(key.replace("Vlan", ""));
      if (!Number.isInteger(id) || id < 1 || id > 4094) return "% Invalid VLAN id.";
      ensureVlan(session.state, id);
      if (!session.state.svis[id]) {
        session.state.svis[id] = { id, ip: null, mask: null, adminDown: true, vrrp: [] };
      }
      session.currentIfs = [key];
      session.currentVlan = null;
      session.mode = "if";
      return "";
    }
    if (!session.state.interfaces[key]) return `% Interface ${key} does not exist.`;
  }
  session.currentIfs = keys;
  session.currentVlan = null;
  session.mode = "if";
  return "";
}

function execConfig(session: CliSession, tokens: string[]): string {
  if (tokens[0] === "?" || tokens[0] === "help") return helpFor("config");
  if (match(tokens[0], "exit", 2)) {
    session.mode = "priv";
    return "";
  }
  if (match(tokens[0], "end", 3)) {
    session.mode = "priv";
    session.currentIfs = [];
    session.currentVlan = null;
    return "";
  }
  if (match(tokens[0], "do", 2)) {
    return runShow(session.state, tokens.slice(1));
  }
  if (match(tokens[0], "hostname", 4)) {
    if (!tokens[1]) return INCOMPLETE;
    session.state.hostname = tokens[1];
    return "";
  }
  if (match(tokens[0], "enable", 2) && tokens[1] && (match(tokens[1], "secret", 3) || match(tokens[1], "password", 4))) {
    if (!tokens[2]) return INCOMPLETE;
    session.state.enableSecret = tokens[2];
    return "";
  }
  if (match(tokens[0], "vlan", 2)) {
    const id = Number(tokens[1]);
    if (!Number.isInteger(id) || id < 1 || id > 4094) return "% Invalid VLAN id.";
    ensureVlan(session.state, id);
    session.currentVlan = id;
    session.currentIfs = [];
    session.mode = "vlan";
    return "";
  }
  if (match(tokens[0], "interface", 3) || match(tokens[0], "int", 3)) {
    const rest = tokens.slice(1);
    if (rest.length === 0) return INCOMPLETE;
    if (match(rest[0], "range", 3)) {
      const spec = rest.slice(1).join("");
      const keys = parseInterfaceRange(spec);
      if (!keys) return INVALID;
      return enterInterface(session, keys);
    }
    if (match(rest[0], "vlan", 1) && rest[1]) {
      return enterInterface(session, [`Vlan${rest[1]}`]);
    }
    const parsed = consumeInterfaceTokens(rest);
    if (!parsed.name) return INVALID;
    return enterInterface(session, [parsed.name]);
  }
  if (match(tokens[0], "no", 2) && tokens[1] && match(tokens[1], "vlan", 2)) {
    const id = Number(tokens[2]);
    if (id === 1) return "% Default VLAN 1 can not be deleted.";
    if (!session.state.vlans[id]) return "";
    delete session.state.vlans[id];
    return "";
  }
  return INVALID;
}

function execVlan(session: CliSession, tokens: string[]): string {
  if (tokens[0] === "?" || tokens[0] === "help") return helpFor("vlan");
  if (match(tokens[0], "exit", 2)) {
    session.mode = "config";
    session.currentVlan = null;
    return "";
  }
  if (match(tokens[0], "end", 3)) {
    session.mode = "priv";
    session.currentVlan = null;
    return "";
  }
  if (match(tokens[0], "name", 2)) {
    if (!tokens[1] || session.currentVlan == null) return INCOMPLETE;
    ensureVlan(session.state, session.currentVlan);
    session.state.vlans[session.currentVlan].name = tokens.slice(1).join(" ");
    return "";
  }
  if (match(tokens[0], "vlan", 2) || match(tokens[0], "interface", 3) || match(tokens[0], "int", 3)) {
    session.mode = "config";
    session.currentVlan = null;
    return execConfig(session, tokens);
  }
  return INVALID;
}

function parseVlanList(spec: string): number[] | "all" | null {
  if (spec.toLowerCase() === "all") return "all";
  const parts = spec.split(",").map((item) => item.trim()).filter(Boolean);
  const ids: number[] = [];
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start) return null;
      for (let id = start; id <= end; id += 1) ids.push(id);
      continue;
    }
    const id = Number(part);
    if (!Number.isInteger(id)) return null;
    ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function execInterface(session: CliSession, tokens: string[]): string {
  if (tokens[0] === "?" || tokens[0] === "help") return helpFor("if");
  if (match(tokens[0], "exit", 2)) {
    session.mode = "config";
    session.currentIfs = [];
    return "";
  }
  if (match(tokens[0], "end", 3)) {
    session.mode = "priv";
    session.currentIfs = [];
    return "";
  }
  if (match(tokens[0], "interface", 3) || match(tokens[0], "int", 3) || match(tokens[0], "vlan", 2)) {
    session.mode = "config";
    session.currentIfs = [];
    return execConfig(session, tokens);
  }
  if (match(tokens[0], "do", 2)) return runShow(session.state, tokens.slice(1));

  const isSvi = session.currentIfs.length === 1 && session.currentIfs[0].startsWith("Vlan");
  if (isSvi) {
    const id = Number(session.currentIfs[0].replace("Vlan", ""));
    const svi = session.state.svis[id];
    if (!svi) return INVALID;
    if (match(tokens[0], "ip", 2) && tokens[1] && match(tokens[1], "address", 3)) {
      if (!tokens[2] || !tokens[3]) return INCOMPLETE;
      svi.ip = tokens[2];
      svi.mask = tokens[3];
      return "";
    }
    if (match(tokens[0], "no", 2) && tokens[1] && match(tokens[1], "ip", 2)) {
      svi.ip = null;
      svi.mask = null;
      return "";
    }
    if (match(tokens[0], "shutdown", 2)) {
      svi.adminDown = true;
      return "";
    }
    if (match(tokens[0], "no", 2) && tokens[1] && match(tokens[1], "shutdown", 2)) {
      svi.adminDown = false;
      return "";
    }
    return INVALID;
  }

  if (match(tokens[0], "description", 4) || match(tokens[0], "desc", 4)) {
    const text = tokens.slice(1).join(" ");
    return applyToIfs(session, (iface) => {
      iface.description = text;
    });
  }
  if (match(tokens[0], "shutdown", 2)) {
    return applyToIfs(session, (iface) => {
      iface.adminDown = true;
    });
  }
  if (match(tokens[0], "no", 2) && tokens[1] && match(tokens[1], "shutdown", 2)) {
    return applyToIfs(session, (iface) => {
      iface.adminDown = false;
    });
  }
  if (match(tokens[0], "switchport", 2) || match(tokens[0], "sw", 2)) {
    if (!tokens[1]) return INCOMPLETE;
    if (match(tokens[1], "mode", 1)) {
      if (!tokens[2]) return INCOMPLETE;
      if (match(tokens[2], "access", 1)) {
        return applyToIfs(session, (iface) => {
          iface.mode = "access";
        });
      }
      if (match(tokens[2], "trunk", 1)) {
        return applyToIfs(session, (iface) => {
          iface.mode = "trunk";
        });
      }
      return INVALID;
    }
    if (match(tokens[1], "access", 1)) {
      if (!tokens[2] || !match(tokens[2], "vlan", 1) || !tokens[3]) return INCOMPLETE;
      const id = Number(tokens[3]);
      if (!Number.isInteger(id)) return INVALID;
      ensureVlan(session.state, id);
      return applyToIfs(session, (iface) => {
        iface.mode = "access";
        iface.accessVlan = id;
      });
    }
    if (match(tokens[1], "trunk", 1)) {
      if (!tokens[2]) return INCOMPLETE;
      if (match(tokens[2], "allowed", 1)) {
        if (!tokens[3] || !match(tokens[3], "vlan", 1) || !tokens[4]) return INCOMPLETE;
        const list = parseVlanList(tokens.slice(4).join(""));
        if (!list) return INVALID;
        return applyToIfs(session, (iface) => {
          iface.mode = "trunk";
          iface.allowedVlans = list;
        });
      }
      if (match(tokens[2], "native", 1)) {
        if (!tokens[3] || !match(tokens[3], "vlan", 1) || !tokens[4]) return INCOMPLETE;
        const id = Number(tokens[4]);
        return applyToIfs(session, (iface) => {
          iface.mode = "trunk";
          iface.nativeVlan = id;
        });
      }
      return INVALID;
    }
    if (match(tokens[1], "port-security", 4) || match(tokens[1], "port-security", 1) || tokens[1].toLowerCase().startsWith("port-s")) {
      if (!tokens[2]) {
        return applyToIfs(session, (iface) => {
          iface.portSecurity = true;
          if (iface.mode !== "access") iface.mode = "access";
        });
      }
      if (match(tokens[2], "maximum", 3)) {
        const max = Number(tokens[3]);
        if (!Number.isInteger(max) || max < 1) return INVALID;
        return applyToIfs(session, (iface) => {
          iface.portSecurity = true;
          iface.portSecurityMax = max;
        });
      }
      return INVALID;
    }
    return INVALID;
  }
  if (match(tokens[0], "no", 2) && tokens[1] && (match(tokens[1], "switchport", 2) || tokens[1].toLowerCase().startsWith("sw"))) {
    if (tokens[2] && tokens[2].toLowerCase().startsWith("port-s")) {
      return applyToIfs(session, (iface) => {
        iface.portSecurity = false;
      });
    }
  }
  return INVALID;
}

function execExec(session: CliSession, tokens: string[], privileged: boolean): string {
  if (tokens[0] === "?" || tokens[0] === "help") return helpFor(privileged ? "priv" : "user");
  if (match(tokens[0], "enable", 2)) {
    if (session.state.enableSecret) {
      session.awaitingPassword = true;
      return "";
    }
    session.mode = "priv";
    return "";
  }
  if (privileged && match(tokens[0], "disable", 3)) {
    session.mode = "user";
    return "";
  }
  if (match(tokens[0], "exit", 2) || match(tokens[0], "logout", 3)) {
    if (privileged) {
      session.mode = "user";
      return "";
    }
    return "";
  }
  if (privileged && (match(tokens[0], "configure", 4) || match(tokens[0], "config", 4) || match(tokens[0], "conf", 4))) {
    if (!tokens[1] || match(tokens[1], "terminal", 1)) {
      session.mode = "config";
      return "";
    }
    return INVALID;
  }
  if (match(tokens[0], "show", 2) || match(tokens[0], "sh", 2)) {
    if (!privileged) return "% Authorization failed. Use enable first.";
    return runShow(session.state, tokens.slice(1));
  }
  return INVALID;
}

export function createSession(state: SwitchState): CliSession {
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

export function execute(session: CliSession, rawLine: string): string {
  const line = rawLine.replace(/\r/g, "");
  if (session.awaitingPassword) {
    session.awaitingPassword = false;
    if (line === session.state.enableSecret) {
      session.mode = "priv";
      return "";
    }
    return "% Access denied";
  }
  if (!line.trim()) return "";
  const tokens = tokensOf(line);
  if (session.mode === "user") return execExec(session, tokens, false);
  if (session.mode === "priv") return execExec(session, tokens, true);
  if (session.mode === "config") return execConfig(session, tokens);
  if (session.mode === "vlan") return execVlan(session, tokens);
  return execInterface(session, tokens);
}
