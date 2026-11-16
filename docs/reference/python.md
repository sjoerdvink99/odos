# Python

```python
import tracegram
```

## Grammar

| Function | Returns |
|---|---|
| `parse(text)` | a `Node`; raises `ParseError` with `position` and `reason` |
| `trace(text, id="", **meta)` | a `Trace`; raises `TraceError` |
| `conforms(run, spec)` | `True` when the run is in the spec's language |
| `find(run, query)` | `list[Hit]`: the `text` of each match and the positions of its `steps` |
| `abstract(node, level="actors", loops="count")`, `fold(node)` | a coarser node; `level` is one of `LEVELS`, `loops` one of `LOOPS` |
| `sample(spec, n=1, seed=None)` | `n` random traces the spec accepts |
| `is_ground(node)`, `size(node)` | whether a node is a trace, and its number of steps |
| `tables(runs)` | the [`Tables`](../tables.md) of the runs: `runs`, `variants`, `tokens`, `steps`, `pairs` and `times` as DataFrames |

`str(node)` prints the canonical text. Nodes are frozen dataclasses: `Step`, `Seq`, `Par`, `Alt`, `Repeat` (with `parallel` for `[m,n]`). A `Trace` holds its `process`, `id`, `time`, one `(start, end)` or `None` per step in order (empty when untimed), and `meta`.

## Corpora

`Corpus(runs, name="")` holds traces. Index it, iterate it, or:

| Method | Returns |
|---|---|
| `chart(mark="icicle", **options)` | a `Chart`; `options` are those of the mark's function below |
| `tables` | the corpus's [`Tables`](../tables.md) |
| `variants(level, loops="count")` | a DataFrame of distinct runs and their share |
| `find(query)` | a DataFrame of every match |
| `where(query)` | the runs that contain a match |
| `conformance(spec)` | the share of runs the spec accepts |
| `select(ids)` | the runs with these ids |

`Diff(a, b, spec=None, queries=(), labels=("A", "B"))` compares two corpora: `metrics()`, `variants(level, loops)` and `chart(mark, **options)`.

## Charts

| Function | Mark |
|---|---|
| `diagram(process, title=None, key=True)` | `diagram` |
| `timeline(run, title=None, lanes="step")` | `timeline` |
| `handoffs(process, title=None)` | `handoffs` |
| `icicle(data, level="actors", loops="count", highlight=None, title=None, height=380)` | `icicle` |
| `variants(data, level="actors", loops="count", highlight=None, title=None, limit=12)` | `variants` |
| `transitions(data, level="names", count="steps", title=None, limit=16)` | `transitions` |
| `graph(data, level="names", count="steps", title=None, limit=16)` | `graph` |
| `sankey(data, level="actors", loops="count", title=None, limit=8, height=300)` | `sankey` |
| `activities(data, level="names", title=None, limit=16)` | `activities` |
| `sequences(data, highlight=None, title=None, limit=50, x="step")` | `sequences` |
| `distribution(data, measure="steps", highlight=None, title=None)` | `distribution` |
| `durations(data, level="names", title=None, limit=16)` | `durations` |
| `projection(data, level="names", loops="count", highlight=None, title=None, height=300)` | `projection` |
| `vconcat(*charts, title=None)`, `hconcat(*charts, title=None)` | `vconcat`, `hconcat` |
| `report(data, trace=None, title=None)` | a linked overview of records, a file or folder, a `Corpus` or a `Diff`, with a timeline when the steps have times |

`data` is a corpus, a list of runs, a `Diff`, or a dict of named corpora; runs that `read` gave a group keep it. The spec carries the runs as `data.values`: two groups are compared in one view with a `trace` group, and more than two become a [`facet`](../data.md#facets) with one panel each. `Chart(spec)` takes any view spec; a `data.url` naming a local file is read in Python.

A `Chart` has `selected`, `to_dict()`, `to_json()`, `to_html()`, `to_vega()`, `to_svg()`, `to_png(scale=2)`, `to_pdf()` and `save(path, scale=2)`, which writes `.html`, `.json`, `.vg.json`, `.svg`, `.png` or `.pdf` by the file's suffix. The compiled Vega and the figures need the save extra, `pip install "tracegram[save]"`: the same compiler runs in an embedded JavaScript engine, and [vl-convert](https://github.com/vega/vl-convert) renders its Vega, with no Node or browser.

## Readers and exports

| Function | |
|---|---|
| `read(source, format=None)` | a file, a folder, a record or records to `list[Trace]`; `format` is a standard, detected unless given, or a [`trace` mapping](../data.md#trace) dict |
| `to_otel(runs)`, `to_xes(runs)`, `to_ocel(runs)` | runs to OTLP/JSON, XES or OCEL 2.0 |
| `to_bpmn(spec)`, `to_process_tree(spec)` | a spec to BPMN 2.0 or a pm4py process tree |
