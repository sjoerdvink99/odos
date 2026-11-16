from __future__ import annotations

import html
import json
from collections.abc import Iterable, Mapping
from pathlib import Path

import anywidget
import traitlets

from . import engine
from .abstract import LOOPS, check
from .corpus import Corpus, Diff
from .parser import parse
from .standards import read
from .standards.records import Records, records
from .syntax import Node
from .trace import Trace, trace, walk

STATIC = Path(__file__).parent / "static"
REPORT = json.loads((STATIC / "report.json").read_text())

PAGE = """<!doctype html>
<html>
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:24px">
<div id="view"></div>
<script>{library}</script>
<script>tracegram.embed(document.getElementById("view"), {spec});</script>
</body>
</html>
"""

Runs = Corpus | Iterable[Trace | Node | str]


class Host(anywidget.AnyWidget):
    _esm = STATIC / "widget.js"
    spec = traitlets.Dict().tag(sync=True)
    selection = traitlets.Dict().tag(sync=True)


class Chart:
    def __init__(self, spec: dict):
        self.spec = spec
        self._host: Host | None = None

    def __repr__(self) -> str:
        return f"<Chart {self.spec.get('mark', 'vconcat')}>"

    @property
    def host(self) -> Host:
        if self._host is None:
            self._host = Host(spec=_inline(self.spec))
        return self._host

    @property
    def selection(self) -> dict[str, list[str]]:
        return {name: list(ids) for name, ids in self.host.selection.items()}

    @property
    def selected(self) -> list[str]:
        return self.selection.get(SELECTED, [])

    def properties(self, **properties) -> Chart:
        return Chart({**self.spec, **properties})

    def to_dict(self) -> dict:
        return self.spec

    def to_json(self, indent: int | None = 2) -> str:
        return json.dumps(self.spec, indent=indent)

    def to_html(self) -> str:
        spec = json.dumps(_inline(self.spec)).replace("<", "\\u003c")
        title = html.escape(str(self.spec.get("title", "tracegram")))
        return PAGE.format(title=title, library=engine.LIBRARY.read_text(), spec=spec)

    def to_vega(self) -> dict:
        return engine.to_vega(_inline(self.spec))

    def to_svg(self) -> str:
        return engine.svg(self.to_vega())

    def to_png(self, scale: float = 2.0) -> bytes:
        return engine.png(self.to_vega(), scale)

    def to_pdf(self) -> bytes:
        return engine.pdf(self.to_vega())

    def save(self, path: str | Path, scale: float = 2.0) -> Path:
        path = Path(path)
        writers = {
            ".vg.json": lambda: json.dumps(self.to_vega(), indent=2),
            ".json": self.to_json,
            ".html": self.to_html,
            ".svg": self.to_svg,
            ".png": lambda: self.to_png(scale),
            ".pdf": self.to_pdf,
        }
        suffix = next((suffix for suffix in writers if path.name.endswith(suffix)), None)
        if suffix is None:
            raise ValueError(f"save to one of {', '.join(writers)}")
        content = writers[suffix]()
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content)
        return path

    def _repr_mimebundle_(self, **kwargs):
        bundle = self.host._repr_mimebundle_(**kwargs)
        data, metadata = bundle if isinstance(bundle, tuple) else (bundle, {})
        return {**(data or {}), "text/plain": repr(self)}, metadata


def diagram(process: Node | Trace | str, title: str | None = None, key: bool = True) -> Chart:
    node = process.process if isinstance(process, Trace) else parse(process)
    return Chart(_spec({"mark": "diagram", "process": str(node), "key": key}, title))


def timeline(run: Trace, title: str | None = None, lanes: str = "step") -> Chart:
    if lanes not in LANES:
        raise ValueError(f"lanes must be one of {', '.join(LANES)}")
    spec = {"mark": "timeline", "data": {"values": [_run(run, True)]}, "width": "container"}
    return Chart(_spec({**spec, "lanes": lanes} if lanes != "step" else spec, title))


def handoffs(process: Node | Trace | str, title: str | None = None) -> Chart:
    run = process if isinstance(process, Trace) else trace(process)
    values = [_run(run, bool(run.time))]
    return Chart(_spec({"mark": "handoffs", "data": {"values": values}, "width": "container"}, title))


def icicle(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "actors",
    loops: str = "count",
    highlight: Node | str | None = None,
    title: str | None = None,
    height: int = 380,
    select: str | None = "click",
) -> Chart:
    return _corpus("icicle", data, title, select, level=level, loops=loops, highlight=highlight, height=height)


def variants(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "actors",
    loops: str = "count",
    highlight: Node | str | None = None,
    title: str | None = None,
    limit: int = 12,
    select: str | None = "click",
) -> Chart:
    return _corpus("variants", data, title, select, level=level, loops=loops, highlight=highlight, limit=limit)


def transitions(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "names",
    count: str = "steps",
    title: str | None = None,
    limit: int = 16,
    select: str | None = "click",
) -> Chart:
    return _corpus("transitions", data, title, select, level=level, count=count, limit=limit)


def graph(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "names",
    count: str = "steps",
    title: str | None = None,
    limit: int = 16,
    select: str | None = "click",
) -> Chart:
    return _corpus("graph", data, title, select, level=level, count=count, limit=limit)


def sankey(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "actors",
    loops: str = "count",
    title: str | None = None,
    limit: int = 8,
    height: int = 300,
    select: str | None = "click",
) -> Chart:
    return _corpus("sankey", data, title, select, level=level, loops=loops, limit=limit, height=height)


def activities(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "names",
    title: str | None = None,
    limit: int = 16,
    select: str | None = "click",
) -> Chart:
    return _corpus("activities", data, title, select, level=level, limit=limit)


def sequences(
    data: Runs | Mapping[str, Runs] | Diff,
    highlight: Node | str | None = None,
    title: str | None = None,
    limit: int = 50,
    x: str = "step",
    select: str | None = "click",
) -> Chart:
    if x not in AXES:
        raise ValueError(f"x must be one of {', '.join(AXES)}")
    return _corpus(
        "sequences", data, title, select, highlight=highlight, options={"x": x}, timed=x == "time", limit=limit
    )


def distribution(
    data: Runs | Mapping[str, Runs] | Diff,
    measure: str = "steps",
    highlight: Node | str | None = None,
    title: str | None = None,
    select: str | None = "click",
) -> Chart:
    if measure not in MEASURES:
        raise ValueError(f"measure must be one of {', '.join(MEASURES)}")
    return _corpus(
        "distribution",
        data,
        title,
        select,
        highlight=highlight,
        options={"measure": measure},
        timed=measure == "duration",
    )


def durations(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "names",
    title: str | None = None,
    limit: int = 16,
    select: str | None = "click",
) -> Chart:
    return _corpus("durations", data, title, select, level=level, timed=True, limit=limit)


def projection(
    data: Runs | Mapping[str, Runs] | Diff,
    level: str = "names",
    loops: str = "count",
    highlight: Node | str | None = None,
    title: str | None = None,
    height: int = 300,
    select: str | None = "click",
) -> Chart:
    return _corpus("projection", data, title, select, level=level, loops=loops, highlight=highlight, height=height)


MARKS = {
    "icicle": icicle,
    "variants": variants,
    "transitions": transitions,
    "graph": graph,
    "sankey": sankey,
    "activities": activities,
    "sequences": sequences,
    "distribution": distribution,
    "durations": durations,
    "projection": projection,
}
AXES = ("step", "time")
MEASURES = ("steps", "failures", "duration")
COUNTS = ("runs", "steps")
LANES = ("step", "agent")
EVENTS = ("click", "hover")
SELECTED = "selected"
GROUP = "group"
MAX_GROUPS = 2
STEP = {"params": [{"name": "step", "select": "hover"}], "highlight": {"param": "step"}}


def _corpus(
    mark: str,
    data,
    title: str | None,
    select: str | None,
    level: str | None = None,
    loops: str | None = None,
    count: str | None = None,
    highlight: Node | str | None = None,
    options: Mapping[str, str] | None = None,
    timed: bool = False,
    **counts: int,
) -> Chart:
    if level is not None:
        check(level, loops or LOOPS[0])
    if count is not None and count not in COUNTS:
        raise ValueError(f"count must be one of {', '.join(COUNTS)}")
    for key, value in counts.items():
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError(f"{key} must be a positive integer, found {value!r}")
    source = _data(data, timed)
    spec: dict = {"mark": mark, **counts, **(options or {})}
    if level is not None:
        spec["level"] = level
    if loops is not None and loops != LOOPS[0]:
        spec["loops"] = loops
    if count is not None and count != COUNTS[1]:
        spec["count"] = count
    if highlight is not None:
        spec["highlight"] = str(parse(highlight))
    if select is not None:
        if select not in EVENTS:
            raise ValueError(f"select must be one of {', '.join(EVENTS)}, or None")
        spec["params"] = [{"name": SELECTED, "select": select}]
        if highlight is None and mark != "icicle":
            spec["highlight"] = {"param": SELECTED}
    whole = {**source, "spec": spec} if "facet" in source else {**spec, **source}
    return Chart(_spec({**whole, "width": "container"}, title))


def report(data: Records | Corpus | Diff, trace: Mapping | None = None, title: str | None = None) -> Chart:
    if isinstance(data, (str, Path)) and Path(data).expanduser().is_dir():
        data = Corpus(read(data, trace))
    elif trace is not None and isinstance(data, (Corpus, Diff)):
        raise ValueError("trace maps records; a corpus is already traced")
    if isinstance(data, (Corpus, Diff)):
        runs = [*data] if isinstance(data, Corpus) else [*data.a, *data.b]
        timed = _timed(runs)
        source = _data(data, timed)
    else:
        values = list(records(data))
        timed = _timed(read(values, trace))
        source = {"data": {"values": values}, **({"trace": dict(trace)} if trace else {})}
    views = [*REPORT["views"], *([REPORT["timed"]] if timed else [])]
    return Chart(_spec({**source, "vconcat": views, "width": "container"}, title))


def _timed(runs: Iterable[Trace]) -> bool:
    return any(any(span is not None for span in run.time) for run in runs)


def vconcat(*charts: Chart, title: str | None = None) -> Chart:
    return Chart(_spec({"vconcat": _views(charts), "width": "container"}, title))


def hconcat(*charts: Chart, title: str | None = None) -> Chart:
    return Chart(_spec({"hconcat": _views(charts), "width": "container"}, title))


def _views(charts: tuple[Chart, ...]) -> list[dict]:
    if not charts:
        raise ValueError("expected at least one chart")
    nested = [chart for chart in charts if "mark" not in chart.spec]
    if nested:
        raise ValueError("views cannot be nested: vconcat and hconcat take charts with one mark")
    return [chart.spec for chart in charts]


def chart(subject, **options) -> Chart:
    match subject:
        case Trace(time=time) if time:
            return vconcat(
                diagram(subject).properties(**STEP), timeline(subject).properties(**STEP), title=_title(subject)
            )
        case Trace():
            return diagram(subject, title=_title(subject))
        case Corpus() | Diff():
            mark = options.pop("mark", "icicle")
            if mark not in MARKS:
                raise ValueError(f"mark must be one of {', '.join(MARKS)}")
            return MARKS[mark](subject, **options)
        case Node():
            return diagram(subject)
    raise TypeError(f"no chart for {type(subject).__name__}")


def _spec(spec: dict, title: str | None) -> dict:
    return {"title": title, **spec} if title else spec


def _title(run: Trace) -> str:
    agent = run.meta.get("agent")
    return f"trace {run.id}" + (f" · agent {agent}" if agent else "")


def _data(data, timed: bool) -> dict:
    if isinstance(data, Diff):
        data = {data.labels[0]: data.a, data.labels[1]: data.b}
    if isinstance(data, Mapping):
        if not data:
            raise ValueError("expected at least one group of runs")
        values = [{**_run(run, timed), GROUP: str(name)} for name, runs in data.items() for run in Corpus(runs)]
    else:
        values = [_run(run, timed) for run in Corpus(data)]
    groups = {run[GROUP] for run in values if GROUP in run}
    if len(groups) > MAX_GROUPS:
        return {"data": {"values": values}, "facet": {"field": GROUP}}
    return {"data": {"values": values}, **({"trace": {"group": GROUP}} if groups else {})}


def _inline(spec: dict) -> dict:
    loaded: dict[str, list] = {}

    def resolved(view: dict) -> dict:
        found = dict(view)
        data = found.get("data")
        if isinstance(data, dict) and _local(data.get("url")):
            url = data["url"]
            if url not in loaded:
                loaded[url] = list(records(url))
            found["data"] = {"values": loaded[url], **({"format": data["format"]} if "format" in data else {})}
        for key in ("vconcat", "hconcat"):
            if isinstance(found.get(key), list):
                found[key] = [resolved(part) if isinstance(part, dict) else part for part in found[key]]
        if isinstance(found.get("spec"), dict):
            found["spec"] = resolved(found["spec"])
        return found

    return resolved(spec)


def _local(url) -> bool:
    return isinstance(url, str) and Path(url).expanduser().is_file()


def _run(run: Trace, timed: bool) -> dict:
    found = {"id": run.id, "process": str(run.process)}
    if "group" in run.meta:
        found[GROUP] = run.meta["group"]
    return {**found, "time": _intervals(run)} if timed else found


def _intervals(run: Trace) -> list[list[float] | None]:
    if not run.time:
        return [None for _ in walk(run.process)]
    return [list(each) if each is not None else None for each in run.time]
