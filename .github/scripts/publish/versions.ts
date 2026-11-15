import { appendTo, env, EXIT_FAILURE, run } from "../../actions/shared/runner.ts";
import { publishedPackages, versionOf } from "./packages.ts";

const packages = publishedPackages();
const [first] = packages;
if (first === undefined) {
  console.log("::notice::No package to publish");
  process.exit();
}
const expected = versionOf(first);
const mismatched = packages.find((directory) => versionOf(directory) !== expected);
if (mismatched !== undefined) {
  console.log(`::error::${mismatched} version ${versionOf(mismatched)} does not match ${expected}`);
  process.exit(EXIT_FAILURE);
}
const tag = `v${expected}`;
if (env("EVENT_NAME") === "push" && env("TAG") !== tag) {
  console.log(`::error::Tag ${env("TAG")} does not match package version ${tag}`);
  process.exit(EXIT_FAILURE);
}
appendTo("GITHUB_OUTPUT", {
  packages: packages.join(" "),
  tag,
  sha: run("git", ["rev-parse", "HEAD"]),
});
