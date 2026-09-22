const cloudflareSourceFiles = ["infra/cloudflare/src/features/cloudflare/**"];

const cloudflareNewCapExceptions = {
  capIsNewExceptionPattern: "^(?:Schema|Context|Data|Config|ApiToken|D1|Email|Workers|Zone)\\.",
  capIsNewExceptions: ["DurableObject", "InMemoryService", "Stack", "Worker"],
};

export { cloudflareNewCapExceptions, cloudflareSourceFiles };
