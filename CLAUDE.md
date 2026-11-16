# tracegram

A grammar of agent processes, with declarative views compiled to Vega. The grammar is a formal language: one syntax for a run (trace), every run a system allows (design) and a pattern to find (query). The view language over it is declarative but not a grammar of graphics: a fixed set of thirteen views: a design, one run, or a corpus, where every corpus view is a defined aggregation of traces. Call the expression language "the grammar", the JSON "the view spec", and `mark` values "views"; never call the view language a grammar. A JSON view spec holds the records (`data`), maps their fields to the grammar (`trace`), and describes a figure; the figure is a pure function of the spec. The grammar is the center: everything else reads into it, renders from it, or writes out of it. Like Vega-Lite, views compile to Vega: tracegram maps records to traces, abstracts runs and lays out railroad diagrams, Vega does the aggregation, layout, scales, guides, rendering and interaction. `docs/aggregation.md` defines what every view counts: abstract (`transform`, `trace.name`, `level`, `loops`), read (path, steps or pairs), count (runs, share, steps, per run), rank and fold.

## Layout

- `grammar/`: the shared contract. `fixtures.json` (grammar), `tables.json` (the tables of a corpus), `standards.json` (readers), `mappings.json` (records → traces by a `trace` mapping), `specs.json` (view specs), `conventions.json` (telemetry → actor mapping), `report.json` (the views of a report), `inspect.eval` (an Inspect AI archive both suites read), `view.schema.json` (generated from `js/src/spec.ts`).
- `js/`: the `tracegram` npm package and the only compiler. `src/grammar` (parse, print, trace, match, abstract), `src/data` (`tables.ts`: the six tables of a corpus; `corpus.ts` loads and memoizes them; `transform.ts` filters records), `src/compile` (`index.ts` composes views, `unit.ts` is the contract a mark compiles against, `corpus.ts` the shared corpus dataflow, `focus.ts` the run a single-run mark draws, `follows.ts` the pair dataflow, `tooltip.ts`, `expr.ts`), `src/marks` (one file per mark), `spec.ts`, `validate.ts`, `config.ts` (theme to Vega config), `runtime.ts` (a checked Vega view), `load.ts` (fetches `data.url`), `render.ts`, `embed.ts`, `report.ts`, `standards/` (readers, and `mapping.ts` for the `trace` mapping), `cli.ts` with `files.ts` (Node-only: folders, `.eval` archives, sub-agent sessions, as Python's `records.load`), `widget.ts`.
- `python/`: the `tracegram` PyPI package (`import tracegram`): grammar, corpus analysis, readers and exports, and chart builders whose widget uses the built JS in `python/src/tracegram/static`; `engine.py` runs that same bundle in an embedded V8 to compile, and vl-convert renders figures (the `save` extra).
- `examples/`: notebooks, a TypeScript explorer, a Node regression report, a plain web page, benchmarks (`make benchmarks`).
- `docs/`: the site (`mkdocs.yml`, built with zensical). Every ` ```tracegram ` block is a live view and is rendered by `js/test/docs.test.ts`. `js/docs/` holds its script: live views and the playground.
- `skills/tracegram/SKILL.md`: an Agent Skill; `docs.test.ts` validates its specs.

## Marks

`diagram`, `timeline` (`lanes`: step or agent), `handoffs`, `icicle`, `variants`, `transitions`, `graph`, `sankey`, `activities`, `sequences`, `distribution`, `durations`, `projection`, composed with `vconcat` and `hconcat`, and split into panels with `facet`. Each comes from a view in the agent or event-sequence visualization literature; the docs gallery shows them and maps each category of agent visualization to its mark.

## Commands

- `make install`: build the JS library and install the Python package with its dev, docs and notebook extras.
- `make test`: both test suites, with coverage thresholds. `make lint`: typecheck, ESLint, Prettier, ruff, pyright. `make check`: lint, test, generated files up to date, examples build.
- `make build`: regenerate the schema, the bundles and `python/src/tracegram/static` after changing `js/`. Needs Node 22+ (`.nvmrc`).
- `cd js && npm run format`: apply Prettier. `make docs` / `make serve`: build or serve the docs.

## Rules

- No comments in code. Name things so they read well.
- Frontend code is TypeScript, never JavaScript.
- Python and TypeScript agree: any grammar, reader, mapping or spec change gets a case in `grammar/*.json` that both suites run.
- Stability first: invalid input raises `ParseError`, `SpecError`, `TraceError` or `TypeError` with a location; readers skip what they cannot read; every valid spec renders, finite and well-formed; Vega errors are thrown, never drawn.
- Vega first: counting, ranking, layout, guides and interaction belong in the compiled Vega spec; precompute in TypeScript only what needs the grammar. The compiled spec stays portable: no custom Vega functions.
- Views read tables, never the grammar: a corpus is `runs` (one variant column per abstraction, `full` to `actors_loops`), `variants` (each distinct path once, shared by abstractions), `tokens`, `steps`, `pairs` (the covering relation of each trace's order; parallel branches never pair) and `times` (`data/tables.ts`, mirrored in `python/src/tracegram/tables.py`), shipped once per data source. A view's Vega dataflow starts from `active` (`base`), joins runs to per-variant rows with `joined`, and labels steps with `stepsAt`; layout tables keyed per abstraction carry `level: ordinal(key)` and filter with `atLevel`; TypeScript computes from the tables only layout that must stay put under interaction. ESLint forbids grammar imports in `src/marks` except `diagram.ts`. Never emit rows per run and step, and project before writing formulas on a table, since sourced Vega data shares its rows.
- Steps carry no ids: a step is its position in the trace's walk, a step before its body.
- Reuse the compile building blocks before writing Vega by hand: `scopeOf`, `base`, `joined`, `stepsAt`, `table`, `counted`, `weigh`, `tally`, `ranked`, `perRun`, `perLevel`, `atLevel`, `ordinal`, `swatches`, `gradient` and `divergence` in `compile/corpus.ts`; `membership`, `band`, `dim` and `hit` in `compile/unit.ts`; `focus`, `ofVariant`, `matched` and `actorsShown` in `compile/focus.ts` for marks that draw one run; `byVariant`, `variantsAt`, `labelOf` and `clockOf` in `data/tables.ts`. Join tables on `run` (a position), select on `id`.
- Vega names: mark names end in `_mark` (`unit.mark(role)`), since Vega puts mark and data names in one namespace; never name a signal `width` or `height`.
- Keep it lean: no unused exports, files or dependencies; the public API is what `js/src/index.ts` and `python/src/tracegram/__init__.py` export.
- A new view property goes in `js/src/spec.ts`, `js/src/validate.ts` and `grammar/specs.json`, then `make build`.
- A new mark also needs `js/src/marks/<mark>.ts` returning a `Part` whose selectable marks carry `ids` (run or step ids), a tooltip and `matching` under a highlight, its tooltip fields in `FIELDS` in `js/src/validate.ts`, an entry in `MARKS` in `js/src/compile/index.ts`, `DEFAULT_LEVEL` in `js/src/compile/corpus.ts` when it has `level` and `FOLDING` when it reads paths, a builder in `python/src/tracegram/chart.py` and `MARKS`, a section in `docs/views.md`, a row in `docs/vega.md`, an entry in `docs/gallery.md`, and, for a corpus mark, a measure in `js/test/aggregation.test.ts` and a row in the per-mark table of `docs/aggregation.md`.
- Keep the docs and READMEs in step with the code, and concise.
- Never credit Claude in commits or pull requests.
