import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, validate } from "../src";

const ROOT = join(__dirname, "../../docs");
const SKILL = readFileSync(join(__dirname, "../../skills/tracegram/SKILL.md"), "utf8");
const pages = readdirSync(ROOT, { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith(".md"));
const blocks = pages.flatMap((page) =>
  [...readFileSync(join(ROOT, page), "utf8").matchAll(/```tracegram\n([\s\S]*?)```/g)].map(
    (match, index) => [`${page} #${index + 1}`, match[1], served(page)] as const,
  ),
);

function served(page: string): string {
  return `${join(ROOT, page.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, ""))}/`;
}

describe("documentation", () => {
  it("has views", () => {
    expect(blocks.length).toBeGreaterThan(10);
  });

  it.each(blocks)("renders %s", async (_, source, base) => {
    expect(await render(JSON.parse(source), base)).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe("agent skill", () => {
  const specs = [...SKILL.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]));

  it("names itself and says when to use it", () => {
    expect(SKILL).toMatch(/^---\nname: tracegram\ndescription: .{100,}\n---\n/);
  });

  it.each(specs.map((spec, index) => [index + 1, spec] as const))("writes valid spec %i", (_, spec) => {
    expect(() => validate(spec)).not.toThrow();
  });
});
