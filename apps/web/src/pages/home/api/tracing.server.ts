import { layer as cloudflareTracerLayer } from "@alchemy.run/cloudflare/Workers/CloudflareTracer";
import { Effect, Layer, Logger, Option, Predicate, Schema } from "effect";
import type { Tracer } from "effect";

type RunInContext = (run: () => void) => void;

const SpanContextHolder = Schema.Struct({
  runInContext: Schema.declare((input: unknown): input is RunInContext =>
    Predicate.isFunction(input),
  ),
});

const isSpanContextHolder = Schema.is(SpanContextHolder);

const ownSpan = (span: Option.Option<Tracer.AnySpan>): Option.Option<Tracer.Span> =>
  span.pipe(Option.filter((current) => Predicate.isTagged(current, "Span")));

const nearestContext = (span: Option.Option<Tracer.AnySpan>): Option.Option<RunInContext> =>
  span.pipe(
    Option.flatMap((current) =>
      Option.liftPredicate(current, isSpanContextHolder).pipe(
        Option.map((holder) => holder.runInContext),
        Option.orElse(() =>
          ownSpan(Option.some(current)).pipe(Option.flatMap((own) => nearestContext(own.parent))),
        ),
      ),
    ),
  );

const spanFields = (span: Option.Option<Tracer.AnySpan>): Record<string, unknown> =>
  ownSpan(span).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (own) => ({ span: own.name }),
    }),
  );

const leveledLogger = Logger.withLeveledConsole(
  Logger.make((options) => ({
    ...Logger.formatStructured.log(options),
    ...spanFields(Option.fromUndefinedOr(options.fiber.cache.span)),
  })),
);

const cloudflareLogger = Logger.make((options) => {
  const log = (): void => {
    leveledLogger.log(options);
  };
  Option.match(nearestContext(Option.fromUndefinedOr(options.fiber.cache.span)), {
    onNone: log,
    onSome: (run) => {
      run(log);
    },
  });
});

const withCloudflareTracing = <Success, Failure, Requirements>(
  effect: Effect.Effect<Success, Failure, Requirements>,
): Effect.Effect<Success, Failure, Requirements> =>
  Layer.build(cloudflareTracerLayer).pipe(
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped,
  );

export { cloudflareLogger, withCloudflareTracing };
