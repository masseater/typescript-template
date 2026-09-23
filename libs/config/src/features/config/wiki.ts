import { Schema } from "effect";

import { APPLICATION, applications } from "./applications.ts";

import type { Application } from "./applications.ts";

const wikiWorker = "internal-wiki";
const wikiBasePath = "/wiki";
const wikiServerFnBase = `${wikiBasePath}/_serverFn`;
const wikiPagesBinding = "WIKI";
const wikiApiBinding = "WIKI_API";
const wikiApiEntrypoint = "WikiApi";
const wikiDevOriginVariable = "WIKI_DEV_ORIGIN";
const wikiHost = APPLICATION.wiki;

type WikiWorker = typeof wikiWorker;

const buildTargets = [...applications, wikiWorker] as const;
type BuildTarget = (typeof buildTargets)[number];
const BuildTargetName = Schema.Literals(buildTargets);

const isWikiPath = (path: string): boolean =>
  path === wikiBasePath || path.startsWith(`${wikiBasePath}/`);

const hostOf = (target: BuildTarget): Application => (target === wikiWorker ? wikiHost : target);

export {
  BuildTargetName,
  buildTargets,
  hostOf,
  isWikiPath,
  wikiApiBinding,
  wikiApiEntrypoint,
  wikiBasePath,
  wikiDevOriginVariable,
  wikiHost,
  wikiPagesBinding,
  wikiServerFnBase,
  wikiWorker,
};
export type { BuildTarget, WikiWorker };
