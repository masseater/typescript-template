import {
  EXIT_FAILURE,
  env,
  field,
  optionalEnv,
  run,
  stringField,
} from "../../actions/shared/runner.ts";

const repository = env("REPO");
const tag = env("TAG");
const sha = env("SHA");
const gh = { env: { GH_TOKEN: env("GH_TOKEN") } };

const existingTarget = (): string | undefined => {
  try {
    const ref: unknown = JSON.parse(
      run("gh", ["api", `repos/${repository}/git/ref/tags/${tag}`], gh),
    );
    return stringField(field(ref, "object"), "sha");
  } catch {
    return undefined;
  }
};

const existing = existingTarget();
if (existing !== undefined && existing !== sha) {
  console.log(`::error::${tag} already points to ${existing}, not ${sha}`);
  process.exit(EXIT_FAILURE);
}
if (optionalEnv("MODE") === "create") {
  if (existing === undefined) {
    run(
      "gh",
      ["api", `repos/${repository}/git/refs`, "-f", `ref=refs/tags/${tag}`, "-f", `sha=${sha}`],
      gh,
    );
  } else {
    console.log(`${tag} already points to ${sha}`);
  }
}
