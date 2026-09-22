import { cloudflare } from "@cloudflare/vite-plugin";
import {
  coreEntrypoints,
  grants,
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
  type Application,
} from "@repo/config";
import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { localUserInbox, userInboxClassName } from "@repo/config/realtime";
import { repositoryRoot } from "@repo/config/repository-root";
import { localCacheNamespace, localFileBucket } from "@repo/config/storage";
import { workerCompatibility } from "@repo/config/worker";

import { paths } from "./host.ts";

import type { ConfigEnv } from "vite-plus";

const coreDevWorker = {
  config: {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: [...workerCompatibility.flags],
    d1_databases: [localDatabase],
    main: paths.join(repositoryRoot, "apps/core/src/worker.ts"),
    name: "template-core",
  },
};

const cloudflareAppPlugin = (
  app: Application,
  serve: Readonly<{ command: ConfigEnv["command"]; isPreview: ConfigEnv["isPreview"] }>,
): ReturnType<typeof cloudflare> => {
  const realtime = grants(app, "realtime");
  return cloudflare({
    auxiliaryWorkers: [coreDevWorker],
    config: (config) => ({
      ...config,
      assets: {
        binding: "ASSETS",
        run_worker_first: serve.command !== "serve" || serve.isPreview === true,
      },
      compatibility_date: workerCompatibility.date,
      compatibility_flags: [...workerCompatibility.flags],
      d1_databases: [localDatabase],
      ...(realtime
        ? {
            durable_objects: {
              bindings: [localUserInbox],
            },
            migrations: [{ new_sqlite_classes: [userInboxClassName], tag: "v1" }],
          }
        : {}),
      main: "./src/app/server.ts",
      name: `template-${app}`,
      services: [
        ...(config.services ?? []),
        {
          binding: "CORE",
          entrypoint: coreEntrypoints[app],
          service: "template-core",
        },
      ],
      ...(grants(app, "jobs")
        ? {
            queues: {
              consumers: [{ queue: jobsQueueName }],
              producers: [{ binding: jobsQueueBinding, queue: jobsQueueName }],
            },
            workflows: [
              {
                binding: jobsWorkflowBinding,
                class_name: jobsWorkflowClass,
                name: jobsWorkflowName,
              },
            ],
          }
        : {}),
      ...(grants(app, "storage")
        ? { kv_namespaces: [localCacheNamespace], r2_buckets: [localFileBucket] }
        : {}),
    }),
    inspectorPort: false,
    persistState: { path: localDatabaseDirectory() },
    viteEnvironment: { name: "ssr" },
  });
};

export { cloudflareAppPlugin };
