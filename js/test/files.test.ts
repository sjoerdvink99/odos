import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import cases from "../../grammar/standards.json";
import { isFolder, label, records, runs, unique } from "../src/files";

const ARCHIVE = fileURLToPath(new URL("../../grammar/inspect.eval", import.meta.url));
const lines = (path: string, items: object[]) => writeFileSync(path, items.map((item) => JSON.stringify(item)).join("\n"));

let messages = 0;

const claude = (type: "user" | "assistant", content: unknown, extra: object = {}) => ({
  type,
  sessionId: "s",
  uuid: String((messages += 1)),
  timestamp: "2026-11-25T10:00:00Z",
  message: { role: type, content },
  isSidechain: false,
  ...extra,
});

describe("files", () => {
  it("reads the samples of an Inspect archive as Python does", () => {
    const inspect = cases.find((each) => each.reader === "inspect");
    expect(runs(ARCHIVE).map((run) => [run.id, run.process])).toEqual([["s1:1", inspect?.expected]]);
    expect(records(ARCHIVE)).toHaveLength(1);
  });

  it("reads a Claude Code session with the sub-agent sessions beside it", () => {
    const folder = mkdtempSync(join(tmpdir(), "tracegram-files-"));
    const task = { type: "tool_use", id: "t1", name: "Task", input: { subagent_type: "Explore" } };
    lines(join(folder, "s.jsonl"), [
      claude("user", "Look around."),
      claude("assistant", [task]),
      claude("user", [{ type: "tool_result", tool_use_id: "t1" }], { toolUseResult: { agentId: "a1" } }),
    ]);
    mkdirSync(join(folder, "s", "subagents"), { recursive: true });
    const side = { isSidechain: true, agentId: "a1" };
    lines(join(folder, "s", "subagents", "agent-a1.jsonl"), [
      claude("user", "Look around.", side),
      claude("assistant", [{ type: "tool_use", id: "g", name: "Glob", input: {} }], side),
      claude("user", [{ type: "tool_result", tool_use_id: "g" }], side),
    ]);
    const [run] = runs(join(folder, "s.jsonl"));
    expect(run.process).toBe("human -> model -> agent.Explore{ model -> tool.Glob }");
    expect(runs(folder).map((each) => each.process)).toEqual([run.process]);
  });

  it("reads a folder as one corpus and keeps the ids of its files apart", () => {
    const folder = mkdtempSync(join(tmpdir(), "tracegram-files-"));
    mkdirSync(join(folder, "nested"));
    writeFileSync(join(folder, "a.jsonl"), '{"id":"1","process":"model -> tool"}');
    writeFileSync(join(folder, "nested", "b.json"), '{"id":"1","process":"model"}');
    writeFileSync(join(folder, "notes.txt"), '{"id":"2","process":"tool"}');
    expect(isFolder(folder) && !isFolder(join(folder, "a.jsonl"))).toBe(true);
    expect(runs(folder).map((run) => [run.id, run.process])).toEqual([
      ["1", "model -> tool"],
      ["b/1", "model"],
    ]);
  });

  it("names a source after its file or folder", () => {
    expect([label("runs/before.jsonl"), label("logs/"), label("trace.eval")]).toEqual(["before", "logs", "trace"]);
    const earlier = [{ id: "1", process: "model", time: [null] }];
    expect(unique(earlier, [...earlier, { id: "2", process: "tool", time: [null] }], "b").map((run) => run.id)).toEqual(["b/1", "2"]);
  });
});
