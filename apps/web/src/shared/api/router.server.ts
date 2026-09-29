import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export const createRouter = <const Prefix extends string>(prefix: Prefix) =>
  new Elysia({ prefix, adapter: CloudflareAdapter, aot: false });
