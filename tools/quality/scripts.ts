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

const valueOptions = new Set([
  "--filter",
  "--filter-prod",
  "-F",
  "--dir",
  "-C",
  "--workspace-concurrency",
  "--reporter",
  "--resume-from",
]);
const booleanOptions = new Set([
  "-r",
  "--recursive",
  "-w",
  "--workspace-root",
  "--if-present",
  "--parallel",
  "--stream",
  "--aggregate-output",
  "--silent",
  "-s",
  "--fail-if-no-match",
  "--no-bail",
  "--no-sort",
  "--reverse",
]);
const isFilter = (value: string) =>
  value === "--filter" ||
  value === "--filter-prod" ||
  value === "-F" ||
  value.startsWith("--filter=") ||
  value.startsWith("--filter-prod=") ||
  value.startsWith("-F=") ||
  (value.startsWith("-F") && value.length > 2);

function violatesRun(tokens: string[]): boolean {
  const index = tokens.findIndex((word) => /(?:^|\/)pnpm(?:\.cmd)?$/.test(word));
  if (index === -1) return false;
  if (
    tokens
      .slice(0, index)
      .some(
        (word) =>
          !["exec", "command", "env", "corepack"].includes(word) &&
          !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word),
      )
  )
    return false;
  const args = tokens.slice(index + 1);
  let filtered = false;
  let command: string | undefined;
  let uncertainOption = false;
  for (let position = 0; position < args.length; position++) {
    const argument = args[position];
    if (argument === undefined) continue;
    if (argument === "--") break;
    if (isFilter(argument)) filtered = true;
    if (valueOptions.has(argument)) {
      position++;
      continue;
    }
    if (argument.startsWith("-")) {
      if (!booleanOptions.has(argument) && !isFilter(argument) && !argument.includes("="))
        uncertainOption = true;
      continue;
    }
    if (!command) {
      command = argument;
      if (command === "run") break;
    }
  }
  return filtered && (command !== "run" || uncertainOption);
}

export function scriptViolations(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null || !("scripts" in manifest)) return [];
  const scripts: unknown = manifest.scripts;
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts))
    throw new Error("package.json scripts must be an object");
  return Object.entries(scripts).flatMap(([name, command]) => {
    if (typeof command !== "string") throw new Error(`Script ${name} must be a string`);
    return words(command).some(violatesRun)
      ? [`${name}: pnpm --filter に続く workspace script は必ず run を明示してください: ${command}`]
      : [];
  });
}
