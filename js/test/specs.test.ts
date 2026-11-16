import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import cases from "../../grammar/specs.json";
import { SpecError, render, report, validate, type VConcatSpec } from "../src";
import { records } from "../src/standards/records";

const parser = new new JSDOM().window.DOMParser();

describe("view spec contract", () => {
  it.each(cases.valid.map((spec, index) => [index, spec] as const))("accepts valid spec %i and renders it as finite, well-formed SVG", async (_, spec) => {
    expect(() => validate(spec)).not.toThrow();
    const svg = await render(spec as never);
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    expect(parser.parseFromString(svg, "image/svg+xml").getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it.each(cases.invalid.map((each) => [each.path, each] as const))("rejects at %s", (path, each) => {
    expect(() => validate(each.spec)).toThrow(SpecError);
    try {
      validate(each.spec);
    } catch (error) {
      expect((error as SpecError).path).toBe(path);
    }
  });

  it("treats undefined properties as absent", () => {
    expect(() => validate({ mark: "transitions", data: { values: ["model"] }, highlight: undefined })).not.toThrow();
  });

  it("returns a copy the caller cannot mutate", () => {
    const spec = { mark: "variants" as const, data: { values: ["model"] } };
    const checked = validate(spec);
    spec.data.values.push("tool");
    expect(checked).toEqual({ mark: "variants", data: { values: ["model"] } });
  });
});

describe("report", () => {
  const coding = readFileSync(new URL("../../docs/assets/coding.jsonl", import.meta.url), "utf8");
  const trace = { run: "session", actor: "type", name: "tool", start: "start", end: "end", failed: "error" };
  const marks = (spec: VConcatSpec) => spec.vconcat.map((view) => ("mark" in view ? view.mark : null));

  it("links the corpus views and adds a timeline when the steps have times", async () => {
    const spec = report({ values: records(coding) }, trace);
    expect(marks(spec)).toEqual(["variants", "activities", "transitions", "distribution", "timeline"]);
    expect(spec.trace).toEqual(trace);
    expect(await render(spec)).toMatch(/^<svg/);
    expect(marks(report({ values: ["model -> tool -> model"] }))).toEqual(["variants", "activities", "transitions", "distribution"]);
  });

  it("compares two groups of runs", async () => {
    const values = [
      { id: "1", process: "model -> tool -> model", group: "before" },
      { id: "2", process: "model", group: "after" },
    ];
    const spec = report({ values, format: "runs" }, { group: "group" });
    expect(spec).toMatchObject({ data: { format: "runs" }, trace: { group: "group" } });
    expect(await render(spec)).toContain("before");
  });
});
