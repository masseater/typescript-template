import { ROLE } from "@repo/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect, fn, waitFor } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { loadBrowserSession, provideSessionLoader } from "./api/session";
import { SessionGate } from "./session-gate";

import type { ReactElement } from "react";
import type { SessionView } from "./protocol";

const sessionPath = "/api/session";

const weakAdministrator: SessionView = {
  strong: false,
  user: {
    email: "a@example.com",
    id: "user-a",
    name: "A",
    permission: null,
    role: ROLE.administrator,
    twoFactorEnabled: false,
  },
};

type NavigationAttempt = Readonly<{ action: string; from: string; to: string }>;

type GatedVisit = Readonly<{
  attempts: (attempt: NavigationAttempt) => boolean;
  history: RouterHistory;
  page: ReactElement;
}>;

const gatedVisit = (path: string, gate: ReactElement): GatedVisit => {
  const history = createMemoryHistory({ initialEntries: [path] });
  const queries = new QueryClient();
  provideSessionLoader(queries, loadBrowserSession);
  const router = createRouter({ history, routeTree: createRootRoute() });
  const attempts = fn((attempt: NavigationAttempt): boolean => attempt.from === attempt.to);
  history.block({
    blockerFn: ({ action, currentLocation, nextLocation }) =>
      attempts({ action, from: currentLocation.href, to: nextLocation.href }),
    enableBeforeUnload: false,
  });
  return {
    attempts,
    history,
    page: (
      <QueryClientProvider client={queries}>
        <RouterContextProvider router={router}>{gate}</RouterContextProvider>
      </QueryClientProvider>
    ),
  };
};

const signedInPage = (session: SessionView): ReactElement => <main>{session.user.name}</main>;

const meta = preview.meta({ component: SessionGate });

const redirectingVisit = (
  gate: ReactElement,
  redirect: Readonly<{ from: string; landing: string; to: string }>,
): Readonly<{ page: ReactElement; play: () => Promise<void> }> => {
  const visit = gatedVisit(redirect.from, gate);
  return {
    page: visit.page,
    play: () =>
      Effect.runPromise(
        Effect.gen(function* redirectOnce() {
          const redirectWasAttempted = (): Promise<void> =>
            expect(visit.attempts).toHaveBeenCalledWith({
              action: "REPLACE",
              from: redirect.from,
              to: redirect.to,
            });
          yield* playTask(() => waitFor(redirectWasAttempted));
          yield* playTask(() => expect(visit.attempts).toHaveBeenCalledTimes(1));
          yield* playTask(() => expect(visit.history.location.href).toBe(redirect.landing));
          yield* playTask(() => expect(visit.history.length).toBe(1));
        }),
      ),
  };
};

const wikiWeak = redirectingVisit(
  <SessionGate reloadDocument securityExempt={false}>
    {signedInPage}
  </SessionGate>,
  { from: "/wiki/a", landing: "/wiki/a", to: "/wiki/a" },
);

export const WikiReloadsWeakSessionIntoSecurity = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => HttpResponse.json(weakAdministrator)));
  },
  play: wikiWeak.play,
  render: () => wikiWeak.page,
});

const adminWeak = redirectingVisit(
  <SessionGate role={ROLE.administrator}>{signedInPage}</SessionGate>,
  { from: "/users", landing: "/security", to: "/security" },
);

export const AdminNavigatesWeakSessionToSecurityInApp = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => HttpResponse.json(weakAdministrator)));
  },
  play: adminWeak.play,
  render: () => adminWeak.page,
});

const dashboardWeak = redirectingVisit(<SessionGate>{signedInPage}</SessionGate>, {
  from: "/users?page=2",
  landing: "/security",
  to: "/security",
});

export const DashboardNavigatesWeakSessionToSecurityInApp = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => HttpResponse.json(weakAdministrator)));
  },
  play: dashboardWeak.play,
  render: () => dashboardWeak.page,
});

const wikiSignedOut = redirectingVisit(
  <SessionGate reloadDocument securityExempt={false}>
    {signedInPage}
  </SessionGate>,
  { from: "/wiki/a?b=1", landing: "/wiki/a?b=1", to: "/wiki/a?b=1" },
);

export const WikiReloadsSignedOutVisitorIntoLogin = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => new HttpResponse(null, { status: 401 })));
  },
  play: wikiSignedOut.play,
  render: () => wikiSignedOut.page,
});

const adminSignedOut = redirectingVisit(
  <SessionGate role={ROLE.administrator}>{signedInPage}</SessionGate>,
  { from: "/users", landing: "/login?redirect=%2Fusers", to: "/login?redirect=%2Fusers" },
);

export const AdminNavigatesSignedOutVisitorToLoginInApp = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => new HttpResponse(null, { status: 401 })));
  },
  play: adminSignedOut.play,
  render: () => adminSignedOut.page,
});

const dashboardSignedOut = redirectingVisit(<SessionGate>{signedInPage}</SessionGate>, {
  from: "/users?page=2",
  landing: "/login?redirect=%2Fusers%3Fpage%3D2",
  to: "/login?redirect=%2Fusers%3Fpage%3D2",
});

export const DashboardNavigatesSignedOutVisitorToLoginInApp = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => new HttpResponse(null, { status: 401 })));
  },
  play: dashboardSignedOut.play,
  render: () => dashboardSignedOut.page,
});

const adminOnSecurity = gatedVisit(
  "/security",
  <SessionGate role={ROLE.administrator}>{signedInPage}</SessionGate>,
);

export const AdminKeepsWeakSessionOnTheSecurityPage = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(sessionPath, () => HttpResponse.json(weakAdministrator)));
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* stayOnSecurity() {
        const page = yield* playTask(() => canvas.findByRole("main"));
        yield* playTask(() => expect(page).toHaveTextContent("A"));
        yield* playTask(() => expect(adminOnSecurity.attempts).not.toHaveBeenCalled());
        yield* playTask(() => expect(adminOnSecurity.history.location.href).toBe("/security"));
      }),
    ),
  render: () => adminOnSecurity.page,
});
