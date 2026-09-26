import "@repo/ui/styles.css";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import msw from "msw-storybook-addon";

import { BaseWebProvider } from "../src/features/ui/baseweb-provider.tsx";
import { MotionProvider } from "../src/features/ui/motion-provider.tsx";
import { FieldValidationMessageProvider } from "../src/features/ui/shared/ui/field-validation-message-provider.tsx";
import { japaneseFieldValidationMessages } from "../src/features/ui/shared/ui/field-validation-messages.ts";

import type { ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const withRouter = (Story: () => ReactElement): ReactElement => (
  <RouterContextProvider router={router}>
    <Story />
  </RouterContextProvider>
);

const withQueries = (
  Story: () => ReactElement,
  { loaded }: Readonly<{ loaded: Readonly<Record<string, unknown>> }>,
): ReactElement => {
  const { queryClient } = loaded;
  return queryClient instanceof QueryClient ? (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  ) : (
    <Story />
  );
};

const storyQueries = (): { readonly queryClient: QueryClient } => ({
  queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
});

const withProviders = (Story: () => ReactElement): ReactElement => (
  <BaseWebProvider>
    <FieldValidationMessageProvider messages={japaneseFieldValidationMessages}>
      <RegistryProvider>
        <MotionProvider>
          <Story />
        </MotionProvider>
      </RegistryProvider>
    </FieldValidationMessageProvider>
  </BaseWebProvider>
);

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withRouter, withQueries, withProviders],
  loaders: [storyQueries],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

const playTask = <TaskResult,>(task: () => TaskResult): Effect.Effect<Awaited<TaskResult>> =>
  Effect.promise(() => Promise.resolve(task()));

export { playTask };
export default preview;
