# tracegram

A grammar of agent processes, with declarative views compiled to Vega. Put your records in a JSON view spec, map their fields to traces in the grammar, and compile it to a [Vega](https://vega.github.io/vega/) spec that renders the same in a browser, Node or a notebook.

```bash
npm install tracegram
```

```ts
import { compile, embed, render } from "tracegram";

const svg = await render({ mark: "diagram", process: "(model -> tool[])* -> model" });

const view = await embed(element, {
  mark: "variants",
  data: { url: "events.jsonl" },
  trace: { run: "session", actor: "type", name: "tool", start: "at" },
  level: "names",
  params: [{ name: "picked", select: "click" }],
  highlight: { param: "picked" },
});
view.on("select", ({ picked }) => console.log(picked));

const vega = compile({ mark: "sequences", data: { values: spans } });
```

From the command line: a linked overview of a corpus, two corpora compared, a design as a diagram, and a compiled Vega spec.

```bash
npx tracegram report spans.jsonl -o report.html
npx tracegram report logs/model-a.eval logs/model-b.eval
npx tracegram "(model -> tool[])* -> model" -o loop.svg
npx tracegram view.json --vega -o view.vg.json
```

Documentation: <https://sjoerdvink99.github.io/tracegram/> · Source: <https://github.com/sjoerdvink99/tracegram>

If tracegram helps your research, please cite it: see <https://sjoerdvink99.github.io/tracegram/#cite>.
