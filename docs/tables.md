# Tables

A corpus of traces has one relational form: six tables. Views draw them with Vega, Python analyses them with pandas, and you can join them with anything else you hold about your runs.

| Table | One row per | Columns |
|---|---|---|
| `runs` | run | `run`, `id`, `group`, and its variant at each abstraction |
| `variants` | variant | `variant`, `label`, `length` |
| `tokens` | item of a variant's path | `variant`, `index`, `token`, `actors`, `failed` |
| `steps` | step of a distinct trace | `variant`, `index`, `depth`, `parent`, `actor`, `name`, `signature`, `failed` |
| `pairs` | pair of steps that directly follow each other | `variant`, `from`, `to` |
| `times` | timed step of a run | `run`, `index`, `start`, `end` |

Take two runs:

```text
a   model -> tool.read -> model -> tool.read -> model
b   model -> tool.edit! -> model
```

**`runs`** names each run's variant at every [abstraction](aggregation.md#abstract): the three levels, `full`, `names` and `actors`, each with loops counted and with loops folded (`names_loops`).

| run | id | group | full | names | actors | full_loops | names_loops | actors_loops |
|---|---|---|---|---|---|---|---|---|
| 0 | `a` | | 0 | 0 | 2 | 4 | 4 | 5 |
| 1 | `b` | | 1 | 1 | 3 | 1 | 1 | 3 |

**`variants`** holds each distinct path once, whichever abstractions share it. Its `label` is the path in the grammar, and `length` its number of items.

| variant | label | length |
|---|---|---|
| 0 | `(model -> tool.read){2} -> model` | 5 |
| 1 | `model -> tool.edit! -> model` | 3 |
| 2 | `(model -> tool){2} -> model` | 5 |
| 3 | `model -> tool! -> model` | 3 |
| 4 | `(model -> tool.read)+ -> model` | 2 |
| 5 | `(model -> tool)+ -> model` | 2 |

**`tokens`** spells out each variant's [path](aggregation.md#read): its top-level items, where a parallel block, a delegated context or, with folded loops, a loop is one item.

**`steps`** holds every step of every distinct trace, the variants in the `full` column, in the order the trace prints them. A step is identified by that position, `index`: a step comes before its body, `parent` is the index of the step whose body holds it, or `-1`, and `depth` its nesting. The table encodes each distinct trace without loss.

**`pairs`** holds the [pairs](aggregation.md#read) of each distinct trace as step indices, with `-1` for the start and the end. Run `b` has four: `-1 → 0`, `0 → 1`, `1 → 2` and `2 → -1`.

**`times`** holds each timed step of each run, at the same `index`. Runs that share a trace share its steps and pairs, but not their times.

Every count a view shows is a join of these tables: activity uses, for instance, are `steps` grouped by variant and activity, joined to `runs` on `full`. [Compiling to Vega](vega.md) shows the join in a compiled spec.

## In code

Runs per variant at `actors`, and failed steps per actor:

```python
import tracegram

found = tracegram.tables(tracegram.read("spans.jsonl"))
found.runs.groupby("actors").size()
found.steps.query("failed").actor.value_counts()
```

```ts
import { read, tables } from "tracegram";

const { runs, variants, tokens, steps, pairs, times } = tables(read(records));
```

`tracegram.Corpus(runs).tables` holds the same tables for a corpus. Both languages build identical tables, held to [`grammar/tables.json`](https://github.com/sjoerdvink99/tracegram/blob/main/grammar/tables.json).

## Your own views

The views are fixed so that they read the same way and link to each other. For an encoding they do not offer, draw the tables with any grammar of graphics. Here, the length of every run by outcome, with [Altair](https://altair-viz.github.io):

```python
import altair as alt

found = tracegram.tables(tracegram.read("swe-agent.jsonl", {"run": "run", "actor": "actor", "name": "tool", "group": "outcome"}))
lengths = found.runs.merge(found.variants, left_on="full", right_on="variant")
alt.Chart(lengths).mark_tick().encode(x="length:Q", y="group:N")
```

The compiled Vega spec is a second way out: `compile(spec)`, `tracegram view.json --vega` or `chart.to_vega()` return it with the tables inside, ready for marks of your own.
