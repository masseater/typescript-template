const workersStub = new URL("./cloudflare-workers-stub.mjs", import.meta.url).href;
const workflowsStub = new URL("./cloudflare-workflows-stub.mjs", import.meta.url).href;

const stubUrl = (specifier) => {
  const moduleSpecifier = String(specifier);
  if (
    moduleSpecifier === "cloudflare:workers" ||
    moduleSpecifier.startsWith("cloudflare:workers")
  ) {
    return workersStub;
  }
  if (
    moduleSpecifier === "cloudflare:workflows" ||
    moduleSpecifier.startsWith("cloudflare:workflows")
  ) {
    return workflowsStub;
  }
  return undefined;
};

export const resolve = (specifier, resolveContext, nextResolve) => {
  const url = stubUrl(specifier);
  return url === undefined ? nextResolve(specifier, resolveContext) : { shortCircuit: true, url };
};

export const load = (url, loadContext, nextLoad) => {
  const href = String(url);
  if (href.startsWith("cloudflare:workers")) {
    return nextLoad(workersStub, { ...loadContext, format: "module" });
  }
  if (href.startsWith("cloudflare:workflows")) {
    return nextLoad(workflowsStub, { ...loadContext, format: "module" });
  }
  return nextLoad(url, loadContext);
};
