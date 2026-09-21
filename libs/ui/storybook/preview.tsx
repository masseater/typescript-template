import "@repo/ui/styles.css";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import msw from "msw-storybook-addon";

import type { ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const withProviders = (Story: () => ReactElement): ReactElement => (
  <RegistryProvider>
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <RouterContextProvider router={router}>
        <Story />
      </RouterContextProvider>
    </QueryClientProvider>
  </RegistryProvider>
);

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

export default preview;
