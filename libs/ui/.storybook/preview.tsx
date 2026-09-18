// oxlint-disable-next-line import/no-unassigned-import
import "@template/ui/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { RegistryProvider } from "@effect/atom-react";
import a11y from "@storybook/addon-a11y";
import { definePreview } from "@storybook/react-vite";
import msw from "msw-storybook-addon";
import vitest from "@storybook/addon-vitest";

const router = createRouter({ routeTree: createRootRoute() });

function withProviders(Story: () => ReactElement): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <RegistryProvider>
        <RouterContextProvider router={router}>
          <Story />
        </RouterContextProvider>
      </RegistryProvider>
    </QueryClientProvider>
  );
}

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

// oxlint-disable-next-line import/no-default-export
export default preview;
