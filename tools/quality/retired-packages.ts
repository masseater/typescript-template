const retiredPackages: Readonly<Record<string, string>> = {
  "@pulumi/": "alchemy",
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  "eslint-plugin-react-doctor": "vp run check:react が実行する react-doctor",
  "oxlint-plugin-react-doctor": "vp run check:react が実行する react-doctor",
  pulumi: "alchemy",
  "react-intl": "Paraglide JS",
  "smarthr-ui": "@repo/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
};

const isPrefix = (retired: string): boolean => {
  return retired.endsWith("/");
};

const replacementFor = (specifier: string): string | undefined => {
  const matched = Object.keys(retiredPackages).find((retired) =>
    isPrefix(retired)
      ? specifier.startsWith(retired)
      : specifier === retired || specifier.startsWith(`${retired}/`),
  );
  return matched === undefined ? undefined : retiredPackages[matched];
};

const replacementMessage = (replacement: string): string => {
  return `${replacement}を使ってください。`;
};

const retiredImportGuidance = Object.entries(retiredPackages)
  .map(([retired, replacement]) => `${retired} は${replacementMessage(replacement)}`)
  .join("");

export { replacementFor, replacementMessage, retiredImportGuidance, retiredPackages };
