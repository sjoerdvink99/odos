import json
from pathlib import Path

import pytest

import tracegram

CASES = json.loads((Path(__file__).parents[2] / "grammar" / "tables.json").read_text())


def _traces(runs):
    for run in runs:
        process = tracegram.trace(run["process"]).process
        time = tuple(tuple(each) if each else None for each in run["time"])
        meta = {"group": run["group"]} if "group" in run else {}
        yield tracegram.Trace(process, run["id"], time, meta)


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_tables(case):
    found = tracegram.tables(_traces(case["runs"]))
    for name, rows in case["tables"].items():
        assert json.loads(getattr(found, name).to_json(orient="records")) == rows


DESIGN = (
    "model -> (tool.read | tool.write!)[1,3] -> agent.worker{ (model -> tool.search?){1,3} }?"
    " -> (model -> tool.edit){1,3} -> model"
)
ROLLUPS = [
    ("full", "names"),
    ("names", "actors"),
    ("full", "full_loops"),
    ("names", "names_loops"),
    ("actors", "actors_loops"),
]


@pytest.fixture(scope="module")
def sampled():
    return tracegram.tables(tracegram.sample(DESIGN, 60, seed=3))


@pytest.mark.parametrize("level", tracegram.LEVELS)
@pytest.mark.parametrize("loops", tracegram.LOOPS)
def test_runs_get_the_variant_their_abstraction_prints(level, loops):
    runs = tracegram.sample(DESIGN, 60, seed=3)
    found = tracegram.tables(runs)
    key = f"{level}_loops" if loops == "fold" else level
    labels = found.variants.set_index("variant")["label"]
    assert [labels[variant] for variant in found.runs[key]] == [
        str(tracegram.abstract(run.process, level, loops)) for run in runs
    ]


@pytest.mark.parametrize(("finer", "coarser"), ROLLUPS)
def test_variants_roll_up(sampled, finer, coarser):
    assert (sampled.runs.groupby(finer)[coarser].nunique() == 1).all()


def test_every_step_is_paired_both_ways(sampled):
    pairs = sampled.pairs
    for variant, index in sampled.steps[["variant", "index"]].itertuples(index=False):
        own = pairs[pairs.variant == variant]
        assert (own["to"] == index).any() and (own["from"] == index).any()
