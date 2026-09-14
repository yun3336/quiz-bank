import type { SwitchInterface, SwitchState } from "./types";

function portTemplate(
  kind: SwitchInterface["kind"],
  name: string,
  shortName: string,
): SwitchInterface {
  return {
    name,
    shortName,
    kind,
    description: "",
    adminDown: false,
    mode: "access",
    accessVlan: 1,
    nativeVlan: 1,
    allowedVlans: "all",
    portSecurity: false,
    portSecurityMax: 1,
    ethTrunkId: null,
  };
}

function emptyExtras() {
  return {
    staticRoutes: [] as SwitchState["staticRoutes"],
    ospf: null as SwitchState["ospf"],
    bgp: null as SwitchState["bgp"],
    acls: {} as SwitchState["acls"],
  };
}

export function createDefaultSwitch(): SwitchState {
  const interfaces: Record<string, SwitchInterface> = {};
  for (let port = 1; port <= 24; port += 1) {
    const iface = portTemplate("fa", `FastEthernet0/${port}`, `Fa0/${port}`);
    interfaces[iface.shortName] = iface;
  }
  for (let port = 1; port <= 2; port += 1) {
    const iface = portTemplate("gi", `GigabitEthernet0/${port}`, `Gi0/${port}`);
    interfaces[iface.shortName] = iface;
  }
  return {
    hostname: "Switch",
    enableSecret: null,
    vlans: { 1: { id: 1, name: "default" } },
    interfaces,
    svis: { 1: { id: 1, ip: null, mask: null, adminDown: true, vrrp: [] } },
    ...emptyExtras(),
  };
}

export function createDefaultHuawei(): SwitchState {
  const interfaces: Record<string, SwitchInterface> = {};
  for (let port = 1; port <= 24; port += 1) {
    const iface = portTemplate("ge", `GigabitEthernet0/0/${port}`, `GE0/0/${port}`);
    interfaces[iface.shortName] = iface;
  }
  return {
    hostname: "HUAWEI",
    enableSecret: null,
    vlans: { 1: { id: 1, name: "default" } },
    interfaces,
    svis: { 1: { id: 1, ip: null, mask: null, adminDown: true, vrrp: [] } },
    ...emptyExtras(),
  };
}

export function cloneState(state: SwitchState): SwitchState {
  return structuredClone(state);
}

export function getIface(state: SwitchState, key: string): SwitchInterface | undefined {
  return state.interfaces[key];
}
