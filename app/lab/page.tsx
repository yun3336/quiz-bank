"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NeedVendor, VendorBar } from "@/components/VendorBar";
import { EmptyState, PageHeader } from "@/components/ui";
import { allLabs } from "@/lib/lab/labs";
import type { LabTrack } from "@/lib/lab/types";
import { loadProgress } from "@/lib/storage";
import { useActiveVendor } from "@/lib/useResolvedVendor";
import { VENDOR_META, vendorAccent, type Vendor } from "@/lib/vendor";

const groups: { title: string; blurb: string; track: LabTrack; vendor: Vendor }[] = [
  { title: "Cisco IOS 交換器", blurb: "hostname、VLAN、Trunk、Port Security", track: "Cisco", vendor: "cisco" },
  { title: "華為 HCIA 工程師", blurb: "VRP 視圖、VLAN、Trunk、Vlanif、靜態路由", track: "HCIA", vendor: "huawei" },
  { title: "華為 HCIP 高級工程師", blurb: "Eth-Trunk、OSPF、VRRP、ACL", track: "HCIP", vendor: "huawei" },
  { title: "華為 HCIE 專家", blurb: "多區域 OSPF、BGP、園區核心綜合", track: "HCIE", vendor: "huawei" },
];

export default function LabIndexPage() {
  return <LabIndexInner />;
}

function LabIndexInner() {
  const { vendor } = useActiveVendor();
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    setDone(loadProgress().labCompletions.map((item) => item.labId));
  }, []);

  if (!vendor) {
    return <NeedVendor />;
  }

  const visible = groups.filter((group) => group.vendor === vendor);
  const meta = VENDOR_META[vendor];
  const accent = vendorAccent(vendor);

  return (
    <div className="space-y-6 qb-in">
      <PageHeader
        title="實驗"
        desc={
          !meta.hasLabs
            ? `${meta.label}沒有 CLI 實驗，請改走練習或模考。`
            : vendor === "huawei"
              ? "華為實驗使用 VRP。"
              : "Cisco 實驗使用 IOS。"
        }
      />
      <VendorBar vendor={vendor} />
      {!meta.hasLabs ? (
        <EmptyState title={`${meta.label}題庫沒有實操 LAB`} desc={meta.methods ?? "請改走練習或模考。"}>
          <Link href={`/practice?vendor=${vendor}`} className={`inline-block rounded-xl px-5 py-3 text-white ${accent.btn}`}>
            去{meta.label}練習
          </Link>
        </EmptyState>
      ) : (
        visible.map((group) => {
          const items = allLabs.filter((lab) => lab.track === group.track);
          if (items.length === 0) return null;
          return (
            <section key={group.track}>
              <p className="qb-section">{group.title}</p>
              <p className="-mt-1 mb-2 px-1 text-xs text-slate-400">{group.blurb}</p>
              <ul className="qb-group">
                {items.map((lab) => {
                  const finished = done.includes(lab.id);
                  return (
                    <li key={lab.id}>
                      <Link href={`/lab/${lab.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium ${accent.text}`}>
                            {meta.label} · {lab.level}
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold leading-snug">{lab.title}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">{lab.scenario}</p>
                        </div>
                        {finished ? (
                          <span className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            已完成
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
