import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { View, parse } from "vega";
import { compile, read, tables, type Spec } from "tracegram";

const MARKS = ["variants", "icicle", "sankey", "transitions", "graph", "activities", "distribution", "projection", "sequences"] as const;
const LEVELED = new Set<string>(["variants", "icicle", "sankey", "transitions", "graph", "activities", "projection"]);
const SIZES = (process.argv[2] ?? "1000,10000").split(",").map(Number);

const records = readFileSync(new URL("../../docs/assets/swe-agent.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n");
const seeds = read(records.join("\n"), { run: "run", actor: "actor", name: "tool", failed: "failed" }).map((run) => run.process.split(" -> "));

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function corpus(size: number): string[] {
  const next = random(size);
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  return Array.from({ length: size }, () => {
    const steps = [...pick(seeds)];
    for (let edits = 1 + Math.floor(next() * 3); edits > 0; edits -= 1) {
      const at = Math.floor(next() * steps.length);
      if (next() < 0.5) steps.splice(at, 2);
      else steps.splice(at, 0, ...steps.slice(at, at + 2));
    }
    return steps.join(" -> ") || "model";
  });
}

const time = async (work: () => unknown) => {
  const start = performance.now();
  await work();
  return performance.now() - start;
};

async function measure(mark: string, values: string[]) {
  const spec = { mark, data: { values }, ...(mark === "variants" ? { limit: 12 } : {}) } as Spec;
  let vega: ReturnType<typeof compile> = {};
  const compiling = await time(() => (vega = compile(spec)));
  const view = new View(parse(vega), { renderer: "none" });
  const first = await time(() => view.runAsync());
  const level = LEVELED.has(mark) ? await time(() => view.signal("level", "full").runAsync()) : NaN;
  view.finalize();
  const linked = compile({
    data: { values },
    vconcat: [
      { mark: "distribution", params: [{ name: "picked", select: "click" }] },
      { mark, filter: { param: "picked" } },
    ],
  } as Spec);
  const both = new View(parse(linked), { renderer: "none" });
  await both.runAsync();
  const ids = values.slice(0, Math.ceil(values.length / 10)).map((_, index) => String(index));
  const select = await time(() => both.signal("picked_tuple", { ids, add: false }).runAsync());
  both.finalize();
  return { compiling, megabytes: JSON.stringify(vega).length / 1e6, first, level, select };
}

const cell = (value: number) => (Number.isNaN(value) ? "" : value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString("en"));

console.log("| runs | distinct traces | mark | compile ms | spec MB | first render ms | level switch ms | select 10% ms |");
console.log("|---|---|---|---|---|---|---|---|");
for (const size of SIZES) {
  const values = corpus(size);
  const distinct = new Set(tables(read(values)).runs.map((row) => row.full)).size;
  for (const mark of MARKS) {
    const found = await measure(mark, values);
    const row = [
      size.toLocaleString("en"),
      distinct.toLocaleString("en"),
      mark,
      cell(found.compiling),
      found.megabytes.toFixed(1),
      cell(found.first),
      cell(found.level),
      cell(found.select),
    ];
    console.log(`| ${row.join(" | ")} |`);
  }
}
