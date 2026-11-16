import layout from "../../grammar/report.json";
import { compile, embed, report, type Spec, type View } from "../src";
import { records } from "../src/standards/records";

const CODING = { url: "../assets/coding.jsonl" };
const SWE_AGENT = { url: "../assets/swe-agent.jsonl" };
const CREW = { url: "../assets/crew.jsonl" };
const SESSIONS = { run: "session", actor: "type", name: "tool", start: "start", end: "end", failed: "error" };
const SPANS = { run: "trace", step: "id", parent: "parent", actor: "kind", name: "name", start: "start", end: "end", failed: "error" };
const TRAJECTORIES = { run: "run", actor: "actor", name: "tool", failed: "failed", group: "outcome" };

const EXAMPLES: Record<string, object> = {
  "A report of 16 coding sessions, before and after": { data: CODING, trace: { ...SESSIONS, group: "version" }, vconcat: [...layout.views, layout.timed] },
  "Variants of 400 SWE-agent runs, by outcome": { mark: "variants", level: "names", limit: 10, data: SWE_AGENT, trace: TRAJECTORIES },
  "Which step follows which": { mark: "transitions", data: CODING, trace: SESSIONS },
  "Runs merged by shared prefix": { mark: "icicle", level: "names", highlight: "tool! -> model", data: CODING, trace: SESSIONS },
  "A multi-agent run in lanes": { mark: "timeline", lanes: "agent", data: CREW, trace: SPANS },
  "A design as a railroad diagram": {
    mark: "diagram",
    process: "model.plan(=> task:text[]) -> agent.worker{ (model -> tool[])* -> model }[] -> model.synthesize",
  },
};

const HASH = "#spec=";
const PAUSE = 400;

type Item = Record<string, unknown>;

const role = <T extends HTMLElement>(root: HTMLElement, name: string) => root.querySelector(`[data-role="${name}"]`) as T;

const blob = (content: string, type: string) => URL.createObjectURL(new Blob([content], { type }));

function formatted(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function download(name: string, href: string): void {
  Object.assign(document.createElement("a"), { download: name, href }).click();
}

export function playground(root: HTMLElement): Promise<void> {
  const [example, file, spec, view, status] = (["example", "file", "spec", "view", "status"] as const).map((name) => role(root, name));
  const [picker, input, editor] = [example as HTMLSelectElement, file as HTMLInputElement, spec as HTMLTextAreaElement];
  const files = new Map<string, unknown[]>();
  let shown: View | null = null;
  let drawing = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const resolved = (item: Item): Item => {
    const found = { ...item };
    const data = found.data as { url?: string; format?: string } | undefined;
    if (data?.url && files.has(data.url)) found.data = { values: files.get(data.url), ...(data.format ? { format: data.format } : {}) };
    for (const key of ["vconcat", "hconcat"]) if (Array.isArray(found[key])) found[key] = (found[key] as Item[]).map(resolved);
    if (typeof found.spec === "object" && found.spec !== null) found.spec = resolved(found.spec as Item);
    return found;
  };

  const current = (): Spec => resolved(JSON.parse(editor.value)) as unknown as Spec;

  const tell = (message: string, failed = false) => {
    status.textContent = message;
    status.className = failed ? "tracegram-error" : "";
  };

  const draw = (): Promise<void> =>
    (drawing = drawing.then(async () => {
      shown?.destroy();
      shown = null;
      try {
        shown = await embed(view, { width: "container", ...current() } as Spec);
        tell(files.size ? "Your file is read in this browser and never leaves it." : "");
      } catch (error) {
        tell(error instanceof Error ? error.message : String(error), true);
      }
    }));

  const show = (value: object) => {
    editor.value = JSON.stringify(value, null, 2);
    return draw();
  };

  const open = async (chosen: File) => {
    const values = records(await chosen.text());
    files.set(chosen.name, values);
    picker.value = "";
    await show({ data: { url: chosen.name }, vconcat: report({ values }).vconcat });
  };

  const actions: Record<string, () => Promise<void>> = {
    async link() {
      history.replaceState(null, "", `${HASH}${encodeURIComponent(JSON.stringify(JSON.parse(editor.value)))}`);
      await navigator.clipboard?.writeText(location.href);
      tell(files.size ? "Link copied. It holds the spec, not your file." : "Link copied.");
    },
    async svg() {
      if (shown) download("tracegram.svg", blob(await shown.toSVG(), "image/svg+xml"));
    },
    async png() {
      if (shown) download("tracegram.png", await shown.vega.toImageURL("png", 2));
    },
    async vega() {
      download("tracegram.vg.json", blob(JSON.stringify(compile(current()), null, 2), "application/json"));
    },
  };

  picker.append(new Option("Open a file of your own…", ""), ...Object.keys(EXAMPLES).map((name) => new Option(name, name)));
  picker.addEventListener("change", () => (picker.value ? void show(EXAMPLES[picker.value]) : input.click()));
  input.addEventListener("change", () => input.files?.[0] && void open(input.files[0]));
  root.addEventListener("dragover", (event) => event.preventDefault());
  root.addEventListener("drop", (event) => {
    event.preventDefault();
    const dropped = event.dataTransfer?.files[0];
    if (dropped) void open(dropped);
  });
  editor.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(draw, PAUSE);
  });
  root
    .querySelectorAll<HTMLButtonElement>("button[data-action]")
    .forEach((button) => button.addEventListener("click", () => void actions[button.dataset.action ?? ""]().catch((error) => tell(String(error), true))));

  if (location.hash.startsWith(HASH)) {
    editor.value = formatted(decodeURIComponent(location.hash.slice(HASH.length)));
    return draw();
  }
  const [first] = Object.keys(EXAMPLES);
  picker.value = first;
  return show(EXAMPLES[first]);
}
