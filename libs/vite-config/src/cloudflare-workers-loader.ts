import type { LoadHookSync, ResolveHookSync } from "node:module";

const workersStub = new URL("./cloudflare-workers-stub.mjs", import.meta.url).href;
const workflowsStub = new URL("./cloudflare-workflows-stub.mjs", import.meta.url).href;

const stubUrl = (specifier: string): string | undefined => {
  if (specifier === "cloudflare:workers" || specifier.startsWith("cloudflare:workers")) {
    return workersStub;
  }
  if (specifier === "cloudflare:workflows" || specifier.startsWith("cloudflare:workflows")) {
    return workflowsStub;
  }
  return undefined;
};

const resolve: ResolveHookSync = (specifier, resolveContext, nextResolve) => {
  const url = stubUrl(specifier);
  return url === undefined ? nextResolve(specifier, resolveContext) : { shortCircuit: true, url };
};

const load: LoadHookSync = (url, loadContext, nextLoad) => {
  if (url.startsWith("cloudflare:workers")) {
    return nextLoad(workersStub, { ...loadContext, format: "module" });
  }
  if (url.startsWith("cloudflare:workflows")) {
    return nextLoad(workflowsStub, { ...loadContext, format: "module" });
  }
  return nextLoad(url, loadContext);
};

export { load, resolve };
