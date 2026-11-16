from pathlib import Path

import tracegram

HERE = Path(__file__).parent
DATA = HERE / "data"
FIGURE = HERE.parent / "docs" / "figures" / "difference.svg"


def main() -> None:
    old = tracegram.Corpus(tracegram.read(DATA / "copilot-model-a.jsonl"), "model-a")
    new = tracegram.Corpus(tracegram.read(DATA / "copilot-model-b.jsonl"), "model-b")
    chart = tracegram.icicle({"model-a": old, "model-b": new}, level="names", title="Same harness, two models")
    chart.spec = {**chart.spec, "width": 900}
    chart.save(FIGURE)


if __name__ == "__main__":
    main()
