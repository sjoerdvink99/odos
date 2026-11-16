# Contributing

Thanks for helping. Bug reports, new readers, new marks and docs fixes are all welcome.

## Set up

You need Node 22+ (see `.nvmrc`) and Python 3.10+. `make check` runs what CI runs.

```bash
git clone https://github.com/sjoerdvink99/tracegram && cd tracegram
python -m venv .venv && source .venv/bin/activate
make install
make check
```

## Where things live

| | |
|---|---|
| `grammar/` | the contract both languages pass: `fixtures.json` (grammar), `tables.json` (tables), `standards.json` (readers), `specs.json` (views), `conventions.json` (telemetry to actors) |
| `js/src/` | `tracegram`: grammar, the view compiler to Vega, marks, `render`, `embed`, readers, CLI |
| `python/src/tracegram/` | `tracegram`: grammar, corpus analysis, readers, exports, notebook charts |
| `docs/` | the site and its playground, built with `make docs` |
| `skills/tracegram/` | an Agent Skill for writing and rendering views |

## Tests

`make test` runs both suites and fails below their coverage thresholds (`js/vitest.config.ts` and the `Makefile`); `make check` adds lint, generated files and examples, as CI does.

| Suite | Holds |
|---|---|
| `grammar/*.json` | the cases both languages pass: parsing, printing, matching, abstraction, the tables, readers, mappings and view specs |
| `js/test/aggregation.test.ts` | every corpus mark's counts against the grammar, at every level, with groups, a selection and a query |
| `js/test/tables.test.ts`, `python/tests/test_tables.py` | the tables of `grammar/tables.json` in both languages |
| `js/test/scale.test.ts` | that a compiled spec grows with distinct variants, not with runs times steps |
| `js/test/random.test.ts` | random expressions and corpora round-trip, match their own traces and render finitely |
| `js/test/docs.test.ts` | every `tracegram` block in the docs renders, and every spec of the Agent Skill validates |
| `js/test/render.test.ts`, `embed.test.ts`, `cli.test.ts`, `files.test.ts` | the dataflow, interaction, the widget, the playground, the CLI and the files it reads |
| `python/tests/` | the Python grammar, corpus analysis, readers, exports, charts and saved figures |

A change to how a mark counts keeps `aggregation.test.ts` green; a new corpus mark adds its measure there.

## Rules

1. **Python and TypeScript agree.** A change to the grammar, a reader or a spec comes with a case in `grammar/*.json`. Both suites run it.
2. **Stability first.** Invalid input raises `ParseError`, `SpecError`, `TraceError` or `TypeError` with a location. Readers skip what they don't recognise. Every valid spec renders.
3. **Views read tables.** A view is a Vega dataflow over the tables in `js/src/data/tables.ts`; it never imports the grammar (ESLint checks this), and never writes rows per run and step.
4. **A new view property** goes in `js/src/spec.ts`, `js/src/validate.ts` and `grammar/specs.json`, then `make build` to regenerate the schema and bundles. Commit the generated files.
5. **A new telemetry dialect** is usually a rule in `grammar/conventions.json` plus a real-shaped case in `grammar/standards.json`, with no code.
6. **Style.** TypeScript, not JavaScript. No comments in code: name things so they read well. `make lint` must pass.
7. **Docs.** Keep the docs and READMEs in step with the code, and short.

## Pull requests

Keep a pull request to one change, add the tests that prove it, and note user-facing changes in `CHANGELOG.md` under *Unreleased*. CI must be green.

By contributing you agree that your work is released under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
