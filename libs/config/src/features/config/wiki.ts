import { Schema } from "effect";

import { APPLICATION, type Application, applications } from "./applications.ts";

const wikiBasePath = "/wiki";
const wikiServerFnBase = `${wikiBasePath}/_serverFn`;
const wikiPagesBinding = "WIKI";
const wikiApiBinding = "WIKI_API";
const wikiApiEntrypoint = "WikiApi";
const wikiDevOriginVariable = "WIKI_DEV_ORIGIN";
const wikiHost = APPLICATION.internalDashboard;

const wikiPort = 3004;

const wikiWorker = "internal-wiki";

type WikiWorker = typeof wikiWorker;

const buildTargets = [...applications, wikiWorker] as const;
type BuildTarget = (typeof buildTargets)[number];
const BuildTargetName = Schema.Literals(buildTargets);

const isWikiPath = (path: string): boolean =>
  path === wikiBasePath || path.startsWith(`${wikiBasePath}/`);

const hostOf = (buildTarget: BuildTarget): Application =>
  buildTarget === wikiWorker ? wikiHost : buildTarget;

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
  wikiPort,
  wikiServerFnBase,
  wikiWorker,
};
export type { BuildTarget, WikiWorker };
