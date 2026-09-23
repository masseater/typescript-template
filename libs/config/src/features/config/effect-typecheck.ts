const effectTsgoNoEmit = (project: string): string =>
  `"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p ${project}`;

const effectTypecheckInputs = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
  { base: "workspace", pattern: "!**/node_modules/.bin/**" },
  { base: "workspace", pattern: "**/*.{ts,tsx}" },
  { base: "workspace", pattern: "**/package.json" },
  { base: "workspace", pattern: "**/tsconfig*.json" },
  { base: "workspace", pattern: "!**/node_modules/**" },
  { base: "workspace", pattern: "!**/dist/**" },
  { base: "workspace", pattern: "!**/.paraglide/**" },
  { base: "workspace", pattern: "!**/.local/**" },
] as const;

export { effectTsgoNoEmit, effectTypecheckInputs };
