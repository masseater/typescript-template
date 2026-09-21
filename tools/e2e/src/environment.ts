import { NodeServices } from "@effect/platform-node";
import { type Application, applications } from "@repo/config";
import { Effect } from "effect";

import { serveApplication } from "./app-servers.ts";
import { generateAuthSecret, replaceDevVars } from "./dev-vars.ts";
import { newDisposerStack } from "./disposers.ts";
import { documentPaths } from "./documents.ts";
import { type Journey, type JourneyFailure } from "./journey-failure.ts";
import { type JourneyRole, roleApplications } from "./journey-roles.ts";
import { type IsolatedDatabase, startIsolatedDatabase } from "./local-database.ts";
import { type MailSink, startMailSink } from "./mail.ts";
import { freePort, loopbackOrigin } from "./ports.ts";

type Collect = (disposer: Effect.Effect<void, JourneyFailure>) => void;

type ConfiguredApplication = {
  readonly application: Application;
  readonly origin: string;
  readonly port: number;
};

const configureOne = (pending: {
  readonly application: Application;
  readonly authSecret: string;
  readonly collect: Collect;
  readonly mailOrigin: string;
}): Journey<ConfiguredApplication> =>
  Effect.gen(function* configureApplication() {
    const port = yield* freePort();
    const origin = loopbackOrigin(port);
    pending.collect(
      yield* replaceDevVars(pending.application, {
        appOrigin: origin,
        authSecret: pending.authSecret,
        mailOrigin: pending.mailOrigin,
      }),
    );
    return { application: pending.application, origin, port };
  });

const configureEach = (pending: {
  readonly authSecret: string;
  readonly collect: Collect;
  readonly mailOrigin: string;
}): Journey<readonly ConfiguredApplication[]> =>
  Effect.forEach(
    applications,
    (application) =>
      configureOne({
        application,
        authSecret: pending.authSecret,
        collect: pending.collect,
        mailOrigin: pending.mailOrigin,
      }),
    { concurrency: "unbounded" },
  );

const configureApplications = (
  collect: Collect,
  mailOrigin: string,
): Journey<readonly ConfiguredApplication[]> =>
  generateAuthSecret().pipe(
    Effect.flatMap((authSecret) => configureEach({ authSecret, collect, mailOrigin })),
  );

const serveApplications = (
  collect: Collect,
  pending: {
    readonly configured: readonly ConfiguredApplication[];
    readonly database: IsolatedDatabase;
  },
): Journey<void> =>
  Effect.gen(function* serveRemaining() {
    const [first, ...rest] = pending.configured;
    if (first === undefined) {
      return;
    }
    const running = yield* serveApplication({
      application: first.application,
      environment: pending.database.environment,
      logDirectory: pending.database.directory,
      port: first.port,
    });
    collect(running.stop);
    yield* serveApplications(collect, { configured: rest, database: pending.database });
  });

const originFinder = (
  configured: readonly ConfiguredApplication[],
): ((role: JourneyRole) => string) => {
  const origins = new Map(
    configured.map((configuredApplication) => [
      configuredApplication.application,
      configuredApplication.origin,
    ]),
  );
  return (role) => origins.get(roleApplications[role]) ?? "";
};

type JourneyEnvironment = {
  readonly documents: readonly string[];
  readonly mail: MailSink;
  readonly originOf: (role: JourneyRole) => string;
  readonly promoteToAdministrator: (email: string) => Effect.Effect<void, JourneyFailure>;
  readonly stop: Effect.Effect<void, JourneyFailure>;
};

const launch = (collect: Collect): Journey<Omit<JourneyEnvironment, "stop">> =>
  Effect.gen(function* launchEnvironment() {
    const database = yield* startIsolatedDatabase();
    collect(database.remove);
    const mail = yield* startMailSink();
    collect(mail.stop);
    const configured = yield* configureApplications(collect, mail.origin);
    yield* serveApplications(collect, { configured, database });
    return {
      documents: yield* documentPaths(roleApplications.knowledge),
      mail,
      originOf: originFinder(configured),
      promoteToAdministrator: database.promoteToAdministrator,
    };
  });

const keepStarted = (
  collect: Collect,
  disposeAll: Effect.Effect<void, JourneyFailure>,
): Journey<JourneyEnvironment> =>
  launch(collect).pipe(
    Effect.map((started) => ({ ...started, stop: disposeAll })),
    Effect.tapError(() => disposeAll),
  );

const startJourneyEnvironment = (): Effect.Effect<JourneyEnvironment, JourneyFailure> =>
  Effect.suspend(() => {
    const { collect, disposeAll } = newDisposerStack();
    return keepStarted(collect, disposeAll);
  }).pipe(Effect.provide(NodeServices.layer));

export { startJourneyEnvironment };
export type { JourneyEnvironment };
