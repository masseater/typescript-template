import {
  contentRules,
  leaks,
  privateFile,
  type DeploymentValue,
  type PrefixScan,
} from "./secrets.ts";

const secretViolations = (
  staged: Readonly<{ content: string; filename: string }>,
  environmentValues: readonly DeploymentValue[] = [],
  scan: PrefixScan = "separated",
): string[] => {
  const { content, filename } = staged;
  return [
    ...(privateFile(filename) ? ["private-file"] : []),
    ...Object.keys(contentRules).filter((rule) => contentRules[rule]?.test(content) === true),
    ...environmentValues.flatMap((entry) =>
      leaks(content, entry, scan) ? [`deployment-value:${entry.key}`] : [],
    ),
  ];
};

export { secretViolations };
