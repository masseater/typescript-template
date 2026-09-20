import "@repo/ui/styles.css";
import a11y from "@storybook/addon-a11y";
import vitest from "@storybook/addon-vitest";
import { definePreview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import msw from "msw-storybook-addon";
import { useState, type ReactElement } from "react";

const router = createRouter({ routeTree: createRootRoute() });

const Providers = ({ children }: Readonly<{ children: ReactElement }>): ReactElement => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </QueryClientProvider>
  );
};

const withProviders = (Story: () => ReactElement): ReactElement => (
  <Providers>
    <Story />
  </Providers>
);

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  decorators: [withProviders],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

export default preview;
