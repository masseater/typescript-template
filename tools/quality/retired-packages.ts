const atomState = "Effect Atom (effect/unstable/reactivity と @effect/atom-react)";

const retiredPackages: Readonly<Record<string, string>> = {
  "@effect-atom/": atomState,
  "@legendapp/state": atomState,
  "@nanostores/": atomState,
  "@preact/signals-react": atomState,
  "@pulumi/": "alchemy",
  "@reduxjs/": atomState,
  "@tanstack/react-store": atomState,
  "@tanstack/store": atomState,
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  effector: atomState,
  "effector-react": atomState,
  jotai: atomState,
  mobx: atomState,
  "mobx-react": atomState,
  "mobx-react-lite": atomState,
  nanostores: atomState,
  pulumi: "alchemy",
  "react-intl": "Paraglide JS",
  "react-redux": atomState,
  recoil: atomState,
  redux: atomState,
  "smarthr-ui": "@template/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
  valtio: atomState,
  zustand: atomState,
};

const retiredEntries: Readonly<Record<string, string>> = {
  "@effect/atom-react/": "@effect/atom-react の root",
  "better-auth/react": "better-auth/client と Effect Atom",
  "effect/unstable/reactivity/": "effect/unstable/reactivity の root",
};

function replacementIn(
  table: Readonly<Record<string, string>>,
  specifier: string,
): string | undefined {
  const matched = Object.keys(table).find((retired) =>
    retired.endsWith("/")
      ? specifier.startsWith(retired)
      : specifier === retired || specifier.startsWith(`${retired}/`),
  );
  return matched === undefined ? undefined : table[matched];
}

function retiredDependency(dependency: string): string | undefined {
  return replacementIn(retiredPackages, dependency);
}

function retiredImport(source: string): string | undefined {
  return replacementIn({ ...retiredPackages, ...retiredEntries }, source);
}

export { retiredDependency, retiredImport, retiredPackages };
