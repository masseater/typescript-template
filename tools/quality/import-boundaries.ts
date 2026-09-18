// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { retiredImport } from "./retired-packages.ts";

interface PackageLocation {
  readonly area: string;
  readonly owner: string;
  readonly root: string;
}

interface Importer {
  readonly current: string;
  readonly isTest: boolean;
  readonly location: PackageLocation | undefined;
}

interface ImportTarget {
  readonly area: string | undefined;
  readonly app: string | undefined;
  readonly clean: string;
  readonly relative: boolean;
  readonly resolved: string;
}

type ImportRule = (importer: Importer, target: ImportTarget) => boolean;

function packageLocation(current: string): PackageLocation | undefined {
  const groups = /^(?<root>.*?)\/(?<area>apps|libs|tools|infra)\/(?<owner>[^/]+)\//u.exec(
    current,
  )?.groups;
  const root = groups?.["root"];
  const area = groups?.["area"];
  const owner = groups?.["owner"];
  return root === undefined || area === undefined || owner === undefined
    ? undefined
    : { area, owner, root };
}

function importerOf(current: string): Importer {
  return {
    current,
    isTest: /(?:\.(?:test|spec)|-fixture)\.[cm]?[jt]sx?$/u.test(current),
    location: packageLocation(current),
  };
}

function importTargetOf(importer: Importer, source: string): ImportTarget {
  const clean = source.replaceAll("\\", "/").split(/[?#]/u)[0] ?? source;
  const relative = clean.startsWith(".") || path.isAbsolute(clean);
  const resolved = relative
    ? path.resolve(path.dirname(importer.current), clean).replaceAll("\\", "/")
    : clean;
  const target = /\/(?<area>apps|libs|tools|infra)\/(?<owner>[^/]+)(?:\/|$)/u.exec(
    resolved,
  )?.groups;
  const namedApp = /^@template\/(?<app>user|admin|wiki)(?:\/|$)/u.exec(clean)?.groups?.["app"];
  return {
    app: target?.["area"] === "apps" ? target["owner"] : namedApp,
    area: target?.["area"],
    clean,
    relative,
    resolved,
  };
}

function isApplicationOrLibrary(importer: Importer): boolean {
  return importer.location?.area === "apps" || importer.location?.area === "libs";
}

function isWithinDatabase(importer: Importer): boolean {
  return importer.location?.area === "libs" && importer.location.owner === "db";
}

function isDatabaseRoot(importer: Importer): boolean {
  return isWithinDatabase(importer) && /\/src\/index\.[cm]?[jt]s$/u.test(importer.current);
}

function isDatabaseRuntime(importer: Importer): boolean {
  return (
    isWithinDatabase(importer) &&
    !importer.isTest &&
    !/\/src\/(?:remote[^/]*|bootstrap[^/]*|migrate[^/]*|testing[^/]*)\.[cm]?[jt]s$/u.test(
      importer.current,
    )
  );
}

function crossesApplication(importer: Importer, target: ImportTarget): boolean {
  const { location } = importer;
  return (
    target.app !== undefined &&
    (location?.area === "libs" || (location?.area === "apps" && location.owner !== target.app))
  );
}

function escapesPackage({ location }: Importer, target: ImportTarget): boolean {
  return (
    target.relative &&
    location !== undefined &&
    (location.area === "apps" || location.area === "libs") &&
    !target.resolved.startsWith(`${location.root}/${location.area}/${location.owner}/`)
  );
}

function reachesDeploymentConfig(importer: Importer, target: ImportTarget): boolean {
  const { location } = importer;
  return (
    (/^@template\/config\/deployment$/u.test(target.clean) ||
      /\/libs\/config\/src\/deployment(?:\.[cm]?ts)?$/u.test(target.resolved)) &&
    (location?.area === "apps" || location?.area === "libs")
  );
}

function reachesTools({ location }: Importer, target: ImportTarget): boolean {
  return (
    (location?.area === "apps" || location?.area === "libs" || location?.area === "infra") &&
    target.area === "tools"
  );
}

function leaksDatabaseAdmin(importer: Importer, target: ImportTarget): boolean {
  const importsAdmin =
    /^@template\/db\/(?:src\/)?admin(?:[/.]|$)/u.test(target.clean) ||
    /\/libs\/db\/(?:src\/)?admin(?:[/.]|$)/u.test(target.resolved);
  const { location } = importer;
  return (
    importsAdmin &&
    ((location?.area === "apps" && location.owner === "user") ||
      (location?.area === "libs" && !isWithinDatabase(importer) && !importer.isTest) ||
      isDatabaseRoot(importer))
  );
}

function leaksDatabaseOperations(importer: Importer, target: ImportTarget): boolean {
  const importsOperations =
    /^@template\/db\/(?:src\/)?(?:remote[^/]*|bootstrap[^/]*|migrat[^/]*|testing[^/]*)(?:[/.]|$)/u.test(
      target.clean,
    ) ||
    /\/libs\/db\/(?:src\/)?(?:remote[^/]*|bootstrap[^/]*|migrat[^/]*|testing[^/]*)(?:[/.]|$)/u.test(
      target.resolved,
    );
  const testSupport = importer.isTest && /\/testing[^/]*(?:[/.]|$)/u.test(target.resolved);
  return (
    importsOperations &&
    (importer.location?.area === "apps" ||
      (importer.location?.area === "libs" &&
        (isDatabaseRuntime(importer) || (!isWithinDatabase(importer) && !testSupport))))
  );
}

function usesRawDriver(importer: Importer, target: ImportTarget): boolean {
  return (
    !isWithinDatabase(importer) &&
    /^(?:drizzle-orm|drizzle-kit|better-sqlite3|sqlite3|node:sqlite|pg|postgres)(?:\/|$)/u.test(
      target.clean,
    )
  );
}

function importsTestCode(importer: Importer, target: ImportTarget): boolean {
  return (
    !importer.isTest &&
    /(?:\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$|^@template\/db\/testing$)/u.test(target.clean)
  );
}

function reachesPackageSource(_importer: Importer, target: ImportTarget): boolean {
  return /^@template\/[^/]+\/src(?:\/|$)/u.test(target.clean);
}

function privilegedAppImportsSignup({ location }: Importer, target: ImportTarget): boolean {
  return (
    location?.area === "apps" && location.owner !== "user" && target.clean === "@template/ui/signup"
  );
}

function importsRetired(_importer: Importer, target: ImportTarget): boolean {
  return retiredImport(target.clean) !== undefined;
}

function wikiImportsDatabase({ location }: Importer, target: ImportTarget): boolean {
  return (
    location?.area === "apps" &&
    location.owner === "wiki" &&
    ((/^@template\/db(?:\/|$)/u.test(target.clean) && target.clean !== "@template/db/local") ||
      /\/libs\/db(?:\/|$)/u.test(target.resolved))
  );
}

const importRules: readonly ImportRule[] = [
  crossesApplication,
  escapesPackage,
  reachesDeploymentConfig,
  reachesTools,
  leaksDatabaseAdmin,
  leaksDatabaseOperations,
  usesRawDriver,
  importsTestCode,
  reachesPackageSource,
  privilegedAppImportsSignup,
  wikiImportsDatabase,
  importsRetired,
];

function isForbiddenImport(importer: Importer, source: string): boolean {
  const target = importTargetOf(importer, source);
  return importRules.some((rule) => rule(importer, target));
}

export { importerOf, isApplicationOrLibrary, isForbiddenImport };
