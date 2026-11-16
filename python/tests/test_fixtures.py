import json
from pathlib import Path

import pytest

import tracegram

FIXTURES = json.loads((Path(__file__).parents[2] / "grammar" / "fixtures.json").read_text())


@pytest.mark.parametrize("text", FIXTURES["roundtrip"])
def test_roundtrip(text):
    assert str(tracegram.parse(text)) == text


@pytest.mark.parametrize(("text", "expected"), FIXTURES["canonical"])
def test_canonical(text, expected):
    assert str(tracegram.parse(text)) == expected


@pytest.mark.parametrize("text", FIXTURES["errors"])
def test_errors(text):
    with pytest.raises(tracegram.ParseError):
        tracegram.parse(text)


@pytest.mark.parametrize(("text", "count"), FIXTURES["traces"])
def test_traces(text, count):
    if count is None:
        with pytest.raises(tracegram.TraceError):
            tracegram.trace(text)
    else:
        assert len(list(tracegram.trace(text).steps())) == count


@pytest.mark.parametrize(("run", "spec", "expected"), FIXTURES["conforms"])
def test_conforms(run, spec, expected):
    assert tracegram.conforms(run, spec) is expected


@pytest.mark.parametrize(("run", "query", "expected"), FIXTURES["find"])
def test_find(run, query, expected):
    assert [hit.text for hit in tracegram.find(run, query)] == expected


@pytest.mark.parametrize(("run", "query", "expected"), FIXTURES["positions"])
def test_positions(run, query, expected):
    assert [list(hit.steps) for hit in tracegram.find(run, query)] == expected


@pytest.mark.parametrize(("run", "expected"), FIXTURES["fold"])
def test_fold(run, expected):
    assert str(tracegram.fold(tracegram.trace(run).process)) == expected


@pytest.mark.parametrize(("run", "level", "loops", "expected"), FIXTURES["abstract"])
def test_abstract(run, level, loops, expected):
    process = tracegram.trace(run).process
    assert str(tracegram.abstract(process, level, loops)) == expected
    assert tracegram.conforms(process, expected)


@pytest.mark.parametrize(("spec", "level", "loops", "expected"), FIXTURES["designs"])
def test_designs(spec, level, loops, expected):
    assert str(tracegram.abstract(spec, level, loops)) == expected


def test_abstract_rejects_an_unknown_level():
    with pytest.raises(ValueError, match="level"):
        tracegram.abstract("model", "everything")


def test_abstract_rejects_unknown_loops():
    with pytest.raises(ValueError, match="loops"):
        tracegram.abstract("model", "names", "sometimes")
