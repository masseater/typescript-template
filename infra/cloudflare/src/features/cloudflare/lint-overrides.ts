const cloudflareSourceFiles = [
  "infra/cloudflare/src/features/cloudflare/**",
  "apps/**/alchemy.run.ts",
];

const cloudflareNewCapExceptions = {
  capIsNewExceptionPattern: "^(?:Schema|Context|Data|Config|ApiToken|D1|Email|Workers|Zone)\\.",
  capIsNewExceptions: ["DurableObject", "InMemoryService", "Stack", "Worker"],
};

export { cloudflareNewCapExceptions, cloudflareSourceFiles };
