import { context, propagation, trace, TraceFlags } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { definedEnvironment } from "@repo/config/process-environment";
import { describe, expect, test } from "vite-plus/test";

import { environmentCarryingContext, inheritedContext } from "./context-carrier.ts";

const INHERITED_TRACE_ID = "1".repeat(32);

const INHERITED_SPAN_ID = "2".repeat(16);

const INHERITED_TRACEPARENT = `00-${INHERITED_TRACE_ID}-${INHERITED_SPAN_ID}-01`;

const ACTIVE_TRACE_ID = "3".repeat(32);

const ACTIVE_SPAN_ID = "4".repeat(16);

describe("inheritedContext", () => {
  const propagating = test.extend("propagation", { auto: true }, ({}, { onCleanup }) => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    onCleanup(() => {
      context.disable();
      propagation.disable();
    });
  });

  describe("an environment carrying a trace context", () => {
    const it = propagating.extend("inheritedSpanContext", () =>
      trace.getSpanContext(inheritedContext({ TRACEPARENT: INHERITED_TRACEPARENT })),
    );

    it("names the span the caller was started from", ({ inheritedSpanContext }) => {
      expect(inheritedSpanContext).toStrictEqual({
        traceId: INHERITED_TRACE_ID,
        spanId: INHERITED_SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      });
    });
  });

  describe("an environment carrying no trace context", () => {
    const it = propagating.extend("spanContextInheritedFromNothing", () =>
      trace.getSpanContext(inheritedContext({ MST_TELEMETRY: "1" })),
    );

    it("names no span at all", ({ spanContextInheritedFromNothing }) => {
      expect(spanContextInheritedFromNothing).toBe(undefined);
    });
  });

  describe("the environment of the process", () => {
    const it = propagating
      .extend("spanContextInheritedFromTheProcess", () => trace.getSpanContext(inheritedContext()))
      .extend("spanContextInheritedFromItsDefinedValues", () =>
        trace.getSpanContext(inheritedContext(definedEnvironment())),
      );

    it("is read when no environment is handed", ({
      spanContextInheritedFromTheProcess,
      spanContextInheritedFromItsDefinedValues,
    }) => {
      expect(spanContextInheritedFromTheProcess).toStrictEqual(
        spanContextInheritedFromItsDefinedValues,
      );
    });
  });
});

describe("environmentCarryingContext", () => {
  const propagating = test.extend("propagation", { auto: true }, ({}, { onCleanup }) => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    onCleanup(() => {
      context.disable();
      propagation.disable();
    });
  });

  describe("an environment carried out of an active trace", () => {
    const it = propagating.extend("environmentCarriedToAChild", () =>
      context.with(
        trace.setSpanContext(context.active(), {
          traceId: ACTIVE_TRACE_ID,
          spanId: ACTIVE_SPAN_ID,
          traceFlags: TraceFlags.SAMPLED,
        }),
        () =>
          environmentCarryingContext({
            MST_TELEMETRY_KEPT: "kept",
            TRACEPARENT: INHERITED_TRACEPARENT,
          }),
      ),
    );

    it("keeps what it was handed and overwrites the trace the wrapper itself was handed", ({
      environmentCarriedToAChild,
    }) => {
      expect(environmentCarriedToAChild).toStrictEqual({
        MST_TELEMETRY_KEPT: "kept",
        TRACEPARENT: `00-${ACTIVE_TRACE_ID}-${ACTIVE_SPAN_ID}-01`,
      });
    });
  });

  describe("an environment carried out of no trace at all", () => {
    const it = propagating.extend("environmentCarriedOutOfNoSpan", () =>
      environmentCarryingContext({ MST_TELEMETRY_KEPT: "kept" }),
    );

    it("hands the child the environment without a trace", ({ environmentCarriedOutOfNoSpan }) => {
      expect(environmentCarriedOutOfNoSpan).toStrictEqual({ MST_TELEMETRY_KEPT: "kept" });
    });
  });

  describe("the environment of the process", () => {
    const it = propagating
      .extend("environmentCarriedFromTheProcess", () => environmentCarryingContext())
      .extend("environmentCarriedFromItsDefinedValues", () =>
        environmentCarryingContext(definedEnvironment()),
      );

    it("is carried when no environment is handed", ({
      environmentCarriedFromTheProcess,
      environmentCarriedFromItsDefinedValues,
    }) => {
      expect(environmentCarriedFromTheProcess).toStrictEqual(
        environmentCarriedFromItsDefinedValues,
      );
    });
  });
});
