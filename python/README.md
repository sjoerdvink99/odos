# tracegram

A grammar of agent processes, with declarative views compiled to Vega.

```bash
pip install tracegram
pip install "tracegram[save]"
```

A linked overview of a corpus, two corpora compared, and the agent loop as a figure for a paper:

```python
import tracegram

tracegram.report("spans.jsonl").save("report.html")
tracegram.report(tracegram.Diff(tracegram.read("model-a.eval"), tracegram.read("model-b.eval"), labels=("a", "b")))
tracegram.diagram("(model -> tool[])* -> model").save("loop.pdf")
```

The `save` extra writes `.svg`, `.png` and `.pdf` without Node or a browser.

Read telemetry in a standard, such as OpenTelemetry, LangSmith, Inspect AI or Claude Code, or your own records with a mapping. A corpus then charts its runs, measures how many follow a design, finds patterns, and exports its tables, XES, OCEL, BPMN, OTLP or the compiled Vega spec:

```python
runs = tracegram.Corpus(tracegram.read(events, {"run": "session", "actor": "type", "name": "tool"}))
runs.chart(mark="variants", level="names")
runs.conformance("(model -> tool[])* -> model")
runs.find("(model -> tool!){3,}")
runs.tables.pairs
tracegram.to_xes(runs)
runs.chart(mark="icicle").to_vega()
```

Documentation: <https://sjoerdvink99.github.io/tracegram/> · Source: <https://github.com/sjoerdvink99/tracegram>

If tracegram helps your research, please cite it: see <https://sjoerdvink99.github.io/tracegram/#cite>.
