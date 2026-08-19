#!/usr/bin/env node
/**
 * Discover `*.test.mjs` files and run them with node:test.
 * tsx loads TypeScript modules imported from tests (coach/, habitModel).
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "docs", "ios", "android", ".git"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".test.mjs")) acc.push(p);
  }
  return acc;
}

const files = walk(root).sort();
if (!files.length) {
  console.error("No *.test.mjs files found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-reporter", "spec", ...files],
  { stdio: "inherit", cwd: root, env: { ...process.env, NODE_ENV: "test" } },
);

process.exit(result.status === null ? 1 : result.status);
