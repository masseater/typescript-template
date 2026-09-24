import { localDatabase } from "@repo/config/local-database-path";
import { repositoryRoot } from "@repo/config/repository-root";
import { workerCompatibility } from "@repo/config/worker";

import { paths } from "./host.ts";

const devWorkerName = (worker: string): string => `template-${worker}`;

const coreDevWorkerName = devWorkerName("core");

const coreDevWorker = {
  config: {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: [...workerCompatibility.flags],
    d1_databases: [localDatabase],
    main: paths.join(repositoryRoot, "apps/core/src/features/core/worker.ts"),
    name: coreDevWorkerName,
  },
};

export { coreDevWorker, coreDevWorkerName, devWorkerName };
