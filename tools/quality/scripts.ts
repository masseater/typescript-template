function words(command: string): string[][] {
  const result: string[][] = [];
  let segment: string[] = [];
  let word = "";
  let quote: string | null = null;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      if (character !== "\n") word += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else word += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (";&|\n".includes(character)) {
      if (word) segment = [...segment, word];
      if (segment.length) result.push(segment);
      word = "";
      segment = [];
    } else if (/\s/.test(character)) {
      if (word) segment = [...segment, word];
      word = "";
    } else {
      word += character;
    }
  }
  if (quote || escaped) throw new Error("Script has an unfinished shell quote or escape");
  if (word) segment = [...segment, word];
  if (segment.length) result.push(segment);
  return result;
}

const packageManagers = new Set(["pnpm", "pnpx", "npm", "npx", "yarn", "yarnpkg", "bun", "bunx"]);
const launchers = new Set(["exec", "command", "env", "corepack"]);

function callsPackageManager(tokens: string[]): boolean {
  const command = tokens.find(
    (word) => !launchers.has(word) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word),
  );
  if (command === undefined) return false;
  return packageManagers.has(command.replace(/^.*\//, "").replace(/\.cmd$/, ""));
}

export function scriptViolations(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null || !("scripts" in manifest)) return [];
  const scripts: unknown = manifest.scripts;
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts))
    throw new Error("package.json scripts must be an object");
  return Object.entries(scripts).flatMap(([name, command]) => {
    if (typeof command !== "string") throw new Error(`Script ${name} must be a string`);
    return words(command).some(callsPackageManager)
      ? [
          `${name}: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
        ]
      : [];
  });
}
