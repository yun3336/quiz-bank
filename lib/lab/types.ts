export type CliMode =
  | "user"
  | "priv"
  | "config"
  | "if"
  | "vlan"
  | "ospf"
  | "ospf-area"
  | "bgp"
  | "acl";

export type SwitchportMode = "access" | "trunk";
export type LabEngine = "ios" | "vrp";
export type LabTrack = "Cisco" | "HCIA" | "HCIP" | "HCIE";

export interface SwitchInterface {
  name: string;
  shortName: string;
  kind: "fa" | "gi" | "ge" | "vlan" | "eth-trunk";
  description: string;
  adminDown: boolean;
  mode: SwitchportMode;
  accessVlan: number;
  nativeVlan: number;
  allowedVlans: "all" | number[];
  portSecurity: boolean;
  portSecurityMax: number;
  ethTrunkId: number | null;
}

export interface VlanRecord {
  id: number;
  name: string;
}

export interface SviRecord {
  id: number;
  ip: string | null;
  mask: string | null;
  adminDown: boolean;
  vrrp: { vrid: number; vip: string }[];
}

export interface StaticRoute {
  dest: string;
  mask: string;
  nextHop: string;
}

export interface OspfState {
  processId: number;
  routerId: string | null;
  areas: Record<string, { networks: { ip: string; wildcard: string }[] }>;
}

export interface BgpState {
  localAs: number;
  routerId: string | null;
  peers: { ip: string; remoteAs: number }[];
  networks: { ip: string; mask: string }[];
}

export interface AclRule {
  ruleId: number;
  action: "permit" | "deny";
  source: string;
  wildcard: string | null;
}

export interface SwitchState {
  hostname: string;
  enableSecret: string | null;
  vlans: Record<number, VlanRecord>;
  interfaces: Record<string, SwitchInterface>;
  svis: Record<number, SviRecord>;
  staticRoutes: StaticRoute[];
  ospf: OspfState | null;
  bgp: BgpState | null;
  acls: Record<number, AclRule[]>;
}

export interface CliSession {
  state: SwitchState;
  mode: CliMode;
  currentIfs: string[];
  currentVlan: number | null;
  awaitingPassword: boolean;
  ospfProcess: number | null;
  ospfArea: string | null;
  aclId: number | null;
}

export interface LabCheck {
  id: string;
  label: string;
  pass: (state: SwitchState) => boolean;
}

export interface Lab {
  id: string;
  title: string;
  level: string;
  track: LabTrack;
  engine: LabEngine;
  scenario: string;
  topology: string;
  objectives: string[];
  hints: string[];
  initial?: (state: SwitchState) => SwitchState;
  checks: LabCheck[];
}

export interface LabCompletion {
  labId: string;
  at: number;
}
