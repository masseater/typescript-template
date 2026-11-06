import { Elysia } from "@r_masseater/workers-tracing/elysia";
import type { Elysia as App } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

const createRouter = <const Prefix extends string>(prefix: Prefix): App<Prefix> =>
  new Elysia({ prefix, adapter: CloudflareAdapter, aot: false });

export { createRouter };
