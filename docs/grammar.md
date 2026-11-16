# Grammar

An expression describes an agent process: what happened in one run, or what may happen in any run. The grammar has steps, three ways to compose them, two ways to repeat them, and contexts that nest a process inside a step.

## Steps

A step is one thing an agent did. Its actor says what kind of thing:

| Actor | Is | Example |
|---|---|---|
| `model` | one inference | `model.plan` |
| `tool` | an action the model chose | `tool.search` |
| `agent` | a delegated process with its own context | `agent.worker{ model -> tool }` |
| `human` | input, approval or feedback | `human.approve` |
| `code` | deterministic harness logic | `code.check` |

Only the actor is required. A name says which one, `!` that it failed, a signature what went in and came out, and a body `{ … }` the process that ran in the step's own context:

```text
tool.search(query:text => hit:doc[])!
```

```tracegram
{ "mark": "diagram", "process": "human.ask -> model.plan(=> query:text) -> tool.search(query:text => hit:doc[])! -> agent.writer{ model -> tool.draft } -> human.approve" }
```

## Composition

| | Written | Means |
|---|---|---|
| sequence | `model -> tool` | one after the other |
| parallel | `tool.read \|\| tool.grep` | at the same time |
| choice | `agent.billing \| agent.tech` | one of them |

A router picks one specialist; sections run in parallel and are merged by code:

```tracegram
{ "hconcat": [
  { "mark": "diagram", "process": "model.route -> (agent.billing | agent.tech | model.answer)", "title": "routing" },
  { "mark": "diagram", "process": "(model.intro || model.method || model.results) -> code.merge", "title": "sectioning" }
] }
```

## Repetition

Any process repeats, in sequence with `{m,n}` or as parallel copies with `[m,n]`. Leave out the upper bound for no limit:

| Written | Means |
|---|---|
| `(model -> tool){2,5}` | two to five times, one after the other |
| `model.answer[5]` | five copies at the same time |
| `a*`, `a+`, `a?` | `a{0,}`, `a{1,}`, `a{0,1}`: any number, at least one, optional |
| `a{n}`, `a[n]` | exactly `n` times, exactly `n` copies |
| `a[]` | `a[0,]`: one copy per item |

The agent loop calls tools, any number in parallel, until the model answers. Voting asks the same question five times at once:

```tracegram
{ "hconcat": [
  { "mark": "diagram", "process": "(model -> tool[])* -> model", "title": "agent loop" },
  { "mark": "diagram", "process": "model.answer[5] -> code.vote", "title": "voting" }
] }
```

## Nesting

A body runs a whole process inside one step. Fan-out and nesting together give the orchestrator: one worker per task, each with its own tool loop.

```tracegram
{ "mark": "diagram", "process": "model.plan(=> task:text[]) -> agent.worker{ (model -> tool[])* -> model }[] -> model.synthesize" }
```

## Writing expressions

Parentheses group. Without them, `|` binds loosest, then `->`, then `||`, then the repeats, so `model -> tool || code*` reads as `model -> (tool || (code*))`. Names are letters, digits and `_`, not starting with a digit. A signature lists inputs and outputs as `role:medium`, with `[]` for a list, and either side may be empty. In queries, the actor `_` matches any step. Every expression prints back in one canonical form, with the shortest notation that applies.

The [gallery](gallery.md#designs) draws the common agent designs: prompt chains, routing, sectioning, voting, the agent loop, orchestrators, evaluator and optimizer, human in the loop, retrieval and MCP sampling.

## Traces, designs and queries

One syntax does three jobs:

| | Is | Used by |
|---|---|---|
| **trace** | one run: no choice, no `_`, every repeat exact | every view, built from your records by [`trace`](data.md#trace) |
| **design** | every run it allows | `diagram`, `conforms(trace, design)` |
| **query** | a pattern to find inside runs | `highlight`, `find(trace, query)` |

You never write a trace: a view maps your records to one per run. A session of model and tool calls becomes `model -> tool.read -> model -> tool.write! -> model`.

`conforms` tests a run against a design. This run follows the agent loop, so the call returns `True`:

```python
tracegram.conforms("model -> tool -> model", "(model -> tool[])* -> model")
```

`find` returns every match of a query, with the positions of its steps. Here one hit, `(model -> tool!){2}`, at steps `0` to `3`:

```python
tracegram.find("model -> tool! -> model -> tool! -> model", "(model -> tool!){2,}")
```

Matching follows three rules:

- A step in a design or query matches any step at least as specific: `tool` matches `tool.search(q => r)!`, `tool!` matches only failed tools, and `agent{ model }` matches an agent whose body it accepts.
- Parallel branches match in any order: `tool.a || tool.b` accepts `tool.b || tool.a`.
- A query finds the longest match from the left, then continues after it, at every depth of the run.

A step is identified by its position: the order in which the trace prints it, a step before its body. A run's times are listed in the same order.

## Meaning

A trace is a partial order of steps: `->` orders, `||` leaves unordered, and a step comes before its body. Two traces are equal when they order the same steps the same way, so `tool.a || tool.b` equals `tool.b || tool.a`, and a design accepts every trace whose order it can produce. Without `||`, a design is a regular expression over steps; with it, its traces are series-parallel. Conformance is decided by matching the trace's structure, never by guessing an interleaving.

## Levels

Views compare runs after [abstracting](aggregation.md#abstract) them. `level` sets how much of each step is kept, and `loops` whether a loop keeps how often it ran:

| `level` | Keeps | `model -> tool.read(q => r) -> model -> tool.read -> model` |
|---|---|---|
| `full` | everything | `model -> tool.read(q => r) -> model -> tool.read -> model` |
| `names` | actors and names | `(model -> tool.read){2} -> model` |
| `actors` | actors | `(model -> tool){2} -> model` |
| `actors`, `loops: "fold"` | the shape of repeats | `(model -> tool)+ -> model` |

With `loops: "fold"`, a run with two rounds and a run with five are one variant, and a loop is marked failed only when every round failed. `abstract(trace, level, loops)` returns the right-hand column, and every run conforms to its own abstraction.

## Limits

Expressions nest at most 64 levels deep, counts are at most 100,000, and a trace has at most 100,000 steps. Beyond these, `parse` raises `ParseError` and `trace` raises `TraceError`, and readers skip the run.
