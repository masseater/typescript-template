import { ROLE } from "@repo/config";
import { STATUS_VARIANT } from "@repo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { sessionOptions } from "./api/session.ts";
import { SessionGate } from "./session-gate.tsx";
import { SessionStatus } from "./session-status.tsx";

import type { SessionView } from "./protocol.ts";

const member: SessionView["user"] = {
  email: "a@example.com",
  id: "user-a",
  name: "A",
  permission: null,
  role: ROLE.member,
  twoFactorEnabled: true,
};

const strongSession: SessionView = { strong: true, user: member };
const weakSession: SessionView = { strong: false, user: member };

const router = createRouter({
  history: createMemoryHistory({ initialEntries: ["/wiki"] }),
  routeTree: createRootRoute(),
});

const wikiGate = (
  <SessionGate reloadDocument securityExempt={false}>
    {(signedIn) => <main>{signedIn.user.name}</main>}
  </SessionGate>
);

const retryless = { defaultOptions: { queries: { retryOnMount: false } } } as const;

describe("session gate", () => {
  const it = test
    .extend("theGateWhileLoading", () =>
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient(retryless)}>
          <RouterContextProvider router={router}>{wikiGate}</RouterContextProvider>
        </QueryClientProvider>,
      ))
    .extend("theLoadingStatus", () =>
      renderToStaticMarkup(
        <SessionStatus variant={STATUS_VARIANT.pending}>{"読み込み中です。"}</SessionStatus>,
      ),
    )
    .extend("theGateOfAFailedRead", () => {
      const queries = new QueryClient(retryless);
      const query = queries.getQueryCache().build(queries, { queryKey: sessionOptions.queryKey });
      query.setState({ ...query.state, error: new Error("読み込めません"), status: "error" });
      return renderToStaticMarkup(
        <QueryClientProvider client={queries}>
          <RouterContextProvider router={router}>{wikiGate}</RouterContextProvider>
        </QueryClientProvider>,
      );
    })
    .extend("theFailureStatus", () =>
      renderToStaticMarkup(
        <SessionStatus variant={STATUS_VARIANT.failure}>{"読み込めません"}</SessionStatus>,
      ),
    )
    .extend("theGateOfAStrongSession", () => {
      const queries = new QueryClient(retryless);
      queries.setQueryData(sessionOptions.queryKey, strongSession);
      return renderToStaticMarkup(
        <QueryClientProvider client={queries}>
          <RouterContextProvider router={router}>{wikiGate}</RouterContextProvider>
        </QueryClientProvider>,
      );
    })
    .extend("theGateOfAWeakSession", () => {
      const queries = new QueryClient(retryless);
      queries.setQueryData(sessionOptions.queryKey, weakSession);
      return renderToStaticMarkup(
        <QueryClientProvider client={queries}>
          <RouterContextProvider router={router}>{wikiGate}</RouterContextProvider>
        </QueryClientProvider>,
      );
    });

  it("shows the loading message while the session is loading", ({
    theGateWhileLoading,
    theLoadingStatus,
  }) => {
    expect(theGateWhileLoading).toBe(theLoadingStatus);
  });

  it("shows the session error", ({ theGateOfAFailedRead, theFailureStatus }) => {
    expect(theGateOfAFailedRead).toBe(theFailureStatus);
  });

  it("renders the page for an allowed session", ({ theGateOfAStrongSession }) => {
    expect(theGateOfAStrongSession).toBe("<main>A</main>");
  });

  it("renders nothing for a session that is being redirected", ({ theGateOfAWeakSession }) => {
    expect(theGateOfAWeakSession).toBe("");
  });
});
