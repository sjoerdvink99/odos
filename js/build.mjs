import { execFileSync } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";
import { build } from "esbuild";

const common = { bundle: true, target: "es2022", minify: true, legalComments: "none" };
const node = { ...common, format: "esm", platform: "node", minify: false, external: ["canvas"], banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } };
const python = "../python/src/tracegram/static";

await rm("dist", { recursive: true, force: true });

await Promise.all([
  build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/index.js", external: ["vega"] }),
  build({ ...common, entryPoints: ["src/index.ts"], format: "iife", globalName: "tracegram", outfile: "dist/tracegram.min.js" }),
  build({ ...node, entryPoints: ["src/cli.ts"], outfile: "dist/cli.js", external: ["vega", "canvas"] }),
  build({ ...common, entryPoints: ["src/widget.ts"], format: "esm", outfile: `${python}/widget.js` }),
  build({ ...common, entryPoints: ["src/index.ts"], format: "iife", globalName: "tracegram", outfile: `${python}/tracegram.min.js` }),
  build({ ...common, entryPoints: ["docs/views.ts"], format: "iife", outfile: "../docs/javascripts/views.js" }),
]);

await Promise.all([
  copyFile("../grammar/conventions.json", `${python}/conventions.json`),
  copyFile("../grammar/report.json", `${python}/report.json`),
  copyFile("../grammar/view.schema.json", "dist/view.schema.json"),
]);

execFileSync("npx", ["dts-bundle-generator", "--silent", "--no-banner", "--project", "tsconfig.build.json", "-o", "dist/index.d.ts", "src/index.ts"], { stdio: "inherit" });
