import type { Data, Legend, Scale, Signal, Transforms } from "vega";
import { mix } from "../config";
import { orders, type Activity } from "../data/pairs";
import { OUTSIDE } from "../data/tables";
import type { GraphSpec, TransitionsSpec } from "../spec";
import { base, counted, gradient, joined, perLevel, scopeOf, stepsAt, table, tally, weigh, type Scope } from "./corpus";
import { each, first, fixed, literal, percent, signed } from "./expr";
import type { Fields } from "./tooltip";
import type { Unit } from "./unit";

type Follows = {
  scope: Scope;
  data: Data[];
  signals: Signal[];
  activities: Activity[];
  fields: Fields;
  measures: string[];
  byLevel: (pick: (activities: Activity[]) => number) => string;
  color: (name: string, single: [string, string]) => Scale;
  legend: (channel: "fill" | "stroke", scale: string, note?: string) => Legend;
};

export function follows(unit: Unit<TransitionsSpec | GraphSpec>, limit: number): Follows {
  const corpus = scopeOf(unit);
  const { name, config } = unit;
  const { groups: count } = corpus;
  const compare = count > 1;
  const byRuns = unit.spec.count === "runs";
  const weights = new Map([...counted(corpus, "full")].map(([variant, sizes]) => [variant, sizes.reduce((sum, size) => sum + size, 0)]));
  const activities = orders(corpus.corpus.tables.steps, weights, limit);
  const [labelled, paired] = [name("labelled"), name("paired")];
  const runs = base(corpus);
  const peak = name("peak");
  const measure = (group: number) => (byRuns ? `datum.s${group}` : `datum.times_rate${group}`);
  const value = compare ? `${measure(1)} - ${measure(0)}` : measure(0);
  const [d0, d1, d2] = config.diverging;
  const keyed = (field: string, as: string): Transforms => ({ type: "formula", as, expr: `datum.variant + ':' + datum.${field}` });
  const outside = String(OUTSIDE);
  return {
    scope: corpus,
    activities,
    data: [
      ...runs.data,
      table(name("activities"), activities, [{ type: "filter", expr: `datum.level === ${corpus.level}` }]),
      stepsAt(corpus, "labelled", [
        { type: "formula", as: "label", expr: "datum.activity + (datum.failed ? '!' : '')" },
        { type: "lookup", from: name("activities"), key: "name", fields: ["label"], values: ["kind"] },
        { type: "formula", as: "mapped", expr: "isValid(datum.kind) ? datum.label : 'other'" },
        keyed("index", "key"),
      ]),
      {
        name: paired,
        source: corpus.table("pairs"),
        transform: [
          { type: "project", fields: ["variant", "from", "to"], as: ["variant", "before", "after"] },
          keyed("before", "head"),
          keyed("after", "tail"),
          { type: "lookup", from: labelled, key: "key", fields: ["head", "tail"], values: ["mapped"], as: ["source", "target"] },
          { type: "formula", as: "from", expr: `datum.before === ${outside} ? 'start' : datum.source` },
          { type: "formula", as: "to", expr: `datum.after === ${outside} ? 'end' : datum.target` },
          { type: "aggregate", groupby: ["variant", "from", "to"], ops: ["count"], as: ["times"] },
        ],
      },
      ...joined(corpus, "followed", paired, ["from", "to", "times"], { by: "full", then: weigh(corpus, ["times"]) }),
      {
        name: name("follows"),
        source: name("followed"),
        transform: [...tally(corpus, ["from", "to"], ["times"]), { type: "formula", as: "value", expr: value }],
      },
      {
        name: peak,
        source: name("follows"),
        transform: [
          { type: "formula", as: "magnitude", expr: "abs(datum.value)" },
          { type: "aggregate", fields: ["magnitude"], ops: ["max"], as: ["peak"] },
        ],
      },
    ],
    signals: [...runs.signals, { name: peak, update: `max(1e-9, ${first(peak, { peak: 0 })}.peak)` }],
    measures: Array.from({ length: count }, (_, group) => [`n${group}`, `s${group}`, `times${group}`, `times_rate${group}`]).flat(),
    byLevel: (pick) => perLevel(corpus, (level) => pick(activities.filter((activity) => activity.level === level))),
    fields: {
      runs: each(count, (group) => `datum.n${group}`),
      share: each(count, (group) => percent(`datum.s${group}`)),
      rate: each(count, (group) => fixed(`datum.times_rate${group}`, 2)),
      count: each(count, (group) => `datum.times${group}`),
      ...(compare ? { difference: byRuns ? signed("datum.value * 100", 1, "pts") : signed("datum.value", 2, "per run") } : {}),
    },
    color: (scale, single) =>
      compare
        ? {
            name: scale,
            type: "pow",
            exponent: 0.6,
            domain: { signal: `[-${peak}, 0, ${peak}]` },
            range: [mix(d1, d0, 0.85), d1, mix(d1, d2, 0.85)],
            clamp: true,
          }
        : { name: scale, type: "pow", exponent: 0.6, domain: { signal: `[0, ${peak}]` }, range: single, clamp: true },
    legend: (channel, scale, note) => {
      const title = byRuns ? "share of runs" : "times per run";
      return gradient(corpus, channel, scale, peak, note ? `${title} · ${note}` : title);
    },
  };
}

export const labelColor = (unit: Unit, field: string) =>
  `test(/!$/, ${field}) ? ${literal(unit.config.fail)} : indexof(['start', 'end', 'other'], ${field}) >= 0 ? ${literal(unit.config.faint)} : ${literal(unit.config.ink)}`;
