import { fileURLToPath } from "node:url";
import { loadArtifacts } from "./artifacts.ts";

try {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  for (const target of ["user", "admin", "wiki"] as const) {
    const artifacts = await loadArtifacts(root, target);
    console.log(
      JSON.stringify({
        event: "artifacts.verified",
        target,
        mainModule: artifacts.mainModule,
        modules: artifacts.modules.length,
        privateAssetsExcluded: true,
      }),
    );
  }
} catch {
  console.error(JSON.stringify({ event: "artifacts.invalid" }));
  process.exitCode = 1;
}
