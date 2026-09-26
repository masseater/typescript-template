import { Context } from "effect";

import type { Correlation } from "./protocol.ts";
type RequestContext = {
  readonly traceparent: string;
} & Correlation;
class CurrentRequest extends Context.Service<CurrentRequest, RequestContext>()(
  "@repo/observability/features/observability/current-request/CurrentRequest",
) {}
export { CurrentRequest };
export type { RequestContext };
