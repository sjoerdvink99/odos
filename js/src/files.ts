import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import type { Format, Mapping } from "./spec";
import { read } from "./standards/read";
import { records as parsed } from "./standards/records";
import type { TracedRun } from "./standards/runs";

const FILES = new Set([".json", ".jsonl", ".eval", ".traj"]);
const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const STORED = 0;
const DEFLATED = 8;

export const isFolder = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

export const label = (path: string): string => basename(path.replace(/[\\/]+$/, ""), extname(path));

export function records(path: string): unknown[] {
  const content = readFileSync(path);
  if (content.readUInt32LE(0) === LOCAL) return entries(content).flatMap((text) => parsed(text));
  const companions = join(path.slice(0, path.length - extname(path).length), "subagents");
  const extra = extname(path) === ".jsonl" && isFolder(companions) ? sorted(readdirSync(companions).filter((name) => name.endsWith(".jsonl"))) : [];
  return [content.toString("utf8"), ...extra.map((name) => readFileSync(join(companions, name), "utf8"))].flatMap((text) => parsed(text));
}

export function runs(path: string, how?: Format | Mapping): TracedRun[] {
  if (!isFolder(path)) return read(records(path), how);
  const found: TracedRun[] = [];
  for (const file of sorted(readdirSync(path, { recursive: true }).map(String))) {
    const parts = file.split(sep);
    const full = join(path, file);
    if (!FILES.has(extname(file)) || parts.at(-2) === "subagents" || !statSync(full).isFile()) continue;
    found.push(...unique(found, read(records(full), how), label(file)));
  }
  return found;
}

export function unique(earlier: TracedRun[], later: TracedRun[], prefix: string): TracedRun[] {
  const seen = new Set(earlier.map((run) => run.id));
  return later.map((run) => {
    const found = seen.has(run.id) ? { ...run, id: `${prefix}/${run.id}` } : run;
    seen.add(found.id);
    return found;
  });
}

const sorted = (paths: string[]): string[] =>
  paths
    .map((path) => ({ path, key: path.split(sep).join("\u0000") }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ path }) => path);

function entries(archive: Buffer): string[] {
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== END) end -= 1;
  if (end < 0) return [];
  const found: [string, string][] = [];
  let at = archive.readUInt32LE(end + 16);
  for (let count = archive.readUInt16LE(end + 10); count > 0 && archive.readUInt32LE(at) === CENTRAL; count -= 1) {
    const method = archive.readUInt16LE(at + 10);
    const size = archive.readUInt32LE(at + 20);
    const length = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString("utf8", at + 46, at + 46 + length);
    at += 46 + length + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
    if (!name.startsWith("samples/") || !name.endsWith(".json") || ![STORED, DEFLATED].includes(method)) continue;
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + size);
    found.push([name, (method === DEFLATED ? inflateRawSync(data) : data).toString("utf8")]);
  }
  return found.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, text]) => text);
}
