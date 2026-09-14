import { appIconImage } from "@/lib/appIcon";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size } = await context.params;
  return appIconImage(size === "512" ? 512 : 192);
}
