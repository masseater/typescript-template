import "@repo/ui/styles.css";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import msw from "msw-storybook-addon";

import type { ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const withProviders = (Story: () => ReactElement): ReactElement => {
  return (
    <RegistryProvider>
      <RouterContextProvider router={router}>
        <Story />
      </RouterContextProvider>
    </RegistryProvider>
  );
};

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

export default preview;
