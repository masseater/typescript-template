const retiredPackages: Readonly<Record<string, string>> = {
  "@pulumi/": "alchemy",
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  pulumi: "alchemy",
  "react-intl": "Paraglide JS",
  "smarthr-ui": "@template/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
};

function isPrefix(retired: string): boolean {
  return retired.endsWith("/");
}

function replacementMessage(replacement: string): string {
  return `${replacement}を使ってください。`;
}

function replacementFor(dependency: string): string | undefined {
  const matched = Object.keys(retiredPackages).find(
    (retired) => dependency === retired || (isPrefix(retired) && dependency.startsWith(retired)),
  );
  return matched === undefined ? undefined : retiredPackages[matched];
}

const retiredImports = {
  patterns: Object.entries(retiredPackages).map(([retired, replacement]) => ({
    message: replacementMessage(replacement),
    regex: `^${RegExp.escape(retired)}${isPrefix(retired) ? ".+" : "(?:/.*)?"}$`,
  })),
};

export { replacementFor, replacementMessage, retiredImports, retiredPackages };
