"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadLastVendor, saveLastVendor, subscribeLastVendor } from "./storage";
import { tryParseVendor, type Vendor } from "./vendor";

type VendorContextValue = {
  vendor: Vendor | null;
};

const VendorContext = createContext<VendorContextValue>({ vendor: null });

function vendorFromUrl(): Vendor | null {
  if (typeof window === "undefined") return null;
  return tryParseVendor(new URLSearchParams(window.location.search).get("vendor"));
}

function vendorFromDom(): Vendor | null {
  if (typeof document === "undefined") return null;
  return tryParseVendor(document.documentElement.dataset.vendor);
}

export function VendorProvider({
  initialVendor,
  children,
}: {
  initialVendor: Vendor | null;
  children: ReactNode;
}) {
  const [vendor, setVendor] = useState<Vendor | null>(initialVendor);

  useEffect(() => {
    const next = vendorFromUrl() ?? loadLastVendor() ?? vendorFromDom() ?? initialVendor;
    if (next) {
      saveLastVendor(next);
      setVendor(next);
    }
    return subscribeLastVendor(() => setVendor(loadLastVendor() ?? vendorFromUrl()));
  }, [initialVendor]);

  const value = useMemo(() => ({ vendor }), [vendor]);
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

/** Inner pages: reuse the bank chosen on the home page. */
export function useActiveVendor(): { vendor: Vendor | null; ready: boolean } {
  const ctx = useContext(VendorContext);
  return { vendor: ctx.vendor, ready: true };
}
