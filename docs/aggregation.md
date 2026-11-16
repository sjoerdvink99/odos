# Aggregation

A corpus view turns many runs into one figure in four steps. Each step is defined over the runs' traces, so every number in a figure has one meaning, whichever view shows it.

| Step | Set by | Turns |
|---|---|---|
| [Abstract](#abstract) | `transform`, `trace.name`, `level`, `loops` | each trace into a coarser trace |
| [Read](#read) | the mark | each abstracted trace into the items the view counts |
| [Count](#count) | the mark, `count` | the items of every run into numbers per item, per group |
| [Rank and fold](#rank-and-fold) | `limit` | the items into those shown and one remainder |

Abstracting and reading need the grammar, so tracegram does them once per distinct trace. Counting, ranking and folding are Vega transforms over the [tables](tables.md), so a selection or a new level recounts the figure without compiling it again.

## Abstract

Four operations make a trace coarser. Each is a function of the trace, so runs with equal traces stay equal.

| Operation | Property | Example |
|---|---|---|
| drop steps | `transform` on the records | leave out navigation commands |
| rename steps | `trace.name` with a `map` | `open`, `goto` and `scroll` become `look` |
| keep less of each step | `level`: `full`, `names` or `actors` | `tool.read(q => r)` becomes `tool.read`, then `tool` |
| keep less of each loop | `loops`: `count` or `fold` | `(model -> tool){3}` becomes `(model -> tool)+` |

Two runs are the same **variant** when their abstracted traces are equal. Equal at `full` means equal at `names`, which means equal at `actors`, and equal with `loops: "count"` means equal with `"fold"`. A coarser variant therefore counts exactly the runs of the finer variants it merges.

With `loops: "fold"`, a loop is marked failed only when every pass failed, so a run always conforms to its own abstraction: `conforms(trace, abstract(trace, level, loops))` holds for every run, level and loops.

How far a corpus collapses depends on its runs. The 400 SWE-agent runs of the [gallery](gallery.md#real-runs) are 54 steps long on average, and almost every one is distinct until loops are folded at `actors`:

| Variants of 400 runs | `names` | `names`, `fold` | `actors` | `actors`, `fold` |
|---|---|---|---|---|
| as logged | 382 | 374 | 327 | 2 |
| tools renamed into five categories | 378 | 357 | 327 | 2 |
| and model steps dropped | 378 | 349 | 327 | 2 |

Long runs rarely repeat as a whole, but they share how they start, which steps follow which, and which steps they use. The views that read those parts aggregate such a corpus where `variants` cannot. Here the tools are renamed into categories and loops are folded, and the Sankey shows how resolved and unresolved runs open:

```tracegram
{ "mark": "sankey", "level": "names", "loops": "fold", "limit": 5, "height": 260,
  "data": { "url": "../assets/swe-agent.jsonl" },
  "trace": { "run": "run", "actor": "actor", "failed": "failed", "group": { "field": "outcome", "order": ["resolved", "unresolved"] },
             "name": { "field": "tool", "map": { "open": "look", "goto": "look", "scroll_up": "look", "scroll_down": "look", "cat": "look", "ls": "look",
                                                 "search_dir": "search", "search_file": "search", "find_file": "search", "find": "search", "grep": "search",
                                                 "create": "edit", "rm": "edit", "python": "test", "bash": "test" } } } }
```

## Read

A view reads one of three parts of each abstracted trace. Take a run in which a model calls two tools in parallel and then delegates to a worker:

```text
model -> (tool.read || tool.grep) -> agent.worker{ model -> tool.edit } -> model
```

| Reading | Items of this run | Marks |
|---|---|---|
| **path** | `model`, `tool.grep ∥ tool.read`, `agent.worker{ model -> tool.edit }`, `model` | `variants`, `icicle`, `sankey`, `sequences`, `projection` |
| **steps** | `model`, `tool.grep`, `tool.read`, `agent.worker`, `model`, `tool.edit`, `model` | `activities`, `durations`, `distribution` |
| **pairs** | `start → model`, `model → tool.grep`, `model → tool.read`, `tool.grep → agent.worker`, `tool.read → agent.worker`, `agent.worker → model`, `model → tool.edit`, `tool.edit → model`, `model → end` | `transitions`, `graph` |

The **path** is the trace's top-level sequence: a parallel block or a delegated context is one item. **Steps** are every step at every depth. **Pairs** are the steps that directly follow each other in the run's order: a step comes before its body, the last steps of a body before what follows the step, and two branches that ran in parallel are never a pair. This is the directly-follows relation of process mining, without the pairs between parallel branches that a flat event log would invent.

## Count

Every count has one of four units:

| Unit | Counts | Tooltip field |
|---|---|---|
| runs | the runs that contain the item | `runs` |
| share | runs as a share of the runs in the group | `share` |
| steps | how often the item occurs, in all runs | `count` |
| per run | steps as a share of the runs in the group | `rate` |

| Mark | Counts per item | Encoded as |
|---|---|---|
| `variants` | runs with the path | bar length, share |
| `icicle` | runs whose path starts with the prefix | cell height, share |
| `sankey` | runs with the item at that position of the path | band width, runs |
| `transitions`, `graph` | the pair, per run (`count: "steps"`), or the runs with it (`count: "runs"`) | colour, stroke |
| `activities` | runs that use the step, and how often per run | bar length, share and per run |
| `durations` | the step's duration in every run | box plot, seconds |
| `distribution` | runs per bin of length, failures or duration | bar height, share |
| `projection` | runs with the path | point area, share |
| `sequences` | one row per run, or per group of similar runs | cells |

With two [groups](data.md#groups), every share is computed within its group, and colour shows the difference of the second group's share minus the first's. With more groups, a [facet](data.md#facets) draws one panel per group.

## Rank and fold

Views with `limit` rank their items by size and fold the rest into one remainder: `+3 more variants`, `other`, `+5`. The remainder keeps its runs: it is counted, has a tooltip and can be selected, so the shown items and the remainder always add up to every run.

## Guarantees

The test suites of both languages check these on generated and real corpora:

- Every run has exactly one variant at every abstraction, and its label is the run's own abstraction.
- Counts roll up: a coarser variant has the runs of the finer variants it merges.
- Every run conforms to its own abstraction, and abstracting twice changes nothing.
- An icicle prefix has exactly the runs of its continuations and of the runs that end there.
- Every step has a pair into it and out of it; in a run without parallel steps, exactly one of each.
- A selection filters runs before anything is counted.
- Shown items and their remainder add up to every run.
- Each mark's counts agree with an independent count over the traces, at every level and loops setting, over all runs and over a selection.

On the [real SWE-agent runs](gallery.md#real-runs), variants and directly-follows counts agree exactly with [pm4py](https://pm4py.fit.fraunhofer.de); on runs with parallel or delegated steps they differ only in the pairs that involve those steps (`examples/benchmarks/agreement.py`).

## Cost

The compiled spec ships one short row per run, and the items of each distinct abstracted trace once. Its size therefore grows with the number of runs and with how many of them are distinct. On generated runs that resemble the SWE-agent runs, almost all distinct and about 54 steps long (`examples/benchmarks/scale.ts`, Node 22, Apple M3 Pro):

| Runs | Compile | Spec | First render | Recount after a selection |
|---|---|---|---|---|
| 1,000 | 0.3–0.4 s | 1–10 MB | 7–280 ms | 2–110 ms |
| 10,000 | 2–4 s | 5–73 MB | 20 ms–2.5 s | 10–660 ms |

The icicle is the most expensive view, since it counts every prefix of every run. Beyond tens of thousands of long, distinct runs, abstract before you aggregate: rename steps, drop the ones you do not need, or split the corpus with a filter or a facet.
