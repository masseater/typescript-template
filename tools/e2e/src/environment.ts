import { type Application, applications } from "@repo/config";

import { serveApplication } from "./app-servers.ts";
import { generateAuthSecret, replaceDevVars } from "./dev-vars.ts";
import { type Disposer, newDisposerStack } from "./disposers.ts";
import { documentPaths } from "./documents.ts";
import { type JourneyRole, roleApplications } from "./journey-roles.ts";
import { type IsolatedDatabase, startIsolatedDatabase } from "./local-database.ts";
import { type MailSink, startMailSink } from "./mail.ts";
import { freePort, loopbackOrigin } from "./ports.ts";

type Collect = (disposer: Disposer) => void;

type ConfiguredApplication = {
  readonly application: Application;
  readonly origin: string;
  readonly port: number;
};

const configureApplications = async (
  collect: Collect,
  mailOrigin: string,
): Promise<readonly ConfiguredApplication[]> => {
  const authSecret = generateAuthSecret();
  return Promise.all(
    applications.map(async (application) => {
      const port = await freePort();
      const origin = loopbackOrigin(port);
      collect(await replaceDevVars(application, { appOrigin: origin, authSecret, mailOrigin }));
      return { application, origin, port };
    }),
  );
};

const serveApplications = async (
  collect: Collect,
  pending: {
    readonly configured: readonly ConfiguredApplication[];
    readonly database: IsolatedDatabase;
  },
): Promise<void> => {
  const [first, ...rest] = pending.configured;
  if (first === undefined) {
    return;
  }
  const running = await serveApplication({
    application: first.application,
    environment: pending.database.environment,
    logDirectory: pending.database.directory,
    port: first.port,
  });
  collect(running.stop);
  await serveApplications(collect, { configured: rest, database: pending.database });
};

const originFinder = (
  configured: readonly ConfiguredApplication[],
): ((role: JourneyRole) => string) => {
  return (role) => {
    const wanted = roleApplications[role];
    const found = configured.find(({ application }) => application === wanted);
    if (found === undefined) {
      throw new Error("E2E_APPLICATION_NOT_CONFIGURED");
    }
    return found.origin;
  };
};

type JourneyEnvironment = {
  readonly documents: readonly string[];
  readonly mail: MailSink;
  readonly originOf: (role: JourneyRole) => string;
  readonly promoteToAdministrator: (email: string) => Promise<void>;
  readonly stop: Disposer;
};

const launch = async (collect: Collect): Promise<Omit<JourneyEnvironment, "stop">> => {
  const database = await startIsolatedDatabase();
  collect(database.remove);
  const mail = await startMailSink();
  collect(mail.stop);
  const configured = await configureApplications(collect, mail.origin);
  await serveApplications(collect, { configured, database });
  return {
    documents: await documentPaths(roleApplications.knowledge),
    mail,
    originOf: originFinder(configured),
    promoteToAdministrator: database.promoteToAdministrator,
  };
};

const startJourneyEnvironment = async (): Promise<JourneyEnvironment> => {
  const { collect, disposeAll } = newDisposerStack();
  try {
    const started = await launch(collect);
    return { ...started, stop: disposeAll };
  } catch (unlaunched) {
    await disposeAll();
    throw unlaunched;
  }
};

export { startJourneyEnvironment };
export type { JourneyEnvironment };
