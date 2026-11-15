import { appendTo, env, run } from "../shared/runner.ts";

const file = env("FILE");
const changed = run(
  "gh",
  [
    "api",
    `repos/${env("REPO")}/pulls/${env("NUMBER")}/files`,
    "--paginate",
    "--jq",
    ".[].filename",
  ],
  { env: { GH_TOKEN: env("GH_TOKEN") } },
)
  .split("\n")
  .includes(file);
if (changed) {
  appendTo("GITHUB_OUTPUT", { changed: "true" });
}
