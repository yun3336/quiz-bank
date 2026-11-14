#!/usr/bin/env node
/**
 * 產生原生殼用完整題庫（含正解）。
 * 輸出：native/offline-bank.json
 * 切勿複製到網站 public/（Vercel 部署不得包含此檔）。
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const outDir = path.join(root, "native");
const outFile = path.join(outDir, "offline-bank.json");

const files = (await readdir(dataDir)).filter((name) => name.endsWith(".json")).sort();
const questions = [];
for (const name of files) {
  const raw = await readFile(path.join(dataDir, name), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${name} is not a question array`);
  }
  questions.push(...parsed);
}

const ids = new Set();
for (const item of questions) {
  if (!item?.id || typeof item.id !== "string") throw new Error("question missing id");
  if (ids.has(item.id)) throw new Error(`duplicate question id: ${item.id}`);
  ids.add(item.id);
}

await mkdir(outDir, { recursive: true });
const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  questions,
};
await writeFile(outFile, `${JSON.stringify(payload)}\n`, "utf8");
console.log(`Wrote ${outFile} (${questions.length} questions)`);
