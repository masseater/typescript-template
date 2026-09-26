import { deploymentKey, privateDeploymentKeys } from "@repo/observability/deployment-keys";
import { isSecretFileName } from "@repo/vite-config/private-path";
import { ConfigProvider, Effect } from "effect";

interface DeploymentValue {
  readonly key: string;
  readonly value: string;
}

const byKey = (left: DeploymentValue, right: DeploymentValue): number =>
  left.key.localeCompare(right.key);

const deploymentValues = (content: string): DeploymentValue[] => {
  const provider = ConfigProvider.fromDotEnvContents(content);
  return privateDeploymentKeys
    .flatMap((key) => {
      const value = Effect.runSync(provider.load([key]))?.value;
      return value === undefined || value === "" ? [] : [{ key, value }];
    })
    .toSorted(byKey);
};

type PrefixScan = "separated" | "word";

const quoted = (value: string): string => RegExp.escape(value);

const wordPattern = (value: string): RegExp =>
  new RegExp(`(?<![0-9A-Za-z])${quoted(value)}(?![0-9A-Za-z])`, "u");

const separatedPattern = (value: string): RegExp =>
  new RegExp(`(?<![0-9A-Za-z_-])${quoted(value)}(?=[-/])`, "u");

const prefixPattern = (value: string, scan: PrefixScan): RegExp =>
  scan === "word" ? wordPattern(value) : separatedPattern(value);

const PREFIX_KEY = deploymentKey.prefix;

const exampleEnvironment = ".env.example";

const prefixScan = (
  environmentValues: readonly DeploymentValue[],
  contents: readonly string[],
): PrefixScan => {
  const prefix = environmentValues.find((entry) => entry.key === PREFIX_KEY)?.value;
  if (prefix === undefined) {
    return "word";
  }
  const pattern = wordPattern(prefix);
  return contents.some((content) => pattern.test(content)) ? "separated" : "word";
};

const privateFile = (filename: string): boolean => {
  const name = filename.split("/").at(-1) ?? filename;
  return (
    /(?:^|\/)(?:\.local(?:-agents)?|\.artifacts)(?:\/|$)/u.test(filename) ||
    (isSecretFileName(name) &&
      name !== exampleEnvironment &&
      !filename.endsWith(`/${exampleEnvironment}`))
  );
};

const contentRules: Readonly<Record<string, RegExp>> = {
  "aws-access-key": /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  "github-token": /\bgh[pousr]_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{60,255}\b/u,
  "private-key": /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
};

const leaks = (content: string, { key, value }: DeploymentValue, scan: PrefixScan): boolean =>
  key === PREFIX_KEY ? prefixPattern(value, scan).test(content) : content.includes(value);

export { contentRules, deploymentValues, leaks, PREFIX_KEY, prefixScan, privateFile };
export type { DeploymentValue, PrefixScan };
