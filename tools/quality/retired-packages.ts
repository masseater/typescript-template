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

const retiredImports = {
  paths: Object.entries(retiredPackages)
    .filter(([retired]) => !isPrefix(retired))
    .map(([name, replacement]) => ({ message: `${replacement} を使ってください。`, name })),
  patterns: Object.entries(retiredPackages)
    .filter(([retired]) => isPrefix(retired))
    .map(([prefix, replacement]) => ({
      group: [`${prefix}*`],
      message: `${replacement} を使ってください。`,
    })),
};

export { isPrefix, retiredImports, retiredPackages };
