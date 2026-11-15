import type { Metadata } from "next";
import { LabPlayer } from "@/components/LabPlayer";
import { allLabs } from "@/lib/lab/labs";

export function generateStaticParams() {
  return allLabs.map((lab) => ({ id: lab.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    alternates: { canonical: `/lab/${id}` },
  };
}

export default async function LabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LabPlayer labId={id} />;
}
