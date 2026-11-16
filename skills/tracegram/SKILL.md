---
name: tracegram
description: Visualize and compare runs of LLM agents with tracegram. Use when asked to look at, summarize, compare or make figures of agent traces, trajectories, sessions or eval logs, such as OpenTelemetry spans, LangSmith or Langfuse exports, Inspect AI .eval logs, Claude Code or Codex sessions, SWE-agent or OpenHands trajectories, or JSONL records an agent logged.
---

# tracegram

tracegram maps every run of an agent to an expression in a small grammar (`model -> tool.search -> model`), counts the runs, and draws views of them, compiled to Vega. A view is a JSON spec: records in `data`, a `trace` mapping from their fields to the grammar, and a `mark`.

## 1. Find the runs

| Source | Where |
|---|---|
| Claude Code | `~/.claude/projects/<project>/` (one `.jsonl` per session, sub-agents beside it) |
| Codex CLI | `~/.codex/sessions/` |
| Inspect AI | `logs/*.eval` |
| OpenTelemetry, LangSmith, Langfuse, OpenAI Agents | an exported `.json` or `.jsonl` |
| SWE-agent, OpenHands, ATIF | trajectory `.traj`, `.json` or `.jsonl` files |

These standards are read without a mapping. Records of another shape need a `trace` mapping (step 3).

## 2. Start with a report

```bash
npx -y tracegram report <file-or-folder> -o report.html
npx -y tracegram report before.jsonl after.jsonl -o report.html
```

A folder is one corpus. Two sources are compared, one group each, and every view shows how they differ. The page links variants, activities, transitions and run lengths, adds a timeline when steps have times, and prints its spec under the figure. Open it, or read its spec to choose the next view.

## 3. Answer a question with a view

| Question | Mark |
|---|---|
| which runs are alike, and how often | `variants` |
| where runs branch after a shared start | `icicle`, `sankey` |
| which step follows which | `transitions`, `graph` |
| which steps occur and fail most | `activities` |
| how long steps take | `durations` |
| how runs spread in length, failures or time | `distribution` |
| every run as a row | `sequences` |
| what one run did, over time | `timeline`, `handoffs` |

Write the spec to a file and render it. The CLI reads `data.url` relative to the spec:

```json
{ "mark": "transitions", "count": "runs",
  "data": { "url": "events.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error", "group": "model" } }
```

```bash
npx -y tracegram view.json -o figure.svg
```

A wrong spec fails with the path of what is wrong, such as `tracegram: spec.level: expected one of full, names, actors`. Fix that property and render again.

- `level` (`full`, `names`, `actors`) and `loops` (`count`, `fold`) set how much of each step and loop a view keeps. On long runs nearly every run is distinct: use `"level": "actors"`, `"loops": "fold"`, or rename tools into categories with `"name": { "field": "tool", "map": { "grep": "search", "find": "search" } }`.
- `group` compares two values of a field; `{ "facet": { "field": "model" }, "spec": view }` draws one panel per value.
- `highlight` takes a query in the grammar, such as `"(tool! -> model){2,}"` for repeated failures.
- `vconcat` and `hconcat` combine views that share `data` and `trace`; `params` and `filter` link them.

The full reference for writing specs is at https://sjoerdvink99.github.io/tracegram/llms.txt and the schema at https://cdn.jsdelivr.net/npm/tracegram/dist/view.schema.json.

## 4. Analyse in Python

```python
import tracegram

runs = tracegram.Corpus(tracegram.read("logs/"))
runs.variants(level="actors", loops="fold")
runs.find("(tool! -> model){2,}")
runs.conformance("(model -> tool[])* -> model")
tracegram.Diff(tracegram.read("before.jsonl"), tracegram.read("after.jsonl"), labels=("before", "after")).variants()
tracegram.Chart(spec).save("figure.pdf")
```

`save` writes `.svg`, `.png` and `.pdf` with `pip install "tracegram[save]"`.

## Report back

Say what the view shows and what it counts (runs, share of runs, or steps), name the file you wrote, and give the spec so the user can change it.
