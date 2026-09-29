import { spawnSync } from "node:child_process";
import { projectDir } from "./env.ts";

const verify = spawnSync("vp", ["run", "verify"], { cwd: projectDir, encoding: "utf8" });
if (verify.status !== 0) {
  const output = `${verify.stdout}${verify.stderr}`;
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `vp run verify が失敗している。\n${output.slice(-6000)}`,
    }),
  );
}
