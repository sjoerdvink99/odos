import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import { version } from "../src";

const folder = mkdtempSync(join(tmpdir(), "tracegram-cli-"));
const cli = join(folder, "cli.mjs");

beforeAll(async () => {
  await build({
    entryPoints: [fileURLToPath(new URL("../src/cli.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: cli,
    logLevel: "silent",
  });
  await build({
    entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
    bundle: true,
    format: "iife",
    globalName: "tracegram",
    outfile: join(folder, "tracegram.min.js"),
    logLevel: "silent",
  });
}, 60_000);

type Embedded = { trace?: object; data: { values: { id: string; process: string; group?: string }[] } };

const embedded = (page: string): Embedded => {
  const html = readFileSync(join(folder, page), "utf8");
  const marker = 'getElementById("view"), ';
  return JSON.parse(html.slice(html.lastIndexOf(marker) + marker.length, html.lastIndexOf(");</script>")));
};

const call = (args: string[], input?: string) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8", cwd: folder });

describe("cli", () => {
  it("prints its version and its usage", () => {
    expect(call(["--version"]).stdout.trim()).toBe(version);
    const bare = call([]);
    expect(bare.status).toBe(1);
    expect(bare.stderr).toMatch(/^usage: tracegram/);
    expect(call(["--help"]).status).toBe(0);
  });

  it("writes a linked report of a corpus as one page", () => {
    const records = join(folder, "coding.jsonl");
    const mapping = join(folder, "mapping.json");
    writeFileSync(records, readFileSync(new URL("../../docs/assets/coding.jsonl", import.meta.url)));
    writeFileSync(mapping, JSON.stringify({ run: "session", actor: "type", name: "tool", start: "start", end: "end", failed: "error" }));
    const result = call(["report", records, "--trace", mapping, "-o", "report.html"]);
    expect(result.status).toBe(0);
    const page = readFileSync(join(folder, "report.html"), "utf8");
    expect(page).toContain("tracegram.embed");
    for (const mark of ["variants", "activities", "transitions", "distribution", "timeline"]) expect(page).toContain(`"mark":"${mark}"`);
    expect(page).toContain(`"url": "coding.jsonl"`);
  });

  it("compares two sources, reads a folder as one corpus, and reads Inspect archives", () => {
    mkdirSync(join(folder, "logs"), { recursive: true });
    writeFileSync(join(folder, "before.jsonl"), '{"id":"1","process":"model -> tool -> model"}\n{"id":"2","process":"model"}\n');
    writeFileSync(join(folder, "after.jsonl"), '{"id":"1","process":"model -> tool! -> model"}\n');
    copyFileSync(fileURLToPath(new URL("../../grammar/inspect.eval", import.meta.url)), join(folder, "logs", "task.eval"));
    writeFileSync(join(folder, "logs", "more.jsonl"), '{"id":"s1:1","process":"model"}\n');

    expect(call(["report", "before.jsonl", "after.jsonl", "-o", "compared.html"]).status).toBe(0);
    const compared = embedded("compared.html");
    expect(compared.trace).toEqual({ group: "group" });
    expect(compared.data.values.map((run) => [run.id, run.group])).toEqual([
      ["1", "before"],
      ["2", "before"],
      ["after/1", "after"],
    ]);
    expect(readFileSync(join(folder, "compared.html"), "utf8")).toContain("<title>before.jsonl · after.jsonl</title>");

    expect(call(["report", "logs", "-o", "folder.html"]).status).toBe(0);
    const logs = embedded("folder.html");
    expect(logs.trace).toBeUndefined();
    expect(logs.data.values.map((run) => [run.id, run.process])).toEqual([
      ["s1:1", "model"],
      ["task/s1:1", "human -> model -> tool.search -> agent.researcher{ model -> tool.fetch! } -> model"],
    ]);

    expect(call(["report", "logs/task.eval", "-o", "archive.html"]).status).toBe(0);
    expect(embedded("archive.html").data.values).toHaveLength(1);

    const three = call(["report", "before.jsonl", "after.jsonl", "logs"]);
    expect(three.status).toBe(1);
    expect(three.stderr).toMatch(/^tracegram: report compares two sources/);
  });

  it("links a report to how to cite it", () => {
    expect(readFileSync(join(folder, "report.html"), "utf8")).toMatch(
      /Made with <a href="https:\/\/sjoerdvink99\.github\.io\/tracegram\/">tracegram<\/a> [\d.]+ · <a href="[^"]+#cite">cite<\/a>/,
    );
  });

  it("draws an expression as a diagram", () => {
    const result = call(["model -> tool"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^<svg/);
  });

  it("reads a spec from a file or standard input, and writes a file or a Vega spec", () => {
    writeFileSync(join(folder, "runs.jsonl"), '{"process":"model -> tool"}\n{"process":"model"}\n');
    writeFileSync(join(folder, "view.json"), JSON.stringify({ mark: "variants", data: { url: "runs.jsonl" } }));
    expect(call(["view.json", "-o", "figure.svg"]).status).toBe(0);
    expect(readFileSync(join(folder, "figure.svg"), "utf8")).toMatch(/^<svg/);
    const vega = JSON.parse(call(["view.json", "--vega"]).stdout);
    expect(vega.$schema).toMatch(/vega\/v6/);
    expect(call(["-"], JSON.stringify({ mark: "diagram", process: "human -> model" })).stdout).toMatch(/^<svg/);
  });

  it("reports what is wrong and fails", () => {
    const result = call(["-"], JSON.stringify({ mark: "variants", level: "everything", data: { values: [] } }));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^tracegram: .*level/);
    expect(call(["model ->"]).stderr).toMatch(/^tracegram: spec\.process: not a valid expression: expected name/);
  });
});
