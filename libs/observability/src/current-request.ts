import { Context } from "effect";

import type { Correlation } from "./protocol.ts";

interface RequestContext extends Correlation {
  readonly traceparent: string;
}

class CurrentRequest extends Context.Service<CurrentRequest, RequestContext>()(
  "@repo/observability/CurrentRequest",
) {}

export { CurrentRequest };
export type { RequestContext };
