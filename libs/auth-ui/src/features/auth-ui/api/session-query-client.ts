import { QueryClient } from "@tanstack/react-query";

import { provideSessionLoader } from "./session.ts";

const sessionQueryClient = (load: Parameters<typeof provideSessionLoader>[1]): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { networkMode: "always" }, queries: { networkMode: "always" } },
  });
  provideSessionLoader(queryClient, load);
  return queryClient;
};

export { sessionQueryClient };
