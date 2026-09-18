import { applications } from "@repo/config";
import type { Application } from "@repo/config";

import { serveApplication } from "./app-servers.ts";
import { generateAuthSecret, replaceDevVars } from "./dev-vars.ts";
import { documentPaths } from "./documents.ts";
import { roleApplications } from "./journey-roles.ts";
import type { JourneyRole } from "./journey-roles.ts";
import { startIsolatedDatabase } from "./local-database.ts";
import type { IsolatedDatabase } from "./local-database.ts";
import { startMailSink } from "./mail.ts";
import type { MailSink } from "./mail.ts";
import { freePort, loopbackOrigin } from "./ports.ts";

type Disposer = () => Promise<void>;
type Collect = (disposer: Disposer) => void;

interface ConfiguredApplication {
  readonly application: Application;
  readonly origin: string;
  readonly port: number;
}

interface JourneyEnvironment {
  readonly documents: readonly string[];
  readonly mail: MailSink;
  readonly originOf: (role: JourneyRole) => string;
  readonly promoteToAdministrator: (email: string) => Promise<void>;
  readonly stop: Disposer;
}

async function disposeAll(disposers: readonly Disposer[]): Promise<void> {
  const [first, ...rest] = disposers;
  if (first === undefined) {
    return;
  }
  await Promise.allSettled([first()]);
  await disposeAll(rest);
}

async function configureApplications(
  collect: Collect,
  mailOrigin: string,
): Promise<readonly ConfiguredApplication[]> {
  const authSecret = generateAuthSecret();
  return Promise.all(
    applications.map(async (application) => {
      const port = await freePort();
      const origin = loopbackOrigin(port);
      const values = { appOrigin: origin, authSecret, mailOrigin };
      collect(await replaceDevVars(application, values));
      return { application, origin, port };
    }),
  );
}

async function serveApplications(
  collect: Collect,
  configured: readonly ConfiguredApplication[],
  database: IsolatedDatabase,
): Promise<void> {
  const served = await Promise.allSettled(
    configured.map(async ({ application, port }) => {
      const { environment } = database;
      const options = { application, environment, logDirectory: database.directory, port };
      const running = await serveApplication(options);
      collect(running.stop);
    }),
  );
  const failure = served.find((result) => result.status === "rejected");
  if (failure !== undefined) {
    throw failure.reason;
  }
}

function originFinder(configured: readonly ConfiguredApplication[]): (role: JourneyRole) => string {
  return (role) => {
    const wanted = roleApplications[role];
    const found = configured.find(({ application }) => application === wanted);
    if (found === undefined) {
      throw new Error("E2E_APPLICATION_NOT_CONFIGURED");
    }
    return found.origin;
  };
}

async function launch(collect: Collect): Promise<Omit<JourneyEnvironment, "stop">> {
  const database = await startIsolatedDatabase();
  collect(database.remove);
  const mail = await startMailSink();
  collect(mail.stop);
  const configured = await configureApplications(collect, mail.origin);
  await serveApplications(collect, configured, database);
  return {
    documents: await documentPaths(roleApplications.knowledge),
    mail,
    originOf: originFinder(configured),
    promoteToAdministrator: database.promoteToAdministrator,
  };
}

async function startJourneyEnvironment(): Promise<JourneyEnvironment> {
  const disposers: Disposer[] = [];
  function collect(disposer: Disposer): void {
    disposers.push(disposer);
  }
  try {
    const started = await launch(collect);
    return { ...started, stop: async () => disposeAll(disposers) };
  } catch (error) {
    await disposeAll(disposers);
    throw error;
  }
}

export { startJourneyEnvironment };
export type { JourneyEnvironment };
