const cloudflareSourceFiles = [
  "infra/cloudflare/src/**",
  "apps/**/alchemy.run.ts",
  "infra/**/alchemy.run.ts",
];

const cloudflareNewCapExceptions = {
  capIsNewExceptionPattern: "^(?:Schema|Context|Data|Config|ApiToken|D1|Email|Workers|Zone)\\.",
  capIsNewExceptions: ["DurableObject", "InMemoryService", "Stack", "Worker"],
};

export { cloudflareNewCapExceptions, cloudflareSourceFiles };
