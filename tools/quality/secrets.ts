import { privateDeploymentKeys } from "@template/config/deployment";

const ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$/u;
const QUOTED_PATTERN = /^(?<quote>["'])(?<body>.*)\k<quote>$/u;

function deploymentValues(content: string): string[] {
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
      return unquoted === "" ? [] : [unquoted];
    })
    .toSorted();
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
  environmentValues: readonly string[] = [],
): string[] {
  return [
    ...(privateFile(filename) ? ["private-file"] : []),
    ...Object.keys(contentRules).filter((rule) => contentRules[rule]?.test(content) === true),
    ...(environmentValues.some((value) => content.includes(value)) ? ["deployment-value"] : []),
  ];
}

export { deploymentValues, secretViolations };
