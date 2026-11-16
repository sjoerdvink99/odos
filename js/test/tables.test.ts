import { describe, expect, it } from "vitest";
import cases from "../../grammar/tables.json";
import { LEVELS, LOOPS, abstract, print, tables, trace, type Tables, type TracedRun } from "../src";
import { abstraction } from "../src/data/tables";
import { expression, random } from "./generate";

const ROLLUPS = [
  ["full", "names"],
  ["names", "actors"],
  ["full", "full_loops"],
  ["names", "names_loops"],
  ["actors", "actors_loops"],
] as const;

function generated(seed: number): TracedRun[] {
  const next = random(seed);
  return Array.from({ length: 40 }, (_, index): TracedRun => ({ id: `r${index}`, process: print(expression(next, 3, true)), time: [] }));
}

const corpus = (seed: number): Tables => tables(generated(seed));

const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);

describe("tables", () => {
  it.each(cases)("$name", ({ runs, tables: expected }) => {
    expect(tables(runs as TracedRun[])).toEqual(expected);
  });

  it.each(SEEDS)("gives every run of corpus %i the variant its abstraction prints at every level", (seed) => {
    const traced = generated(seed);
    const { runs, variants } = tables(traced);
    for (const level of LEVELS) {
      for (const loops of LOOPS) {
        const key = abstraction(level, loops);
        runs.forEach((row, index) => expect(variants[row[key]].label).toBe(print(abstract(trace(traced[index].process), level, loops))));
      }
    }
  });

  it.each(SEEDS)("rolls the variants of corpus %i up from finer to coarser abstractions", (seed) => {
    const { runs } = corpus(seed);
    for (const [finer, coarser] of ROLLUPS) {
      const image = new Map<number, Set<number>>();
      for (const row of runs) image.set(row[finer], (image.get(row[finer]) ?? new Set<number>()).add(row[coarser]));
      expect([...image.values()].every((found) => found.size === 1)).toBe(true);
    }
  });

  it.each(SEEDS)("pairs every step of corpus %i, once each way when nothing runs in parallel", (seed) => {
    const { runs, variants, steps, pairs } = corpus(seed);
    const sequential = new Set(runs.map((row) => row.full).filter((variant) => !print(trace(variants[variant].label)).includes("||")));
    for (const { variant, index } of steps) {
      const own = pairs.filter((pair) => pair.variant === variant);
      const [entering, leaving] = [own.filter((pair) => pair.to === index).length, own.filter((pair) => pair.from === index).length];
      expect(Math.min(entering, leaving)).toBeGreaterThan(0);
      if (sequential.has(variant)) expect([entering, leaving]).toEqual([1, 1]);
    }
  });
});
