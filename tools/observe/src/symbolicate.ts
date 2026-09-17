import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as v from "valibot";
import { symbolicate } from "./source-maps.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string" },
    release: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.info(
    JSON.stringify({
      usage: "observe:symbolicate --app <user|admin|wiki> --release <APP_RELEASE> <location>...",
      locations: "error.locations lines from Workers Logs, such as /assets/index-abc.js:1:234",
      readOnly: true,
    }),
  );
} else {
  try {
    const input = v.parse(
      v.object({
        app: v.picklist(["user", "admin", "wiki"]),
        release: v.pipe(v.string(), v.regex(/^[0-9a-f]{16}$/)),
        locations: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(20)),
      }),
      {
        app: values.app,
        release: values.release,
        locations: positionals.flatMap((value) => value.split("\n")).filter(Boolean),
      },
    );
    const frames = await symbolicate(
      fileURLToPath(new URL("../../../", import.meta.url)),
      input.app,
      input.release,
      input.locations,
    );
    console.info(
      JSON.stringify({
        event: "observe.symbolicated",
        app: input.app,
        release: input.release,
        frames,
      }),
    );
  } catch {
    console.error(JSON.stringify({ event: "observe.symbolicate_failed" }));
    process.exitCode = 1;
  }
}
