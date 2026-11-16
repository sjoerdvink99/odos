import sys
import tempfile
from collections import Counter
from pathlib import Path

import pm4py

import tracegram

ROOT = Path(__file__).parents[2]
CORPORA = {
    "coding": (
        ROOT / "docs" / "assets" / "coding.jsonl",
        {"run": "session", "actor": "type", "name": "tool", "start": "start", "end": "end"},
    ),
    "swe-agent": (ROOT / "docs" / "assets" / "swe-agent.jsonl", {"run": "run", "actor": "actor", "name": "tool"}),
    "crew": (
        ROOT / "docs" / "assets" / "crew.jsonl",
        {
            "run": "trace",
            "step": "id",
            "parent": "parent",
            "actor": "kind",
            "name": "name",
            "start": "start",
            "end": "end",
        },
    ),
}


def label(step) -> str:
    return f"{step.actor}.{step.name}" if isinstance(step.name, str) else step.actor


def ours(runs: list[tracegram.Trace]) -> tuple[Counter, Counter, set[str]]:
    found = tracegram.tables(runs)
    weight = found.runs.groupby("full").size()
    labels = {(step.variant, step.index): label(step) for step in found.steps.itertuples()}
    walks = found.steps.groupby("variant")["index"].apply(list)
    variants = Counter(
        {tuple(labels[(variant, index)] for index in walks[variant]): int(count) for variant, count in weight.items()}
    )
    inner = found.pairs[(found.pairs["from"] >= 0) & (found.pairs["to"] >= 0)]
    pairs = Counter()
    for variant, earlier, later in inner.itertuples(index=False):
        pairs[(labels[(variant, earlier)], labels[(variant, later)])] += int(weight[variant])
    forks = found.pairs.groupby(["variant", "from"])["to"].transform("size") > 1
    joins = found.pairs.groupby(["variant", "to"])["from"].transform("size") > 1
    concurrent = {
        *zip(found.pairs.variant[forks], found.pairs["to"][forks], strict=True),
        *zip(found.pairs.variant[joins], found.pairs["from"][joins], strict=True),
    }
    nested = {(step.variant, step.index) for step in found.steps.itertuples() if step.depth > 0}
    holding = {(step.variant, step.parent) for step in found.steps.itertuples() if step.parent >= 0}
    structured = {labels[key] for key in (concurrent | nested | holding) if key in labels}
    return variants, pairs, structured


def theirs(runs: list[tracegram.Trace]) -> tuple[Counter, Counter]:
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "log.xes"
        path.write_text(tracegram.to_xes(runs))
        log = pm4py.read_xes(str(path), show_progress_bar=False)
    variants = Counter({tuple(variant): int(count) for variant, count in pm4py.get_variants(log).items()})
    graph, _, _ = pm4py.discover_dfg(log)
    return variants, Counter({pair: int(count) for pair, count in graph.items()})


HEADER = ["corpus", "runs", "variants agree", "directly-follows pairs agree", "every difference is parallel or nested"]


def row(cells: list) -> str:
    return "| " + " | ".join(map(str, cells)) + " |"


def main() -> int:
    print(row(HEADER))
    print(row(["---"] * len(HEADER)))
    unexplained = False
    for name, (path, trace) in CORPORA.items():
        runs = tracegram.read(path, trace)
        (our_variants, our_pairs, structured), (their_variants, their_pairs) = ours(runs), theirs(runs)
        every = our_pairs.keys() | their_pairs.keys()
        differing = {pair for pair in every if our_pairs[pair] != their_pairs[pair]}
        explained = all(set(pair) & structured for pair in differing) and (
            our_variants == their_variants or bool(structured)
        )
        unexplained |= not explained
        agreeing = f"{len(every) - len(differing)} of {len(every)}"
        print(row([name, len(runs), our_variants == their_variants, agreeing, explained]))
    return int(unexplained)


if __name__ == "__main__":
    sys.exit(main())
