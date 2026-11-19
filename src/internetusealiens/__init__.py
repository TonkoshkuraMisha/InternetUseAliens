"""CLI: `internetusealiens validate | build | serve`."""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import sys
from pathlib import Path

from .content import load_course, validate_course

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"
SITE = ROOT / "site"


def cmd_validate() -> int:
    errors = validate_course(CONTENT)
    for e in errors:
        print("ПОМИЛКА:", e)
    print("Контент валідний." if not errors else f"Помилок: {len(errors)}")
    return 1 if errors else 0


def cmd_build() -> int:
    if cmd_validate():
        return 1
    out = SITE / "course.json"
    out.write_text(json.dumps(load_course(CONTENT), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Збудовано {out}")
    return 0


def cmd_serve(port: int) -> int:
    if cmd_build():
        return 1
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
    print(f"http://localhost:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
    return 0


def main() -> None:
    p = argparse.ArgumentParser(prog="internetusealiens")
    p.add_argument("command", choices=["validate", "build", "serve"])
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args()
    code = {"validate": cmd_validate, "build": cmd_build}.get(a.command)
    sys.exit(code() if code else cmd_serve(a.port))
