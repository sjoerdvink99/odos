# Views

A view spec is a JSON object with one `mark`, your records in `data` and a `trace` mapping. `compile` maps the records to traces and turns the view into a [Vega](https://vega.github.io/vega/) spec, so the figure is a pure function of the spec: the same spec gives the same figure everywhere. Add `"$schema": "https://cdn.jsdelivr.net/npm/tracegram/dist/view.schema.json"` for completion in your editor.

| Mark | Data | Shows |
|---|---|---|
| [`diagram`](#diagram) | `process` | a design, written as an expression, as a railroad diagram |
| [`timeline`](#timeline) | `data` with times | when each step of one run ran |
| [`handoffs`](#handoffs) | `data` | how control passes between agents and people, as a sequence diagram |
| [`icicle`](#icicle) | `data` | runs merged by shared prefix |
| [`variants`](#variants) | `data` | each distinct run, ranked by frequency |
| [`transitions`](#transitions) | `data` | how often each step follows another, as a matrix |
| [`graph`](#graph) | `data` | the same as a process graph |
| [`sankey`](#sankey) | `data` | how runs flow through their first steps |
| [`activities`](#activities) | `data` | how often each step occurs and fails |
| [`sequences`](#sequences) | `data` | every run as a row of steps |
| [`distribution`](#distribution) | `data` | how runs spread over their length, failures or duration |
| [`durations`](#durations) | `data` with times | how long each step takes |
| [`projection`](#projection) | `data` | variants placed so that similar runs lie close |
| [`vconcat`, `hconcat`](#composition) | views | views stacked or side by side, with one legend |
| [`facet`](data.md#facets) | `data` | one panel per value of a field |

`data` holds your records, `transform` filters them and `trace` maps them to runs: see [Data](data.md). Every view but `diagram` takes all three. The examples on this page read [`coding.jsonl`](assets/coding.jsonl), the event log of a coding agent, and [`crew.jsonl`](assets/crew.jsonl), the spans of two multi-agent runs; the [Gallery](gallery.md#the-data) shows both.

Every view also takes:

| Property | Default | |
|---|---|---|
| `title` | none | a heading |
| `width` | `800` | pixels, or `"container"` to fill the element |
| `legend` | `true` | show the actor legend |
| `config` | | colours, font and sizes, see [Config](#config) |
| `tooltip` | `true` | the fields its tooltips show, see [Tooltips](#tooltips) |
| `highlight` | none | an expression, or a selection `{ "param": name }`: what it matches is emphasised and the rest is dimmed |
| `params` | none | the selections the view makes, see [Selections](interaction.md#selections) |

## diagram

A diagram draws a design, not data: what may happen in any run, written in the [grammar](grammar.md).

```tracegram
{ "mark": "diagram", "process": "model.plan(=> task:text[]) -> agent.worker{ (model -> tool[])* -> model }[] -> model.synthesize" }
```

| Property | Default | |
|---|---|---|
| `process` | required | an expression |
| `fold` | `true` | fold repeats in a trace: `x -> x -> x` becomes `x{3}` |
| `key` | `true` | explain the constructs used, under the diagram |

## timeline

```tracegram
{ "mark": "timeline",
  "transform": [{ "filter": { "field": "session", "equal": "s07" } }],
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

| Property | | |
|---|---|---|
| `data` | required | the records, with times; the view draws one run |
| `filter` | none | a selection of runs `{ "param": name }`: draw the first selected run, and the first run while nothing is selected |
| `lanes` | `"step"` | one row per step, or `"agent"`: one lane per agent context |

```tracegram
{ "mark": "timeline", "lanes": "agent",
  "transform": [{ "filter": { "field": "trace", "equal": "t1" } }],
  "data": { "url": "../assets/crew.jsonl" },
  "trace": { "run": "trace", "step": "id", "parent": "parent", "actor": "kind", "name": "name", "start": "start", "end": "end", "failed": "error" } }
```

Many runs, one timeline: a corpus view selects runs, and the timeline draws the selected one. Its rows, height and time axis follow the selection inside the Vega dataflow. Click a row:

```tracegram
{ "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" },
  "vconcat": [
    { "mark": "sequences", "params": [{ "name": "picked", "select": "click", "value": ["s09"] }], "highlight": { "param": "picked" } },
    { "mark": "timeline", "filter": { "param": "picked" } }
  ] }
```

## handoffs

```tracegram
{ "mark": "handoffs",
  "transform": [{ "filter": { "field": "trace", "equal": "t2" } }],
  "data": { "url": "../assets/crew.jsonl" },
  "trace": { "run": "trace", "step": "id", "parent": "parent", "actor": "kind", "name": "name", "start": "start", "end": "end", "failed": "error" } }
```

One lifeline for the run and one for each agent and person. An arrow hands control to an agent or asks a person, a dashed arrow returns it, and the model, tool and code steps sit on the lifeline of the agent that runs them.

| Property | | |
|---|---|---|
| `data` | required | the records; the view draws one run, and its times, if any, show in the tooltips |
| `filter` | none | a selection of runs: draw the first selected run, as for `timeline` |

## Corpus views

`icicle`, `variants`, `transitions`, `graph`, `sankey`, `activities`, `sequences`, `distribution`, `durations` and `projection` aggregate every run of their `data`, as defined in [Aggregation](aggregation.md). With a `group` in `trace`, they show the difference between two groups.

| Property | Marks | |
|---|---|---|
| `filter` | all | a selection `{ "param": name }`: show only the selected runs, or all of them while nothing is selected |
| `level` | all but `sequences` and `distribution` | `full`, `names` or `actors`: how much of each step is kept; `actors` for `icicle`, `variants` and `sankey`, `names` for the rest |
| `loops` | `icicle`, `variants`, `sankey`, `projection` | `count` (the default) or `fold`: whether a loop keeps how often it ran |
| `count` | `transitions`, `graph` | `steps` (the default): how often a pair occurs per run; `runs`: the share of runs with it |

A view with `level` or `loops` shows a switch for each, and the figure recounts when you change it.

## icicle

```tracegram
{ "mark": "icicle", "level": "names", "height": 220, "highlight": "tool! -> model",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

A `highlight` fills each cell with the share of its runs that match.

| Property | Default | |
|---|---|---|
| `focus` | `[]` | the path of steps to zoom into |
| `height` | `380` | pixels |

## variants

```tracegram
{ "mark": "variants", "level": "names",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error", "group": "version" } }
```

An expression `highlight` brings matching variants to the top.

| Property | Default | |
|---|---|---|
| `limit` | `12` | how many variants to show |

## transitions

```tracegram
{ "mark": "transitions",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

| Property | Default | |
|---|---|---|
| `limit` | `16` | how many steps to show; the rest become `other` |

## graph

```tracegram
{ "mark": "graph",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

Steps are ordered by where they usually occur. Hand-offs to the next step are straight, longer jumps forward arc above, and returns arc below; thickness is how often per run.

| Property | Default | |
|---|---|---|
| `limit` | `16` | how many steps to show; the rest become `other` |

## sankey

```tracegram
{ "mark": "sankey", "level": "names", "height": 220,
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

Column `k` holds the `k`-th item of every run's path, so with `"loops": "fold"` a loop is one item however often it ran. A column keeps the items that fit its height and folds the rest into `other`.

| Property | Default | |
|---|---|---|
| `limit` | `8` | how many steps to follow |
| `height` | `300` | pixels |

## activities

```tracegram
{ "mark": "activities",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

The share of runs that use each step, how often per run, and in red the share where it failed.

| Property | Default | |
|---|---|---|
| `limit` | `16` | how many steps to show |

## sequences

```tracegram
{ "mark": "sequences", "highlight": "tool! -> model -> tool",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

One row per run and one cell per step, coloured by actor; failed steps are red. With an expression `highlight`, only the steps of each match keep their colour.

When there are more runs than `limit`, the view becomes a relative frequency sequence plot (Fasang and Liao, 2014). The runs are sorted, so similar runs sit together, and cut into `limit` groups of equal size. Each row stands for one group and draws its most common run. Its tooltip counts the group, and selecting it selects every run in it. With two groups of runs, each gets half the rows.

```tracegram
{ "mark": "sequences", "limit": 4,
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

| Property | Default | |
|---|---|---|
| `x` | `"step"` | position steps by their order, or by `"time"`; with `"time"` every run needs times |
| `limit` | `50` | how many rows to draw |

## distribution

```tracegram
{ "mark": "distribution",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error", "group": "version" } }
```

The share of runs per bin of a run measure. Binning happens in Vega, so a `filter` re-bins the selected runs.

| Property | Default | |
|---|---|---|
| `measure` | `"steps"` | `"steps"`, `"failures"` (failed steps) or `"duration"`; `"duration"` needs times |

## durations

```tracegram
{ "mark": "durations",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

A box plot of step durations per activity, longest median first: where the time of a run goes. Every run needs times.

| Property | Default | |
|---|---|---|
| `level` | `"names"` | how steps are grouped, as in [Levels](grammar.md#levels) |
| `limit` | `16` | how many steps to show |

## projection

```tracegram
{ "mark": "projection",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

Each variant is a point, sized by its share of runs and outlined red when it fails. A variant's features are the items of its path and the pairs of consecutive items, counted, square-rooted and scaled to unit length; positions are their first two principal components. Runs that do similar things in a similar order lie close. With two groups, colour shows which group a variant is more common in.

| Property | Default | |
|---|---|---|
| `level` | `"names"` | how steps are compared, as in [Levels](grammar.md#levels) |
| `height` | `300` | pixels |

## Composition

`vconcat` stacks views and `hconcat` places them side by side. They share one legend, and the `data`, `transform` and `trace` set on the composition. Views link through [selections](interaction.md#selections): here hovering a step in either view highlights it in both.

```tracegram
{ "data": { "url": "../assets/crew.jsonl" },
  "trace": { "run": "trace", "step": "id", "parent": "parent", "actor": "kind", "name": "name", "start": "start", "end": "end", "failed": "error" },
  "transform": [{ "filter": { "field": "trace", "equal": "t2" } }],
  "vconcat": [
    { "mark": "timeline", "params": [{ "name": "step", "select": "hover" }], "highlight": { "param": "step" } },
    { "mark": "handoffs", "params": [{ "name": "step", "select": "hover" }], "highlight": { "param": "step" } }
  ] }
```

```tracegram
{ "hconcat": [
  { "mark": "diagram", "process": "(model -> tool[])* -> model", "title": "design" },
  { "mark": "sequences", "title": "runs",
    "data": { "url": "../assets/coding.jsonl" },
    "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
] }
```

Each view may set its own `title`, `width`, `legend` and `config`; its `config` extends the top-level one. `data`, `transform` and `trace` set on the composition hold for every view that does not set its own, as in [Composition](data.md#composition). To draw one view per value of a field, use a [`facet`](data.md#facets). Compositions do not nest.

## Tooltips

Each item of a view has a tooltip: a title, such as the step, variant or pair, and named fields. `tooltip` chooses the fields:

| Value | Shows |
|---|---|
| `true` | every field the item has (the default) |
| `false` | no tooltip |
| `["share", { "field": "runs", "title": "count" }]` | these fields, in this order, with their own titles |

```tracegram
{ "mark": "variants", "level": "names", "tooltip": ["share", { "field": "runs", "title": "count" }, "matching"], "highlight": "tool.write!",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

With two groups of runs, a field shows one value per group, such as `33% → 50%`. Fields an item lacks are skipped.

| Field | Meaning | Marks |
|---|---|---|
| `runs` | runs through the item | corpus marks |
| `share` | `runs` as a share of the runs in its group | `icicle`, `variants`, `transitions`, `graph`, `sankey`, `activities`, `distribution`, `projection` |
| `difference` | the change from the first group to the second | corpus marks but `sequences` and `durations` |
| `matching` | its runs that `highlight` matches | corpus marks, with a `highlight` |
| `rate`, `count` | occurrences per run of the group, and in all | `transitions`, `graph`; `rate` also `activities` |
| `ending` | runs that end here | `icicle` |
| `steps`, `failed` | steps, and failed steps (`activities`: the share of runs where it failed) | `variants`, `sequences`, `activities`, `projection`; `steps` also `durations` |
| `median`, `spread`, `longest` | the median duration, the middle half, and the longest | `durations` |
| `run`, `step`, `start`, `duration` | the cell of one run | `sequences` |
| `actor`, `count` | the actor, and how often a folded step ran | `diagram` |
| `actor`, `start`, `end`, `duration` | the step's span | `timeline` |
| `actor`, `from`, `start`, `duration` | the step, the lifeline it comes from, and its span | `handoffs` |

## Config

| Property | Default | |
|---|---|---|
| `actors` | `{ "model": "#7b61ff", "tool": "#12a594", "agent": "#e2a336", "human": "#3e8ed0", "code": "#8b95a5" }` | one colour per actor |
| `fail` | `#e5484d` | failed steps, and nothing else |
| `diverging` | `["#b35806", "#f1f2f4", "#2d6a9f"]` | the difference scale: less, same, more |
| `background`, `ink`, `muted`, `faint`, `line`, `panel`, `rail` | | the neutral palette |
| `font` | a monospace stack | |
| `size` | `11` | font size in pixels |
| `advance` | `0.6` | character width relative to `size`, used for layout and to fit labels |

Colours are `#rrggbb`. Sizes are positive and at most 1,000,000.
