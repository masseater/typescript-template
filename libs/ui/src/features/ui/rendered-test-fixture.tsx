import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";

import { AppProviders } from "./app-providers";

import type { ReactElement } from "react";
import type { ActionState } from "./action";

const actionState = (
  shown: Readonly<Partial<Pick<ActionState, "error" | "pending">>> = {},
): ActionState => {
  const pending = shown.pending ?? false;
  return { blocked: pending, error: shown.error, pending, run: () => undefined };
};

const renderedAt = (
  page: ReactElement,
  [openedPath, ...linkedPaths]: readonly [string, ...string[]],
): string => {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren(
    [openedPath, ...linkedPaths].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path }),
    ),
  );
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [openedPath] }),
    routeTree,
  });
  const validationMessages = {
    patternMismatch: "形式が違います。",
    tooLong: "長すぎます。",
    tooShort: "短すぎます。",
    typeMismatch: "種類が違います。",
    valueMissing: "入力してください。",
  } as const;
  return renderToStaticMarkup(
    <AppProviders fieldValidationMessages={validationMessages}>
      <RouterContextProvider router={router}>{page}</RouterContextProvider>
    </AppProviders>,
  );
};

export { actionState, renderedAt };
