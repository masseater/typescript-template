import { privateDeploymentKeys } from "@repo/config/deployment";

const ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$/u;
const QUOTED_PATTERN = /^(?<quote>["'])(?<body>.*)\k<quote>$/u;

interface DeploymentValue {
  readonly key: string;
  readonly value: string;
}

function byKey(left: DeploymentValue, right: DeploymentValue): number {
  return left.key.localeCompare(right.key);
}

function deploymentValues(content: string): DeploymentValue[] {
  return content
    .split("\n")
    .flatMap((line) => {
      const groups = ASSIGNMENT_PATTERN.exec(line)?.groups;
      const key = groups?.["key"];
      const value = groups?.["value"]?.trim();
      if (key === undefined || value === undefined || !privateDeploymentKeys.includes(key)) {
        return [];
      }
      const unquoted = QUOTED_PATTERN.exec(value)?.groups?.["body"] ?? value;
      return unquoted === "" ? [] : [{ key, value: unquoted }];
    })
    .toSorted(byKey);
}

function privateFile(filename: string): boolean {
  return (
    /(?:^|\/)(?:\.local(?:-agents)?|\.artifacts)(?:\/|$)/u.test(filename) ||
    (/(?:^|\/)(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?)$/u.test(filename) &&
      !filename.endsWith("/.env.example") &&
      filename !== ".env.example")
  );
}

const contentRules: Readonly<Record<string, RegExp>> = {
  "aws-access-key": /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  "github-token": /\bgh[pousr]_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{60,255}\b/u,
  "private-key": /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
};

const PREFIX_KEY = "TEMPLATE_PREFIX";
const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/gu;

type PrefixScan = "separated" | "word";

function quoted(value: string): string {
  return value.replaceAll(REGEXP_METACHARACTERS, String.raw`\$&`);
}

function wordPattern(value: string): RegExp {
  return new RegExp(`(?<![0-9A-Za-z])${quoted(value)}(?![0-9A-Za-z])`, "u");
}

function separatedPattern(value: string): RegExp {
  return new RegExp(`(?<![0-9A-Za-z_-])${quoted(value)}(?=[-/])`, "u");
}

function prefixPattern(value: string, scan: PrefixScan): RegExp {
  return scan === "word" ? wordPattern(value) : separatedPattern(value);
}

function leaks(content: string, { key, value }: DeploymentValue, scan: PrefixScan): boolean {
  return key === PREFIX_KEY ? prefixPattern(value, scan).test(content) : content.includes(value);
}

function prefixScan(
  environmentValues: readonly DeploymentValue[],
  contents: readonly string[],
): PrefixScan {
  const prefix = environmentValues.find((entry) => entry.key === PREFIX_KEY)?.value;
  if (prefix === undefined) {
    return "word";
  }
  const pattern = wordPattern(prefix);
  return contents.some((content) => pattern.test(content)) ? "separated" : "word";
}

function secretViolations(
  staged: Readonly<{ content: string; filename: string }>,
  environmentValues: readonly DeploymentValue[] = [],
  scan: PrefixScan = "separated",
): string[] {
  const { content, filename } = staged;
  return [
    ...(privateFile(filename) ? ["private-file"] : []),
    ...Object.keys(contentRules).filter((rule) => contentRules[rule]?.test(content) === true),
    ...environmentValues.flatMap((entry) =>
      leaks(content, entry, scan) ? [`deployment-value:${entry.key}`] : [],
    ),
  ];
}

export { deploymentValues, prefixScan, secretViolations };
export type { DeploymentValue, PrefixScan };
