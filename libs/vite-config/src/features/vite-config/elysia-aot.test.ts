import { NodeServices } from "@effect/platform-node";
import { Effect, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { build, type Plugin } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";

import { elysiaWorkerdJit } from "./elysia-aot.ts";

class ProbeBuildFailed extends Schema.TaggedError<ProbeBuildFailed>()("ProbeBuildFailed", {
  message: Schema.String,
}) {}

const probeModule = "virtual:elysia-workerd-probe";

const probeSource = `
import { Elysia, status } from "elysia";
import { WebStandardAdapter } from "elysia/adapter/web-standard";

class Missing extends Error {}

const api = new Elysia({ adapter: WebStandardAdapter, prefix: "/api" })
  .guard({ parse: "none" })
  .error(({ error }) => (error instanceof Missing ? status(404, { error: "missing" }) : undefined))
  .beforeHandle(({ request }) =>
    request.headers.get("x-refuse") === "1" ? status(403, { error: "refused" }) : undefined,
  )
  .get("/found", () => ({ found: true }))
  .get("/missing", () => {
    throw new Missing("missing");
  })
  .post("/echo", async ({ request }) => ({ length: (await request.text()).length }));

const transformed = new Elysia({ adapter: WebStandardAdapter })
  .transform(() => undefined)
  .get("/", () => "transformed");

const read = async (app, request) => {
  const response = await app.handle(request);
  return { status: response.status, body: await response.text() };
};

console.log(
  JSON.stringify({
    found: await read(api, new Request("http://probe/api/found")),
    refused: await read(
      api,
      new Request("http://probe/api/found", { headers: { "x-refuse": "1" } }),
    ),
    missing: await read(api, new Request("http://probe/api/missing")),
    echo: await read(
      api,
      new Request("http://probe/api/echo", {
        method: "POST",
        body: "{not json",
        headers: { "content-type": "application/json" },
      }),
    ),
    transformed: await read(transformed, new Request("http://probe/")),
  }),
);
`;

const probeEntry: Plugin = {
  enforce: "pre",
  load: (moduleId: string) => (moduleId === `\0${probeModule}` ? probeSource : undefined),
  name: "elysia-workerd-probe",
  resolveId: (specifier: string) => (specifier === probeModule ? `\0${probeModule}` : undefined),
};

const bundledProbe = (plugins: readonly Plugin[]): Effect.Effect<string, ProbeBuildFailed> =>
  Effect.tryPromise({
    catch: (buildFailure: unknown) =>
      new ProbeBuildFailed({
        message: buildFailure instanceof Error ? buildFailure.message : String(buildFailure),
      }),
    try: () =>
      build({
        build: { rollupOptions: { input: probeModule }, ssr: true, write: false },
        configFile: false,
        logLevel: "silent",
        plugins: [probeEntry, ...plugins],
        ssr: { noExternal: true },
      }),
  }).pipe(
    Effect.map((built) =>
      [built]
        .flat()
        .flatMap((bundle) => ("output" in bundle ? bundle.output : []))
        .flatMap((chunk) => ("code" in chunk && chunk.isEntry ? [chunk.code] : []))
        .join("\n"),
    ),
  );

const ProbeOutcome = Schema.Struct({ body: Schema.String, status: Schema.Number });

const ProbeReport = Schema.fromJsonString(
  Schema.Struct({
    echo: ProbeOutcome,
    found: ProbeOutcome,
    missing: ProbeOutcome,
    refused: ProbeOutcome,
    transformed: ProbeOutcome,
  }),
);

const runProbe = (
  bundle: string,
  nodeArguments: readonly string[],
): Effect.Effect<typeof ProbeReport.Type, unknown> =>
  Effect.gen(function* runProbe() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [...nodeArguments, "--input-type=module"], {
        stdin: { stream: Stream.make(new TextEncoder().encode(bundle)) },
      }),
    );
    const [stdout] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode],
      { concurrency: "unbounded" },
    );
    return yield* Schema.decodeEffect(ProbeReport)(stdout.trim());
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

const codeGenerationRefused = "--disallow-code-generation-from-strings";

const brokenGenerator =
  'globalThis.Function = new Proxy(globalThis.Function, { construct: () => { throw new SyntaxError("generated route does not parse"); } });\n';

const jitWithoutCompilation: Plugin = {
  enforce: "pre",
  name: "elysia-without-jit-compilation",
  transform: (code: string, moduleId: string) =>
    moduleId.includes("/elysia/dist/compile/handler/jit.mjs")
      ? code.replace("return new Function(", "return Function(")
      : undefined,
};

describe("elysiaWorkerdJit", () => {
  const it = test
    .extend("patchedBundle", () => Effect.runPromise(bundledProbe([elysiaWorkerdJit()])))
    .extend("refusedRun", ({ patchedBundle }) =>
      Effect.runPromise(runProbe(patchedBundle, [codeGenerationRefused])),
    )
    .extend("compiledRun", ({ patchedBundle }) => Effect.runPromise(runProbe(patchedBundle, [])))
    .extend("brokenGeneratorRun", ({ patchedBundle }) =>
      Effect.runPromise(runProbe(`${brokenGenerator}${patchedBundle}`, [])),
    )
    .extend("unpatchableBuild", () =>
      Effect.runPromise(
        bundledProbe([jitWithoutCompilation, elysiaWorkerdJit()]).pipe(
          Effect.match({
            onFailure: (buildFailure) => buildFailure.message,
            onSuccess: () => "built",
          }),
        ),
      ),
    );

  it("answers supported routes the same way whether or not the runtime refuses eval", ({
    compiledRun,
    refusedRun,
  }) => {
    expect({
      echo: refusedRun.echo,
      found: refusedRun.found,
      missing: refusedRun.missing,
      refused: refusedRun.refused,
    }).toStrictEqual({
      echo: compiledRun.echo,
      found: compiledRun.found,
      missing: compiledRun.missing,
      refused: compiledRun.refused,
    });
    expect(refusedRun).toMatchObject({
      echo: { body: '{"length":9}', status: 200 },
      found: { body: '{"found":true}', status: 200 },
      missing: { body: '{"error":"missing"}', status: 404 },
      refused: { body: '{"error":"refused"}', status: 403 },
    });
  });

  it("refuses to compile a route whose hooks the eval-free route does not run", ({
    refusedRun,
  }) => {
    expect(refusedRun.transformed.status).toBe(500);
    expect(refusedRun.transformed.body).toContain("GET / needs transform");
  });

  it("rethrows a code generation failure that is not an eval refusal", ({ brokenGeneratorRun }) => {
    expect(brokenGeneratorRun.found.status).toBe(500);
    expect(brokenGeneratorRun.found.body).toContain("generated route does not parse");
  });

  it("fails the build when Elysia no longer contains the compilation it replaces", ({
    unpatchableBuild,
  }) => {
    expect(unpatchableBuild).toContain("no longer contains the handler compilation it replaces");
  });
}, 120_000);
