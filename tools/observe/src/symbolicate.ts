import { array, maxLength, minLength, object, parse, picklist, pipe, regex, string } from "valibot";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";
import { symbolicate } from "./source-maps.ts";

const maximumLocations = 20;
const locationList = array(string());
const inputSchema = object({
  app: picklist(["user", "admin", "wiki"]),
  locations: pipe(locationList, minLength(1), maxLength(maximumLocations)),
  release: pipe(string(), regex(/^[0-9a-f]{16}$/u)),
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string" },
    help: { default: false, type: "boolean" },
    release: { type: "string" },
  },
});

if (values.help) {
  process.stdout.write(
    `${JSON.stringify({
      locations: "error.locations lines from Workers Logs, such as /assets/index-abc.js:1:234",
      readOnly: true,
      usage: "observe:symbolicate --app <user|admin|wiki> --release <APP_RELEASE> <location>...",
    })}\n`,
  );
} else {
  try {
    const input = parse(inputSchema, {
      app: values.app,
      locations: positionals.flatMap((value) => value.split("\n")).filter((line) => line !== ""),
      release: values.release,
    });
    const frames = await symbolicate(
      {
        app: input.app,
        release: input.release,
        repositoryRoot: `${import.meta.dirname}/../../..`,
      },
      input.locations,
    );
    process.stdout.write(
      `${JSON.stringify({
        app: input.app,
        event: "observe.symbolicated",
        frames,
        release: input.release,
      })}\n`,
    );
  } catch {
    process.stderr.write(`${JSON.stringify({ event: "observe.symbolicate_failed" })}\n`);
    process.exitCode = 1;
  }
}
