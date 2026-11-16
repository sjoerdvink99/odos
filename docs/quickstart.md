# Quickstart

## Install

=== "Python"

    ```bash
    pip install tracegram
    pip install "tracegram[save]"
    ```

    Import it as `import tracegram`. Charts work in Jupyter, JupyterLab, VS Code, Colab and marimo. The `save` extra writes figures as SVG, PNG and PDF, without Node or a browser.

=== "TypeScript"

    ```bash
    npm install tracegram
    ```

    One dependency, [Vega](https://vega.github.io/vega/), with type declarations.

=== "Plain HTML"

    ```html
    <script src="https://cdn.jsdelivr.net/npm/tracegram/dist/tracegram.min.js"></script>
    ```

    Bundles Vega and exposes the same API as the global `tracegram`.

=== "From source"

    ```bash
    git clone https://github.com/sjoerdvink99/tracegram
    cd tracegram && make install
    ```

    Needs Node 22+ and Python 3.10+.

## A report in one command

Point the CLI at a trace file or a folder. It reads every [standard](standards.md) without configuration, and writes one page of linked views: variants, activities, transitions, run lengths and, when the steps have times, a timeline of the selected run. A folder is one corpus: every `.json`, `.jsonl`, `.eval` and `.traj` file in it. Two sources are compared, one group each, so every view shows how they differ. For records of your own, pass a [`trace` mapping](data.md#trace) in a JSON file.

=== "CLI"

    ```bash
    npx tracegram report spans.jsonl -o report.html
    npx tracegram report ~/.claude/projects/my-project/
    npx tracegram report logs/model-a.eval logs/model-b.eval
    npx tracegram report events.jsonl --trace mapping.json -o report.html
    ```

=== "Python"

    In a notebook the report shows in place; `save` writes the page. A `Diff` compares two corpora.

    ```python
    tracegram.report("spans.jsonl").save("report.html")
    tracegram.report(records, {"run": "session", "actor": "type", "name": "tool"})
    tracegram.report(tracegram.Diff(tracegram.read("model-a.eval"), tracegram.read("model-b.eval"), labels=("a", "b")))
    ```

=== "TypeScript"

    ```ts
    import { embed, report } from "tracegram";

    await embed(element, report({ values: records }, { run: "session", actor: "type", name: "tool" }));
    ```

The CLI writes the spec under the figure, so the next step is editing a spec.

## Your first view

You need two things: your records and a view spec.

Your records are whatever your agent logs. Here, [`coding.jsonl`](assets/coding.jsonl) holds one event per step of a coding agent:

```json
{"session":"s01","version":"before","type":"llm","start":0.0,"end":1.0}
{"session":"s01","type":"tool","tool":"read","start":1.1,"end":1.4}
{"session":"s01","type":"llm","start":1.5,"end":2.8}
```

The spec names a `mark`, points `data` at the records, and maps their fields with `trace`: `session` is the run, `type` the actor, `tool` the step's name, `start` and `end` the time, and `error` marks a failure.

```tracegram
{ "mark": "variants", "level": "names",
  "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" } }
```

That is all. tracegram maps each session to a trace in its [grammar](grammar.md), `model -> tool.read -> model`, and compiles the view to Vega, which counts the distinct runs and draws them. Change `mark` to `transitions`, `activities` or `sequences` for another view of the same records.

=== "Python"

    Python reads a `data.url` that names a local file, so every spec in these docs works as it is:

    ```python
    import tracegram

    chart = tracegram.Chart({
        "mark": "variants",
        "level": "names",
        "data": {"url": "coding.jsonl"},
        "trace": {"run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error"},
    })
    chart.save("variants.pdf")
    ```

=== "TypeScript"

    ```ts
    import { embed } from "tracegram";

    await embed(document.getElementById("view")!, {
      mark: "variants",
      level: "names",
      data: { url: "coding.jsonl" },
      trace: { run: "session", actor: "type", name: "tool", start: "start", end: "end", failed: "error" },
    });
    ```

=== "Plain HTML"

    ```html
    <div id="view"></div>
    <script>
      tracegram.embed(document.getElementById("view"), {
        mark: "variants",
        level: "names",
        data: { url: "coding.jsonl" },
        trace: { run: "session", actor: "type", name: "tool", start: "start", end: "end", failed: "error" },
      });
    </script>
    ```

=== "CLI"

    With the spec above in `view.json`, draw it as SVG, or print the compiled Vega spec:

    ```bash
    npx tracegram view.json -o variants.svg
    npx tracegram view.json --vega
    ```

## Telemetry in a standard

OpenTelemetry spans, LangSmith runs, provider transcripts and the other [standards](standards.md) need no `trace` at all:

```json
{ "mark": "variants", "level": "names", "data": { "url": "spans.jsonl" } }
```

## Linked views

Views in one spec share their data and link through selections. Click a variant to see its runs:

```tracegram
{ "data": { "url": "../assets/coding.jsonl" },
  "trace": { "run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error" },
  "vconcat": [
    { "mark": "variants", "level": "names", "params": [{ "name": "picked", "select": "click" }], "highlight": { "param": "picked" } },
    { "mark": "sequences", "filter": { "param": "picked" } }
  ] }
```

In Python, a corpus gives the same charts and analyses over the grammar: every distinct run by frequency, the share of runs that follow a design, and every place where two tool calls fail in a row.

```python
runs = tracegram.Corpus(tracegram.read(records, {"run": "session", "actor": "type", "name": "tool", "failed": "error"}))
runs.chart(mark="variants", level="names")
runs.conformance("(model -> tool[])* -> model")
runs.find("(model -> tool!){2,}")
```

## Figures for papers

A figure is the compiled Vega spec, rendered the same everywhere. Set its `width` to your column and `config.font` to the paper's font, then save it:

```python
tracegram.Chart({**spec, "width": 500, "config": {"font": "Helvetica"}}).save("figure.pdf")
```

```bash
npx tracegram view.json -o figure.svg
```

The [playground](playground.md) does the same in the browser, for a file of your own.

## Next

- [Data](data.md): map your records to runs.
- [Aggregation](aggregation.md): what every view counts, and how.
- [Grammar](grammar.md): what your runs become, and how to query them.
- [Views](views.md): every mark and its properties.
- [Interaction](interaction.md): build an analytics tool on top.
