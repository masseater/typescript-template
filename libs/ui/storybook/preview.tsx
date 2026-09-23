import "@repo/ui/styles.css";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import msw from "msw-storybook-addon";

import { BaseWebProvider } from "../src/features/ui/baseweb-provider.tsx";
import { MotionProvider } from "../src/features/ui/motion-provider.tsx";
import { FieldValidationMessageProvider } from "../src/features/ui/shared/ui/field-validation-message-provider.tsx";
import { japaneseFieldValidationMessages } from "../src/features/ui/shared/ui/field-validation-messages.ts";

import type { ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const withRouter = (Story: () => ReactElement): ReactElement => {
  return (
    <RouterContextProvider router={router}>
      <Story />
    </RouterContextProvider>
  );
};

const withProviders = (Story: () => ReactElement): ReactElement => {
  return (
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
};

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withRouter, withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

const playTask = <TaskResult,>(task: () => TaskResult): Effect.Effect<Awaited<TaskResult>> =>
  Effect.promise(() => Promise.resolve(task()));

export { playTask };
export default preview;
