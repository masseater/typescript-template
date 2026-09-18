import { Console, Effect } from "effect";

const reportFailed = (record: Readonly<Record<string, unknown>>): Effect.Effect<void> => {
  return Console.error(JSON.stringify(record)).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  );
};

export { reportFailed };
