interface RetiredImportPattern {
  readonly group: string[];
  readonly message: string;
}

const atomState = "Effect Atom (effect/unstable/reactivity と @effect/atom-react)";
const serverState = "TanStack Query (@template/ui の serverQuery と useServerQuery)";

const retiredPackages: Readonly<Record<string, string>> = {
  "@ai-sdk/react": atomState,
  "@apollo/client": serverState,
  "@effect-atom/": atomState,
  "@legendapp/state": atomState,
  "@nanostores/": atomState,
  "@preact/signals-react": atomState,
  "@pulumi/": "alchemy",
  "@reduxjs/": atomState,
  "@tanstack/ai-react": atomState,
  "@tanstack/db": atomState,
  "@tanstack/form-core": atomState,
  "@tanstack/react-db": atomState,
  "@tanstack/react-form": atomState,
  "@tanstack/react-store": atomState,
  "@tanstack/store": atomState,
  "@trpc/": serverState,
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  "@urql/": serverState,
  "@xstate/": atomState,
  effector: atomState,
  "effector-react": atomState,
  formik: atomState,
  jotai: atomState,
  mobx: atomState,
  "mobx-react": atomState,
  "mobx-react-lite": atomState,
  nanostores: atomState,
  pulumi: "alchemy",
  "react-final-form": atomState,
  "react-hook-form": atomState,
  "react-intl": "Paraglide JS",
  "react-query": serverState,
  "react-redux": atomState,
  "react-relay": serverState,
  recoil: atomState,
  redux: atomState,
  "relay-runtime": serverState,
  "smarthr-ui": "@template/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
  swr: serverState,
  urql: serverState,
  valtio: atomState,
  xstate: atomState,
  zustand: atomState,
};

function importPatterns(retired: string): string[] {
  return retired.endsWith("/") ? [`${retired}*`] : [retired, `${retired}/*`];
}

function retiredImportPatterns(): RetiredImportPattern[] {
  const replacements = new Set(Object.values(retiredPackages));
  return [...replacements].map((replacement) => ({
    group: Object.keys(retiredPackages)
      .filter((retired) => retiredPackages[retired] === replacement)
      .flatMap((retired) => importPatterns(retired)),
    message: `${replacement} を使ってください。`,
  }));
}

export { retiredImportPatterns, retiredPackages };
