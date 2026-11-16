---
hide:
  - navigation
  - toc
---

# Playground

Pick an example, or open or drop a file of your own runs: any [standard](standards.md), or records with a [`trace` mapping](data.md#trace). The file is read in this browser and never leaves it. Edit the spec and the view follows; download the figure, or copy a link that restores the spec.

<div class="tracegram-playground">
  <div class="tracegram-playground-bar">
    <select data-role="example" aria-label="Example"></select>
    <input type="file" accept=".json,.jsonl" data-role="file" hidden>
    <span class="tracegram-playground-actions">
      <button type="button" data-action="link">Copy link</button>
      <button type="button" data-action="svg">SVG</button>
      <button type="button" data-action="png">PNG</button>
      <button type="button" data-action="vega">Vega</button>
    </span>
  </div>
  <div class="tracegram-playground-panes">
    <textarea data-role="spec" spellcheck="false" aria-label="Spec"></textarea>
    <div data-role="view" class="tracegram-figure"></div>
  </div>
  <p data-role="status"></p>
</div>

The same spec renders with `npx tracegram view.json -o figure.svg`, in Python with `tracegram.Chart(spec).save("figure.pdf")`, and in TypeScript with `embed` or `render`.
