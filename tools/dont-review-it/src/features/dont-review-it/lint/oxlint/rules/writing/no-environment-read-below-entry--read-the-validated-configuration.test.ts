import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noEnvironmentReadBelowEntry } from "./no-environment-read-below-entry--read-the-validated-configuration.ts";

describe("dont-review-it/no-environment-read-below-entry--read-the-validated-configuration", () => {
  testLintRule(noEnvironmentReadBelowEntry, {
    valid: [
      {
        name: "the whole environment handed to the schema that validates it passes",
        documented: true,
        code: "export const config = decodeEnvironment(process.env);",
      },
      {
        name: "a key read inside a listed entry file passes",
        documented: true,
        code: "const environment = process.env;\nexport const setting = (key: string) => environment[key];",
        filename: "/repo/libs/config/src/process-environment.ts",
        options: [{ entryFiles: ["libs/config/src/process-environment.ts"] }],
      },
      {
        name: "a Worker env handed whole to the validating reader passes",
        code: 'import { env } from "cloudflare:workers";\nexport const config = readConfig(env);',
      },
      {
        name: "an env that is not the Worker's is somebody else's object",
        code: "export const origin = (settings: { env: { APP_ORIGIN: string } }) => settings.env.APP_ORIGIN;",
      },
      {
        name: "the environment spread into a child process is not a key read",
        code: "spawn('git', [], { env: { ...process.env, HOME: home } });",
      },
      {
        name: "assigning a key sets it rather than reading it",
        code: "process.env.TZ = 'UTC';",
      },
      {
        name: "removing a key does not read it",
        code: "delete process.env.TZ;",
      },
      {
        name: "a file listed as entry by its trailing path segments passes",
        code: "export const port = process.env.PORT;",
        filename: "/repo/apps/web/src/entry.ts",
        options: [{ entryFiles: ["src/entry.ts"] }],
      },
      {
        name: "options that list no entry file leave every whole-environment hand-off alone",
        code: "export const run = () => main(process.env);",
        options: [{}],
      },
    ],
    invalid: [
      {
        name: "a key read from process.env is reported",
        documented: true,
        code: "export const origin = process.env.APP_ORIGIN;",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "a key read from the Worker env import is reported",
        documented: true,
        code: 'import { env } from "cloudflare:workers";\nexport const origin = env.APP_ORIGIN;',
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "a computed key read is reported",
        code: "export const setting = (key: string) => process.env[key];",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "process reached through globalThis is the same environment",
        code: "export const origin = globalThis.process.env.APP_ORIGIN;",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "a key read from import.meta.env is reported",
        code: "export const origin = import.meta.env.VITE_ORIGIN;",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "keys destructured from the environment are each reported",
        code: "const { APP_ORIGIN, APP_RELEASE } = process.env;\nexport { APP_ORIGIN, APP_RELEASE };",
        errors: [{ messageId: "environmentRead" }, { messageId: "environmentRead" }],
      },
      {
        name: "an alias of the environment carries it",
        code: "const environment = process.env;\nexport const origin = environment.APP_ORIGIN;",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "the Worker env imported under another name is the same env",
        code: 'import { env as bindings } from "cloudflare:workers";\nexport const database = bindings.DB;',
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "the Worker env reached through a namespace import is the same env",
        code: 'import * as worker from "cloudflare:workers";\nexport const database = worker.env.DB;',
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "this.env in a class extending a Worker base class is the Worker env",
        code: 'import { WorkerEntrypoint } from "cloudflare:workers";\nexport class Api extends WorkerEntrypoint { origin() { return this.env.APP_ORIGIN; } }',
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "the env parameter of a default exported fetch handler is the Worker env",
        code: "export default { fetch(request: Request, env: Env) { return env.APP_ORIGIN; } };",
        errors: [{ messageId: "environmentRead" }],
      },
      {
        name: "a file that only resembles a listed entry by name is still checked",
        code: "export const port = process.env.PORT;",
        filename: "/repo/apps/web/src/other-entry.ts",
        options: [{ entryFiles: ["entry.ts"] }],
        errors: [{ messageId: "environmentRead" }],
      },
    ],
  });
});
