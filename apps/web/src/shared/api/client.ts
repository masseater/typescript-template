import { treaty, type Treaty } from "@elysiajs/eden";
import { createEdenOptionsProxy } from "eden-tanstack-react-query";
import type { AnyElysia } from "elysia";

const SERVER_ORIGIN = "http://localhost";

export const serverClient = <App extends AnyElysia>(load: () => Promise<App>) =>
  treaty<App>(SERVER_ORIGIN, {
    fetcher: async (input, init) => (await load()).handle(new Request(input, init)),
  });

export const browserClient = <App extends AnyElysia>() => treaty<App>(window.location.origin);

export const createQueries = <App extends AnyElysia>(client: Treaty.Create<App>) =>
  createEdenOptionsProxy<App>({ client });
