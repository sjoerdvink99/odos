.PHONY: install build test lint generated examples benchmarks check docs serve figures

install:
	cd js && npm ci && npm run build
	python -m pip install -e "./python[dev,docs,notebook]"

build:
	cd js && npm run schema && npm run build

test:
	cd js && npm run coverage
	python -m pytest python/tests --cov=tracegram --cov-report=term:skip-covered --cov-fail-under=96

lint:
	cd js && npm run typecheck && npm run lint
	ruff check python examples
	ruff format --check python examples
	pyright -p python

generated: build
	git diff --exit-code -- grammar/view.schema.json python/src/tracegram/static docs/javascripts

examples:
	cd examples/explorer && npm install && npm run build
	cd examples/node && npm install && npm run typecheck && npx tsx report.ts ../data/copilot-model-a.jsonl ../data/copilot-model-a.jsonl "$$(mktemp -d)"
	cd examples/benchmarks && npm install && npm run typecheck

benchmarks:
	cd examples/benchmarks && npm install && npx tsx scale.ts
	python examples/benchmarks/agreement.py

check: lint test generated examples

docs:
	zensical build --clean --strict

serve:
	zensical serve

figures:
	cd examples && python figures.py
