---
hide:
  - navigation
  - toc
---

<div class="hero" markdown>

![tracegram](assets/logo.svg){ .hero-logo }

# tracegram

**A grammar of agent processes, with declarative views compiled to Vega.** Every run of an agent becomes an expression in one small grammar, which also writes down designs and queries. Declarative views count, compare and query those expressions, and compile to [Vega](https://vega.github.io/vega/), so a figure renders the same in a browser, a notebook, a paper or CI.

[Get started](quickstart.md){ .md-button .md-button--primary } [The grammar](grammar.md){ .md-button } [Gallery](gallery.md){ .md-button }

</div>

## The grammar

An agent process is made of steps. Each step has an actor, and steps compose in sequence or in parallel, repeat, branch, delegate and fail. This is an orchestrator that plans tasks, hands each to a worker with its own tool loop, and synthesizes the results:

```text
model.plan(=> task:text[]) -> agent.worker{ (model -> tool[])* -> model }[] -> model.synthesize
```

```tracegram
{ "mark": "diagram", "process": "model.plan(=> task:text[]) -> agent.worker{ (model -> tool[])* -> model }[] -> model.synthesize" }
```

| | Written | Means |
|---|---|---|
| step | `model`, `tool.search`, `human.approve` | an actor, optionally named: `model`, `tool`, `agent`, `human` or `code` |
| sequence | `model -> tool` | one after the other |
| parallel | `tool.read \|\| tool.grep` | at the same time |
| choice | `agent.billing \| agent.tech` | one of them |
| repeat | `(model -> tool){2,5}`, `*`, `+`, `?` | the same process again |
| fan-out | `agent.worker[]` | parallel copies, one per item |
| context | `agent.worker{ model -> tool }` | a process inside a step |
| failure | `tool.edit!` | the step failed |
| signature | `model.plan(=> task:text[])` | what goes in and comes out |

## One syntax, three uses

### A trace: what happened

You never write a trace. A view reads the records your agent logs and maps their fields to the grammar with `trace`. These spans of a multi-agent run name their parent and their time:

```json
{"trace":"t1","id":"1","kind":"llm","name":"plan","start":0.0,"end":1.0}
{"trace":"t1","id":"2","kind":"agent","name":"research","start":1.1,"end":3.4}
{"trace":"t1","id":"4","parent":"2","kind":"tool","name":"search","start":1.9,"end":2.6}
```

```json
"trace": { "run": "trace", "step": "id", "parent": "parent", "actor": "kind", "name": "name", "start": "start", "end": "end", "failed": "error" }
```

The run becomes one expression. Children form a context, and spans that overlap in time run in parallel:

```text
model.plan -> agent.code{ model -> tool.edit -> code.test! -> model } || agent.research{ model -> tool.search -> model } -> model.report
```

```tracegram
{ "mark": "timeline", "lanes": "agent",
  "transform": [{ "filter": { "field": "trace", "equal": "t1" } }],
  "data": { "url": "assets/crew.jsonl" },
  "trace": { "run": "trace", "step": "id", "parent": "parent", "actor": "kind", "name": "name", "start": "start", "end": "end", "failed": "error" } }
```

### A design: what may happen

The agent loop calls tools, in parallel, until the model answers. Drawn beside sixteen sessions of a coding agent, every run is a path through it:

```tracegram
{ "data": { "url": "assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" },
  "hconcat": [
    { "mark": "diagram", "process": "(model -> tool[])* -> model", "title": "design" },
    { "mark": "sequences", "title": "runs" }
  ] }
```

### A query: what to look for

A failed tool call, the model, then a tool again: a retry. As a `highlight`, the query fills every prefix of the runs with the share that retries:

```tracegram
{ "mark": "icicle", "level": "names", "height": 260, "highlight": "tool! -> model -> tool",
  "data": { "url": "assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

In Python, `tracegram.conforms(run, design)` tests a run against a design, and `tracegram.find(run, query)` returns the steps of every match.

## Many runs, one figure

Because every run is an expression, runs can be made coarser before they are counted: rename steps into categories, keep less of each step, fold loops however often they ran. These are 400 [SWE-agent](https://swe-agent.com) runs on real GitHub issues, with their commands renamed into five categories and loops folded. Orange is more common in resolved runs, blue in unresolved ones: resolved runs more often open with a loop of edits and test in their first steps.

```tracegram
{ "mark": "sankey", "level": "names", "loops": "fold", "limit": 5, "height": 260,
  "data": { "url": "assets/swe-agent.jsonl" },
  "trace": { "run": "run", "actor": "actor", "failed": "failed", "group": { "field": "outcome", "order": ["resolved", "unresolved"] },
             "name": { "field": "tool", "map": { "open": "look", "goto": "look", "scroll_up": "look", "scroll_down": "look", "cat": "look", "ls": "look",
                                                 "search_dir": "search", "search_file": "search", "find_file": "search", "find": "search", "grep": "search",
                                                 "create": "edit", "rm": "edit", "python": "test", "bash": "test" } } } }
```

Every number in a view is defined over the expressions: which part of each run it reads, and in what unit it counts. [Aggregation →](aggregation.md)

## From records to figure

| Step | In the spec | Done by |
|---|---|---|
| Read the records | `data`, `transform` | tracegram |
| Map each run to a trace | `trace` | tracegram |
| Abstract the traces | `level`, `loops` | tracegram |
| Read, count, rank and fold | `mark`, `count`, `limit` | Vega |
| Lay out, draw and interact | `params`, `highlight`, `filter` | Vega |

The compiled spec is plain Vega with the corpus inside as [tables](tables.md). Clicks and level switches recount in the Vega dataflow, and the spec opens unchanged in the [Vega Editor](https://vega.github.io/editor/). [Compiling to Vega →](vega.md)

<div class="grid cards tracegram-features" markdown>

-   **Your data, as it is**

    Your own records, mapped field by field, or OpenTelemetry, LangSmith, Langfuse, Inspect AI, provider transcripts and agent trajectories, read with no mapping. [Data →](data.md) · [Standards →](standards.md)

-   **Thirteen views**

    Diagrams, timelines, hand-offs, icicles, variants, process graphs, Sankeys, transition matrices, activities, sequences, distributions, durations and projections, linked by selection. [Views →](views.md)

-   **A report in one command**

    `npx tracegram report logs/` writes one page of linked views of any corpus, and `npx tracegram report a.eval b.eval` compares two. [Quickstart →](quickstart.md)

-   **Try it in your browser**

    Drop a file of your own runs into the playground. It is read in the browser and never leaves it. [Playground →](playground.md)

-   **Figures for papers**

    `chart.save("figure.pdf")` in Python, `tracegram view.json -o figure.svg` on the command line: the same compiled Vega, the same figure. [Quickstart →](quickstart.md#figures-for-papers)

-   **Tables underneath**

    A corpus is six tables, for Vega, pandas or your own charts. [Tables →](tables.md)

</div>

## Cite

If tracegram helps your research, please cite it:

```bibtex
@software{vink2026tracegram,
  author  = {Vink, Sjoerd},
  title   = {tracegram: A Grammar of Agent Processes, with Declarative Views Compiled to Vega},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/sjoerdvink99/tracegram}
}
```
