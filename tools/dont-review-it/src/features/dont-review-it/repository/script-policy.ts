const packageManagers = new Set(["pnpm", "pnpx", "npm", "npx", "yarn", "yarnpkg", "bun", "bunx"]);
const launchers = new Set(["exec", "command", "env", "corepack"]);

const scriptPolicy = {
  destructiveBinaries: new Set(["alchemy"]),
  destructiveBinaryGuidance: {
    alchemy: "infra/cloudflare の src/cli.ts と src/bootstrap-state.ts から実行してください",
  },
} as const;

export { launchers, packageManagers, scriptPolicy };
