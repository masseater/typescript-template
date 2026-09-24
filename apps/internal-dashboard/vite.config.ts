import { APPLICATION, wikiWorker } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { appConfig, appRun, paths, wikiCompanion, wikiDevServices } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
  ...appConfig(APPLICATION.wiki, {
    plugins: [
      wikiCompanion({ repositoryRoot, wikiRoot: paths.join(repositoryRoot, "apps", wikiWorker) }),
    ],
    services: wikiDevServices,
  })(env),
  run: appRun(import.meta.dirname),
}));
