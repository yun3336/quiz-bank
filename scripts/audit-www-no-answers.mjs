#!/usr/bin/env node
/** 掃描 www/（或參數路徑）是否含完整答案庫產物。 */
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(process.argv[2] || path.join(root, "www"));

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, out = []) {
  if (!(await exists(dir))) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!(await exists(target))) {
  console.log(`skip: ${target} missing`);
  process.exit(0);
}

if (await exists(path.join(target, "offline-bank.json"))) {
  console.error("FAIL: offline-bank.json present");
  process.exit(1);
}

for (const file of await walk(target)) {
  const base = path.basename(file).toLowerCase();
  if (base.includes("offline-bank")) {
    console.error(`FAIL: ${file}`);
    process.exit(1);
  }
  if (!/\.(js|json|html|map|txt)$/i.test(file)) continue;
  const text = await readFile(file, "utf8");
  if (
    text.includes('"generatedAt"') &&
    text.includes('"questions"') &&
    /"answer"\s*:\s*\[/.test(text) &&
    text.length > 50_000
  ) {
    console.error(`FAIL: large answer-bearing payload-like content in ${file}`);
    process.exit(1);
  }
}

console.log(`OK: no offline answer-bank artifacts under ${target}`);
