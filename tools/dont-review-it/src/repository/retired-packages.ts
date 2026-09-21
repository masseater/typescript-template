import { retiredPackagesFromStateKinds } from "./state-kinds.ts";

const atomState = "Effect Atom (effect/unstable/reactivity と @effect/atom-react)";

const infrastructureRetiredPackages: Readonly<Record<string, string>> = {
  "@pulumi/": "alchemy",
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  pulumi: "alchemy",
  "react-intl": "Paraglide JS",
  "smarthr-ui": "@repo/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
};

const atomUiRetiredPackages: Readonly<Record<string, string>> = {
  "@effect-atom/": atomState,
  "@formatjs/": "Paraglide JS",
  "@legendapp/state": atomState,
  "@lingui/": "Paraglide JS",
  "@nanostores/": atomState,
  "@preact/signals-react": atomState,
  "@reduxjs/": atomState,
  "@tanstack/react-store": atomState,
  "@tanstack/store": atomState,
  effector: atomState,
  "effector-react": atomState,
  i18next: "Paraglide JS",
  jotai: atomState,
  mobx: atomState,
  "mobx-react": atomState,
  "mobx-react-lite": atomState,
  nanostores: atomState,
  "next-intl": "Paraglide JS",
  "react-i18next": "Paraglide JS",
  "react-redux": atomState,
  recoil: atomState,
  redux: atomState,
  "typesafe-i18n": "Paraglide JS",
  valtio: atomState,
  zustand: atomState,
};

const retiredPackages: Readonly<Record<string, string>> = {
  ...infrastructureRetiredPackages,
  ...atomUiRetiredPackages,
  ...retiredPackagesFromStateKinds(),
};

const retiredEntries: Readonly<Record<string, string>> = {
  "@effect/atom-react/": "@effect/atom-react の root",
  "better-auth/react": "better-auth/client と Effect Atom",
  "effect/unstable/reactivity/": "effect/unstable/reactivity の root",
};

const isPrefix = (retired: string): boolean => {
  return retired.endsWith("/");
};

const replacementIn = (
  table: Readonly<Record<string, string>>,
  specifier: string,
): string | undefined => {
  const matched = Object.keys(table).find((retired) =>
    isPrefix(retired)
      ? specifier.startsWith(retired)
      : specifier === retired || specifier.startsWith(`${retired}/`),
  );
  return matched === undefined ? undefined : table[matched];
};

const replacementFor = (specifier: string): string | undefined => {
  return replacementIn(retiredPackages, specifier);
};

const replacementForImport = (specifier: string): string | undefined => {
  return replacementIn({ ...retiredPackages, ...retiredEntries }, specifier);
};

const replacementMessage = (replacement: string): string => {
  return `${replacement}を使ってください。`;
};

const retiredImportGuidance = Object.entries({ ...retiredPackages, ...retiredEntries })
  .map(([retired, replacement]) => `${retired} は${replacementMessage(replacement)}`)
  .join("");

export {
  replacementFor,
  replacementForImport,
  replacementMessage,
  retiredImportGuidance,
  retiredPackages,
};
