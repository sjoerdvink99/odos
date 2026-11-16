import { append } from "../collections";
import { abstract, fold, LEVELS, LOOPS, project, type Level, type Loops } from "../grammar/abstract";
import { children, type Actor, type Node } from "../grammar/ast";
import { print, signature } from "../grammar/print";
import { trace } from "../grammar/trace";
import type { TracedRun } from "../standards/runs";

export { ANY } from "../grammar/ast";

export type Abstraction = Level | `${Level}_loops`;

export const abstraction = (level: Level, loops: Loops): Abstraction => (loops === "fold" ? `${level}_loops` : level);

export const ABSTRACTIONS: Abstraction[] = LOOPS.flatMap((loops) => LEVELS.map((level) => abstraction(level, loops)));

export type RunRow = { run: number; id: string; group: string | null } & Record<Abstraction, number>;
export type VariantRow = { variant: number; label: string; length: number };
export type TokenRow = { variant: number; index: number; token: string; actors: Actor[]; failed: boolean };
export type StepRow = {
  variant: number;
  index: number;
  depth: number;
  parent: number;
  actor: Actor;
  name: string | null;
  signature: string | null;
  failed: boolean;
};
export type PairRow = { variant: number; from: number; to: number };
export type TimeRow = { run: number; index: number; start: number; end: number };

export type Tables = { runs: RunRow[]; variants: VariantRow[]; tokens: TokenRow[]; steps: StepRow[]; pairs: PairRow[]; times: TimeRow[] };

export const OUTSIDE = -1;

export function sequence(node: Node, level: Level, loops: Loops = "count"): Node[] {
  const shaped = loops === "fold" ? abstract(node, level, loops) : project(node, level);
  const items = shaped.t === "seq" ? shaped.items : [shaped];
  return loops === "fold" ? items : items.map(fold);
}

const actorsOf = (node: Node): Actor[] => (node.t === "step" ? [node.actor] : [...new Set(children(node).flatMap(actorsOf))]);

const failed = (node: Node): boolean => (node.t === "step" && node.failed) || children(node).some(failed);

function walked(node: Node, variant: number): Omit<StepRow, "index">[] {
  const found: Omit<StepRow, "index">[] = [];
  const visit = (current: Node, depth: number, parent: number) => {
    if (current.t === "step") {
      found.push({
        variant,
        depth,
        parent,
        actor: current.actor,
        name: current.name,
        signature: current.sig && signature(current.sig),
        failed: current.failed,
      });
      if (current.body) visit(current.body, depth + 1, found.length - 1);
    } else children(current).forEach((child) => visit(child, depth, parent));
  };
  visit(node, 0, -1);
  return found;
}

type Ends = { first: number[]; last: number[] };

const NONE: Ends = { first: [], last: [] };

function pairs(node: Node): [number, number][] {
  const found: [number, number][] = [];
  const link = (from: number[], to: number[]) => from.forEach((a) => to.forEach((b) => found.push([a, b])));
  let next = 0;
  const visit = (current: Node): Ends => {
    switch (current.t) {
      case "step": {
        const at = next++;
        const body = current.body ? visit(current.body) : NONE;
        link([at], body.first);
        return { first: [at], last: body.last.length ? body.last : [at] };
      }
      case "seq":
        return current.items.map(visit).reduce((before, after) => {
          if (!before.first.length) return after;
          if (!after.first.length) return before;
          link(before.last, after.first);
          return { first: before.first, last: after.last };
        }, NONE);
      case "par": {
        const branches = current.items.map(visit);
        return { first: branches.flatMap((ends) => ends.first), last: branches.flatMap((ends) => ends.last) };
      }
      default:
        return NONE;
    }
  };
  const ends = visit(node);
  link([OUTSIDE], ends.first);
  link(ends.last, [OUTSIDE]);
  return found;
}

export function tables(traced: readonly TracedRun[]): Tables {
  const nodes = traced.map((run) => trace(run.process));
  const known = new Map<string, number>();
  const result: Tables = { runs: [], variants: [], tokens: [], steps: [], pairs: [], times: [] };
  const assigned = LOOPS.flatMap((loops) =>
    LEVELS.map((level) => {
      const key = abstraction(level, loops);
      return nodes.map((node) => {
        const items = sequence(node, level, loops);
        const identity = items.map((item) => print(item)).join("\u0001");
        const found = known.get(identity);
        if (found !== undefined) return found;
        const variant = result.variants.length;
        known.set(identity, variant);
        result.variants.push({ variant, label: print(abstract(node, level, loops)), length: items.length });
        items.forEach((item, index) => result.tokens.push({ variant, index, token: print(item), actors: actorsOf(item), failed: failed(item) }));
        if (key === "full") {
          walked(node, variant).forEach((row, index) => result.steps.push({ ...row, index }));
          pairs(node).forEach(([from, to]) => result.pairs.push({ variant, from, to }));
        }
        return variant;
      });
    }),
  );
  traced.forEach((run, index) => {
    const columns = Object.fromEntries(ABSTRACTIONS.map((key, at) => [key, assigned[at][index]])) as Record<Abstraction, number>;
    result.runs.push({ run: index, id: run.id, group: run.group ?? null, ...columns });
    run.time.forEach((interval, position) => {
      if (interval) result.times.push({ run: index, index: position, start: interval[0], end: interval[1] });
    });
  });
  return result;
}

export const variantsAt = ({ runs }: Pick<Tables, "runs">, key: Abstraction): number[] => [...new Set(runs.map((row) => row[key]))].sort((a, b) => a - b);

export function byVariant<T extends { variant: number }>(rows: readonly T[]): Map<number, T[]> {
  const found = new Map<number, T[]>();
  for (const row of rows) append(found, row.variant, row);
  return found;
}

export const labelOf = (step: StepRow) => `${step.actor}${step.name ? `.${step.name}` : ""}${step.signature ?? ""}${step.failed ? "!" : ""}`;

export function clockOf(times: readonly TimeRow[]): Map<number, Map<number, { start: number; end: number }>> {
  const found = new Map<number, Map<number, { start: number; end: number }>>();
  const origin = new Map<number, number>();
  for (const { run, start } of times) origin.set(run, Math.min(origin.get(run) ?? Infinity, start));
  for (const { run, index, start, end } of times) {
    const at = found.get(run) ?? new Map();
    const zero = origin.get(run) ?? 0;
    at.set(index, { start: start - zero, end: end - zero });
    found.set(run, at);
  }
  return found;
}
