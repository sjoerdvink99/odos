from __future__ import annotations

import atexit
import re
from functools import cache
from pathlib import Path

LIBRARY = Path(__file__).parent / "static" / "tracegram.min.js"
INSTALL = "saving figures needs the save extra: pip install 'tracegram[save]'"
THROWN = re.compile(r"^\w*Error: (.+)$", re.MULTILINE)


@cache
def _context():
    try:
        from py_mini_racer import MiniRacer
    except ImportError as error:
        raise ImportError(INSTALL) from error
    context = MiniRacer()
    atexit.register(context.close)
    context.eval(LIBRARY.read_text())
    return context


def to_vega(spec: dict) -> dict:
    context = _context()
    from py_mini_racer import JSEvalException

    try:
        return dict(context.call("tracegram.compile", spec))
    except JSEvalException as error:
        found = THROWN.search(str(error))
        raise ValueError(found.group(1) if found else str(error)) from None


def svg(vega: dict) -> str:
    return _converter().vega_to_svg(vega)


def png(vega: dict, scale: float) -> bytes:
    return _converter().vega_to_png(vega, scale=scale)


def pdf(vega: dict) -> bytes:
    return _converter().vega_to_pdf(vega)


def _converter():
    try:
        import vl_convert
    except ImportError as error:
        raise ImportError(INSTALL) from error
    return vl_convert
