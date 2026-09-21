const workersStub = new URL("./cloudflare-workers-stub.mjs", import.meta.url).href;
const workflowsStub = new URL("./cloudflare-workflows-stub.mjs", import.meta.url).href;

function stubUrl(specifier) {
  if (specifier === "cloudflare:workers" || specifier.startsWith("cloudflare:workers")) {
    return workersStub;
  }
  if (specifier === "cloudflare:workflows" || specifier.startsWith("cloudflare:workflows")) {
    return workflowsStub;
  }
  return undefined;
}

export function resolve(specifier, context, nextResolve) {
  const url = stubUrl(specifier);
  return url === undefined ? nextResolve(specifier, context) : { shortCircuit: true, url };
}

export function load(url, context, nextLoad) {
  if (url.startsWith("cloudflare:workers")) {
    return nextLoad(workersStub, { ...context, format: "module" });
  }
  if (url.startsWith("cloudflare:workflows")) {
    return nextLoad(workflowsStub, { ...context, format: "module" });
  }
  return nextLoad(url, context);
}
