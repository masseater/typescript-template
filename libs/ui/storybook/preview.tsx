import "@repo/ui/styles.css";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import msw from "msw-storybook-addon";

import { BaseWebProvider } from "../src/baseweb-provider.tsx";
import { FieldValidationMessageProvider } from "../src/shared/ui/field-validation-message-provider.tsx";

import type { ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const japaneseFieldValidationMessages = {
  patternMismatch: "指定された形式で入力してください。",
  tooLong: "文字数が多すぎます。",
  tooShort: "文字数が足りません。",
  typeMismatch: "正しい形式で入力してください。",
  valueMissing: "入力してください。",
} as const;

const withQueryRouter = (story: ReactElement): ReactElement => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
    }
  >
    <RouterContextProvider router={router}>{story}</RouterContextProvider>
  </QueryClientProvider>
);

const withProviders = (Story: () => ReactElement): ReactElement => {
  return (
    <BaseWebProvider>
      <FieldValidationMessageProvider messages={japaneseFieldValidationMessages}>
        <RegistryProvider>{withQueryRouter(<Story />)}</RegistryProvider>
      </FieldValidationMessageProvider>
    </BaseWebProvider>
  );
};

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

const playTask = <TaskResult,>(task: () => TaskResult): Effect.Effect<Awaited<TaskResult>> =>
  Effect.promise(() => Promise.resolve(task()));

export { playTask };
export default preview;
