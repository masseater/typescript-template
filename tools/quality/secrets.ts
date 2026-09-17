import { privateDeploymentKeys } from "@template/config/deployment";

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

function secretViolations(
  filename: string,
  content: string,
  environmentValues: readonly DeploymentValue[] = [],
): string[] {
  return [
    ...(privateFile(filename) ? ["private-file"] : []),
    ...Object.keys(contentRules).filter((rule) => contentRules[rule]?.test(content) === true),
    ...environmentValues.flatMap(({ key, value }) =>
      content.includes(value) ? [`deployment-value:${key}`] : [],
    ),
  ];
}

export { deploymentValues, secretViolations };
export type { DeploymentValue };
