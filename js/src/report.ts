import layout from "../../grammar/report.json";
import type { InlineData, Mapping, UnitSpec, VConcatSpec, Views } from "./spec";
import { traced } from "./standards/read";
import { checkMapping } from "./validate";

export function report(data: InlineData, trace?: Mapping): VConcatSpec {
  const how = trace ? checkMapping(trace, "trace") : {};
  const timed = traced(data.values, data.format, how).some((run) => run.time.some(Boolean));
  const views = [...layout.views, ...(timed ? [layout.timed] : [])] as UnitSpec[] as Views;
  return { data, ...(trace ? { trace } : {}), vconcat: views };
}
