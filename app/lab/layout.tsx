import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/lab" },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
