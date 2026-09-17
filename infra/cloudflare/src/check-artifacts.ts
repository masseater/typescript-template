import { fileURLToPath } from "node:url";
import { loadArtifacts } from "./artifacts.ts";

const TARGETS = ["user", "admin", "wiki"] as const;

try {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const verified = await Promise.all(
    TARGETS.map(async (target) => {
      const artifacts = await loadArtifacts(root, target);
      return {
        event: "artifacts.verified",
        mainModule: artifacts.mainModule,
        modules: artifacts.modules.length,
        privateAssetsExcluded: true,
        target,
      };
    }),
  );
  process.stdout.write(verified.map((entry) => `${JSON.stringify(entry)}\n`).join(""));
} catch {
  process.stderr.write(`${JSON.stringify({ event: "artifacts.invalid" })}\n`);
  process.exitCode = 1;
}
