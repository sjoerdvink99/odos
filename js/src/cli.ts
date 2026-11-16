#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { isFolder, label, records, runs, unique } from "./files";
import { compile, load, render, report, validate, version } from "./index";
import type { Mapping, Spec, VConcatSpec } from "./spec";
import type { TracedRun } from "./standards/runs";

const USAGE = `usage: tracegram <spec.json | expression | -> [-o out] [--vega]
       tracegram report <records> [<records>] [--trace mapping.json] [-o report.html]

  tracegram view.json -o figure.svg
  tracegram view.json --vega -o figure.vg.json
  tracegram "(model -> tool[])* -> model" > loop.svg
  tracegram report spans.jsonl -o report.html
  tracegram report logs/                          a folder is one corpus
  tracegram report before.jsonl after.jsonl       two sources are compared
  cat view.json | tracegram -`;

const HOME = "https://sjoerdvink99.github.io/tracegram/";

const PAGE = (title: string, library: string, spec: string, shown: string) => `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:24px;font-family:ui-monospace,monospace;color:#1c2027">
<div id="view"></div>
<details><summary>Spec</summary><pre>${shown}</pre></details>
<footer style="margin-top:16px;font-size:11px;color:#6a7280">Made with <a href="${HOME}">tracegram</a> ${version} · <a href="${HOME}#cite">cite</a></footer>
<script>${library}</script>
<script>tracegram.embed(document.getElementById("view"), ${spec});</script>
</body>
</html>
`;

const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function read(source: string): Spec {
  if (source === "-") return JSON.parse(readFileSync(0, "utf8"));
  if (source.endsWith(".json")) return JSON.parse(readFileSync(source, "utf8"));
  return { mark: "diagram", process: source };
}

function reported(sources: string[], trace?: Mapping): { spec: VConcatSpec; shown: object } {
  if (sources.length > 2) throw new Error("report compares two sources; put more in one folder to read them as one corpus");
  if (sources.length === 1 && !isFolder(sources[0])) {
    const spec = report({ values: records(sources[0]) }, trace);
    return { spec, shown: { ...spec, data: { url: basename(sources[0]) } } };
  }
  const labels = sources.map(label);
  const named = labels[0] === labels[1] ? sources : labels;
  const found = sources.reduce<TracedRun[]>((all, source, index) => {
    const labelled = runs(source, trace).map((run) => (sources.length === 2 ? { ...run, group: named[index] } : run));
    return [...all, ...unique(all, labelled, named[index])];
  }, []);
  const spec = report({ values: found, format: "runs" }, found.some((run) => run.group) ? { group: "group" } : undefined);
  return { spec, shown: { trace: spec.trace, vconcat: spec.vconcat } };
}

function page(sources: string[], mapping: string | null): string {
  const trace = mapping ? (JSON.parse(readFileSync(mapping, "utf8")) as Mapping) : undefined;
  const { spec, shown } = reported(sources, trace);
  const library = readFileSync(new URL("./tracegram.min.js", import.meta.url), "utf8");
  const title = escaped(sources.map((source) => basename(source)).join(" · "));
  return PAGE(title, library, JSON.stringify(validate(spec)).replace(/</g, "\\u003c"), escaped(JSON.stringify(shown, null, 2)));
}

const args = process.argv.slice(2);
const option = (flag: string) => (args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? null) : null);
const output = option("-o");
const positional = args.filter((arg, index) => !arg.startsWith("--") && arg !== "-o" && !["-o", "--trace"].includes(args[index - 1]));
const reporting = positional[0] === "report";
const sources = reporting ? positional.slice(1) : positional.slice(0, 1);

if (args.includes("-v") || args.includes("--version")) {
  console.log(version);
  process.exit(0);
}

const help = args.includes("-h") || args.includes("--help");

if (sources.length === 0 || help) {
  console.error(USAGE);
  process.exit(help ? 0 : 1);
}

try {
  if (reporting) {
    const target = output ?? "report.html";
    writeFileSync(target, page(sources, option("--trace")));
    console.error(`tracegram: wrote ${target}`);
  } else {
    const [source] = sources;
    const spec = read(source);
    const base = source.endsWith(".json") ? `${dirname(source)}/` : "";
    const text = args.includes("--vega") ? JSON.stringify(compile(await load(spec, base)), null, 2) : await render(spec, base);
    if (output) writeFileSync(output, text);
    else process.stdout.write(text + "\n");
  }
} catch (error) {
  console.error(`tracegram: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
