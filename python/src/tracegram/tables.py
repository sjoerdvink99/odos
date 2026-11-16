from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from itertools import count

import pandas as pd

from .abstract import LEVELS, LOOPS, abstract, fold, project
from .syntax import Node, Par, Seq, Step, children
from .trace import Trace, trace

OUTSIDE = -1


def abstraction(level: str, loops: str) -> str:
    return f"{level}_loops" if loops == "fold" else level


ABSTRACTIONS = tuple(abstraction(level, loops) for loops in LOOPS for level in LEVELS)

COLUMNS = {
    "runs": ["run", "id", "group", *ABSTRACTIONS],
    "variants": ["variant", "label", "length"],
    "tokens": ["variant", "index", "token", "actors", "failed"],
    "steps": ["variant", "index", "depth", "parent", "actor", "name", "signature", "failed"],
    "pairs": ["variant", "from", "to"],
    "times": ["run", "index", "start", "end"],
}


@dataclass(frozen=True)
class Tables:
    runs: pd.DataFrame
    variants: pd.DataFrame
    tokens: pd.DataFrame
    steps: pd.DataFrame
    pairs: pd.DataFrame
    times: pd.DataFrame


def sequence(node: Node, level: str, loops: str = "count") -> tuple[Node, ...]:
    shaped = abstract(node, level, loops) if loops == "fold" else project(node, level)
    items = shaped.items if isinstance(shaped, Seq) else (shaped,)
    return items if loops == "fold" else tuple(map(fold, items))


def _pairs(node: Node) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    counter = count()

    def link(earlier: list[int], later: list[int]) -> None:
        found.extend((a, b) for a in earlier for b in later)

    def visit(current: Node) -> tuple[list[int], list[int]]:
        match current:
            case Step():
                at = next(counter)
                first, last = visit(current.body) if current.body is not None else ([], [])
                link([at], first)
                return [at], last or [at]
            case Seq():
                ends: tuple[list[int], list[int]] = ([], [])
                for item in current.items:
                    after = visit(item)
                    if not ends[0]:
                        ends = after
                    elif after[0]:
                        link(ends[1], after[0])
                        ends = (ends[0], after[1])
                return ends
            case Par():
                branches = [visit(branch) for branch in current.branches]
                return [a for first, _ in branches for a in first], [b for _, last in branches for b in last]
        return [], []

    first, last = visit(node)
    link([OUTSIDE], first)
    link(last, [OUTSIDE])
    return found


def actors_of(node: Node) -> list[str]:
    if isinstance(node, Step):
        return [node.actor]
    return list(dict.fromkeys(actor for child in children(node) for actor in actors_of(child)))


def failed(node: Node) -> bool:
    return (isinstance(node, Step) and node.failed) or any(map(failed, children(node)))


def tables(runs: Iterable[Trace | Node | str]) -> Tables:
    traced = [run if isinstance(run, Trace) else trace(run, id=str(k)) for k, run in enumerate(runs)]
    found: dict[str, list[dict]] = {name: [] for name in COLUMNS}
    known: dict[tuple[str, tuple[str, ...]], int] = {}
    assigned = {
        abstraction(level, loops): [_variant(run.process, level, loops, known, found) for run in traced]
        for loops in LOOPS
        for level in LEVELS
    }
    for index, run in enumerate(traced):
        columns = {key: assigned[key][index] for key in ABSTRACTIONS}
        found["runs"].append({"run": index, "id": run.id, "group": run.meta.get("group"), **columns})
        for position, interval in enumerate(run.time):
            if interval is not None:
                found["times"].append({"run": index, "index": position, "start": interval[0], "end": interval[1]})
    return Tables(**{name: pd.DataFrame(rows, columns=pd.Index(COLUMNS[name])) for name, rows in found.items()})


def _variant(node: Node, level: str, loops: str, known: dict, found: dict[str, list[dict]]) -> int:
    key = abstraction(level, loops)
    items = sequence(node, level, loops)
    identity = tuple(map(str, items))
    if identity in known:
        return known[identity]
    variant = known[identity] = len(found["variants"])
    label = str(abstract(node, level, loops))
    found["variants"].append({"variant": variant, "label": label, "length": len(items)})
    for index, item in enumerate(items):
        token = {"token": str(item), "actors": actors_of(item), "failed": failed(item)}
        found["tokens"].append({"variant": variant, "index": index, **token})
    if key == "full":
        found["steps"] += [{"variant": variant, "index": index, **row} for index, row in enumerate(_walked(node))]
        found["pairs"] += [{"variant": variant, "from": a, "to": b} for a, b in _pairs(node)]
    return variant


def _walked(node: Node) -> list[dict]:
    found: list[dict] = []

    def visit(current: Node, depth: int, parent: int) -> None:
        if isinstance(current, Step):
            signature = str(current.sig) if current.sig is not None else None
            fields = {"actor": current.actor, "name": current.name, "signature": signature, "failed": current.failed}
            found.append({"depth": depth, "parent": parent, **fields})
            if current.body is not None:
                visit(current.body, depth + 1, len(found) - 1)
            return
        for child in children(current):
            visit(child, depth, parent)

    visit(node, 0, -1)
    return found
