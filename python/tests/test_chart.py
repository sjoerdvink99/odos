import json
from pathlib import Path

import pytest

import tracegram

ROOT = Path(__file__).parents[2]
LOOP = "(model -> tool[])* -> model"


def test_diagram_spec():
    assert tracegram.parse(LOOP).chart().to_dict() == {"mark": "diagram", "process": LOOP, "key": True}


def test_icicle_groups():
    runs = tracegram.sample(LOOP, 4, seed=1)
    spec = tracegram.icicle({"old": runs, "new": runs}, loops="fold", highlight="tool[2]").to_dict()
    values = spec["data"]["values"]
    assert spec["trace"] == {"group": "group"} and [run["group"] for run in values] == ["old"] * 4 + ["new"] * 4
    assert spec["highlight"] == "tool[2]" and spec["loops"] == "fold"
    assert all(tracegram.conforms(run["process"], LOOP) for run in values)


def test_more_than_two_groups_become_panels():
    runs = tracegram.sample(LOOP, 2, seed=2)
    spec = tracegram.variants({"a": runs, "b": runs, "c": runs}, level="names").to_dict()
    assert spec["facet"] == {"field": "group"} and "trace" not in spec
    assert spec["spec"]["mark"] == "variants" and spec["spec"]["level"] == "names"
    assert sorted({run["group"] for run in spec["data"]["values"]}) == ["a", "b", "c"]
    assert len(tracegram.variants({"a": runs, "b": runs, "c": runs}).to_vega()["marks"]) == 3
    with pytest.raises(ValueError):
        tracegram.variants({})


def test_grouped_traces_keep_their_group():
    events = [{"arm": arm, "kind": "llm"} for arm in ("a", "b")]
    spec = tracegram.variants(tracegram.read(events, {"run": "arm", "actor": "kind", "group": "arm"})).to_dict()
    assert spec["trace"] == {"group": "group"} and [run["group"] for run in spec["data"]["values"]] == ["a", "b"]


def test_trace_with_time_is_diagram_over_timeline():
    [run] = tracegram.read(
        [
            {
                "traceId": "t",
                "spanId": "1",
                "name": "chat",
                "startTimeUnixNano": "0",
                "endTimeUnixNano": "1000000000",
                "attributes": {"gen_ai.operation.name": "chat"},
            },
            {
                "traceId": "t",
                "spanId": "2",
                "name": "search",
                "startTimeUnixNano": "1000000000",
                "endTimeUnixNano": "1500000000",
                "attributes": {"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search"},
            },
        ]
    )
    spec = run.chart().to_dict()
    assert [part["mark"] for part in spec["vconcat"]] == ["diagram", "timeline"]
    assert spec["vconcat"][1]["data"]["values"][0]["time"] == [[0.0, 1.0], [1.0, 1.5]]
    assert all(part["highlight"] == {"param": "step"} for part in spec["vconcat"])


def test_vega_is_the_compiled_view(tmp_path):
    chart = tracegram.variants(tracegram.sample(LOOP, 4, seed=7), level="names")
    vega = chart.to_vega()
    assert vega["$schema"].endswith("vega/v6.json")
    assert {"selected_store", "runs", "variants"} <= {data["name"] for data in vega["data"]}
    assert json.loads(chart.save(tmp_path / "figure.vg.json").read_text()) == vega
    assert chart.save(tmp_path / "figure.json").read_text() == chart.to_json()


def test_figures_save_without_node(tmp_path):
    chart = tracegram.transitions(tracegram.sample(LOOP, 4, seed=7))
    assert chart.save(tmp_path / "figure.svg").read_text().startswith("<svg")
    assert chart.save(tmp_path / "figure.png").read_bytes().startswith(b"\x89PNG")
    assert chart.save(tmp_path / "figure.pdf").read_bytes().startswith(b"%PDF")
    assert len(chart.to_png(scale=1)) < len(chart.to_png(scale=3))
    with pytest.raises(ValueError, match="save to one of"):
        chart.save(tmp_path / "figure.gif")


def test_invalid_views_raise_where_they_are_wrong():
    with pytest.raises(ValueError, match=r"^spec\.mark: expected one of"):
        tracegram.Chart({"mark": "pie"}).to_vega()
    with pytest.raises(ValueError, match=r"^spec\.data\.url"):
        tracegram.Chart({"mark": "variants", "data": {"url": "missing.jsonl"}}).to_vega()


def test_local_files_are_read_in_python(tmp_path, monkeypatch):
    monkeypatch.chdir(ROOT / "docs" / "assets")
    trace = {"run": "session", "actor": "type", "name": "tool", "group": "version"}
    view = {"data": {"url": "coding.jsonl"}, "trace": trace}
    spec = {**view, "vconcat": [{"mark": "variants"}, {"mark": "activities", "data": {"url": "coding.jsonl"}}]}
    chart = tracegram.Chart(spec)
    assert chart.to_dict() == spec and "coding.jsonl" in chart.to_json()
    hosted = chart.host.spec
    assert hosted["data"]["values"] is hosted["vconcat"][1]["data"]["values"] and len(hosted["data"]["values"]) > 16
    assert "coding.jsonl" not in chart.to_html() and chart.to_vega()["$schema"].endswith("vega/v6.json")
    faceted = tracegram.Chart({**view, "facet": {"field": "version"}, "spec": {"mark": "activities"}})
    assert "values" in faceted.host.spec["data"]


def test_html_is_self_contained():
    html = tracegram.diagram(LOOP).to_html()
    assert "tracegram.embed" in html and json.dumps(LOOP)[1:-1] in html


def test_specs_follow_the_view_schema():
    jsonschema = pytest.importorskip("jsonschema")
    schema = json.loads((ROOT / "grammar" / "view.schema.json").read_text())
    runs = tracegram.read(tracegram.to_otel(tracegram.sample(LOOP, 3, seed=2)))
    corpus = tracegram.Corpus(runs)
    charts = (
        tracegram.diagram(LOOP),
        runs[0].chart(),
        tracegram.icicle({"a": runs, "b": runs}, highlight="tool"),
        corpus.chart(mark="variants", highlight="tool"),
        tracegram.Diff(runs, runs).chart(mark="transitions"),
        corpus.chart(mark="sequences", x="time", highlight="tool"),
        tracegram.hconcat(tracegram.diagram(LOOP, title="spec"), tracegram.sequences(corpus, limit=2)),
        tracegram.graph(corpus, level="actors"),
        tracegram.sankey({"a": runs, "b": runs}, loops="fold", height=200),
        tracegram.activities(corpus, limit=4),
        tracegram.timeline(runs[0], lanes="agent"),
        tracegram.handoffs(runs[0]),
        tracegram.handoffs("human.user -> agent.coder{ model -> tool } -> model"),
        tracegram.distribution({"a": runs, "b": runs}, measure="duration"),
        tracegram.durations(corpus, level="actors", limit=3),
        tracegram.projection(corpus, highlight="tool", height=200),
    )
    for chart in charts:
        jsonschema.validate(chart.to_dict(), schema)


def test_corpus_marks():
    runs = tracegram.Corpus(tracegram.sample(LOOP, 5, seed=3))
    marks = (
        "icicle",
        "variants",
        "transitions",
        "graph",
        "sankey",
        "activities",
        "sequences",
        "distribution",
        "projection",
    )
    assert [runs.chart(mark=mark).to_dict()["mark"] for mark in marks] == list(marks)
    assert tracegram.variants(runs, limit=3).to_dict()["limit"] == 3
    with pytest.raises(ValueError):
        runs.chart(mark="pie")


def test_timed_marks_carry_time():
    runs = tracegram.read(tracegram.to_otel(tracegram.sample(LOOP, 2, seed=4)))
    assert "time" not in tracegram.distribution(runs).to_dict()["data"]["values"][0]
    assert "time" in tracegram.distribution(runs, measure="duration").to_dict()["data"]["values"][0]
    assert "time" in tracegram.durations(runs).to_dict()["data"]["values"][0]
    assert "time" in tracegram.handoffs(runs[0]).to_dict()["data"]["values"][0]
    assert "time" not in tracegram.handoffs("model -> tool").to_dict()["data"]["values"][0]
    with pytest.raises(ValueError):
        tracegram.distribution(runs, measure="tokens")


def test_sequences_carry_time_only_when_positioned_by_time():
    runs = tracegram.read(tracegram.to_otel(tracegram.sample(LOOP, 2, seed=4)))
    by_step = tracegram.sequences(runs).to_dict()
    by_time = tracegram.sequences(runs, x="time").to_dict()
    assert "time" not in by_step["data"]["values"][0]
    assert all(interval is not None for interval in by_time["data"]["values"][0]["time"])
    with pytest.raises(ValueError):
        tracegram.sequences(runs, x="index")


def test_views_compose_without_nesting():
    side = tracegram.hconcat(tracegram.diagram("model"), tracegram.diagram("tool"))
    assert [view["process"] for view in side.to_dict()["hconcat"]] == ["model", "tool"]
    with pytest.raises(ValueError):
        tracegram.vconcat(side, tracegram.diagram("model"))
    with pytest.raises(ValueError):
        tracegram.hconcat()


def test_corpus_views_select_runs_on_click():
    runs = tracegram.sample(LOOP, 3, seed=5)
    spec = tracegram.variants(runs).to_dict()
    assert spec["params"] == [{"name": "selected", "select": "click"}]
    assert spec["highlight"] == {"param": "selected"}
    assert "highlight" not in tracegram.icicle(runs).to_dict()
    assert tracegram.variants(runs, highlight="tool").to_dict()["highlight"] == "tool"
    assert "params" not in tracegram.sankey(runs, select=None).to_dict()
    assert tracegram.sequences(runs, select="hover").to_dict()["params"][0]["select"] == "hover"
    with pytest.raises(ValueError):
        tracegram.graph(runs, select="drag")


def test_properties_extend_the_spec():
    chart = tracegram.variants(tracegram.sample(LOOP, 2, seed=6)).properties(
        tooltip=["runs", {"field": "share", "title": "of runs"}]
    )
    assert chart.to_dict()["tooltip"][1] == {"field": "share", "title": "of runs"}
    assert chart.selected == [] and chart.selection == {}


def test_timeline_lanes_are_checked():
    run = tracegram.trace("model -> agent.worker{ model -> tool }")
    assert "lanes" not in tracegram.timeline(run).to_dict()
    assert tracegram.timeline(run, lanes="agent").to_dict()["lanes"] == "agent"
    with pytest.raises(ValueError):
        tracegram.timeline(run, lanes="tool")


def test_report_links_the_corpus_views_and_adds_a_timeline_when_timed():
    trace = {"run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end", "failed": "error"}
    spec = tracegram.report(ROOT / "docs" / "assets" / "coding.jsonl", trace).to_dict()
    marks = [view["mark"] for view in spec["vconcat"]]
    assert marks == ["variants", "activities", "transitions", "distribution", "timeline"]
    assert spec["trace"] == trace and len({record["session"] for record in spec["data"]["values"]}) == 16
    untimed = tracegram.report([{"process": "model -> tool -> model"}]).to_dict()
    assert [view["mark"] for view in untimed["vconcat"]][-1] == "distribution"


def test_report_compares_two_corpora():
    before, after = tracegram.sample(LOOP, 3, seed=1), tracegram.sample(LOOP, 5, seed=2)
    spec = tracegram.report(tracegram.Diff(before, after, labels=("before", "after"))).to_dict()
    groups = [run["group"] for run in spec["data"]["values"]]
    assert spec["trace"] == {"group": "group"} and groups == ["before"] * 3 + ["after"] * 5
    assert [view["mark"] for view in spec["vconcat"]][-1] == "distribution"
    assert "trace" not in tracegram.report(tracegram.Corpus(before)).to_dict()
    with pytest.raises(ValueError, match="already traced"):
        tracegram.report(tracegram.Corpus(before), {"run": "id"})


def test_report_reads_a_folder_as_one_corpus(tmp_path):
    for name, process in (("a", "model -> tool"), ("b", "model")):
        (tmp_path / f"{name}.jsonl").write_text(json.dumps({"id": "1", "process": process}))
    spec = tracegram.report(tmp_path, title="runs").to_dict()
    assert sorted(run["id"] for run in spec["data"]["values"]) == ["1", "b/1"] and spec["title"] == "runs"
