import { applications } from "@template/config";
import { loadArtifacts } from "./artifacts.ts";

try {
  const root = `${import.meta.dirname}/../../..`;
  const verified = await Promise.all(
    applications.map(async (target) => {
      const artifacts = await loadArtifacts(root, target);
      return {
        event: "artifacts.verified",
        mainModule: artifacts.mainModule,
        modules: artifacts.modules.length,
        privateAssetsExcluded: true,
        target,
      } as const;
    }),
  );
  process.stdout.write(verified.map((entry) => `${JSON.stringify(entry)}\n`).join(""));
} catch {
  process.stderr.write(`${JSON.stringify({ event: "artifacts.invalid" })}\n`);
  process.exitCode = 1;
}
