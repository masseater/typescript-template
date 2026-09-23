import { APPLICATION, buildTargets, hostOf, type BuildTarget } from "@repo/config";

import { paths } from "./host.ts";

const applicationsExcept = (application: BuildTarget): BuildTarget[] =>
  buildTargets.filter(
    (candidate) => candidate !== application && candidate !== hostOf(application),
  );

const hostPrivatePath = (slashedPath: string, application: BuildTarget): boolean => {
  const host = hostOf(application);
  return (
    host !== application &&
    new RegExp(`(?:^|/)apps/${host}/(?!content(?:/|$))`, "u").test(slashedPath)
  );
};

const secretFileName = /^(?:\.env.*|\.dev\.vars.*|.*\.(?:pem|key))$/u;

const isSecretFileName = (fileName: string): boolean => secretFileName.test(fileName);

const privateAdminPath = (slashedPath: string, application: BuildTarget): boolean =>
  application !== APPLICATION.admin &&
  (/(?:^|\/)libs\/db\/src\/features\/db\/admin(?:\.[^/]*)?$/u.test(slashedPath) ||
    /@repo\/db\/admin(?:\/|$)/u.test(slashedPath));

const privatePath = ({
  application,
  candidatePath,
  repositoryRoot,
}: Readonly<{
  application: BuildTarget;
  candidatePath: string;
  repositoryRoot: string;
}>): boolean => {
  const slashedPath = candidatePath.replaceAll("\\", "/");
  const repositoryRelativePath = paths.relative(repositoryRoot, slashedPath).replaceAll("\\", "/");
  const foreignApplications = applicationsExcept(application).join("|");
  return (
    /^(?:infra|tools)(?:\/|$)/u.test(repositoryRelativePath) ||
    new RegExp(`(?:^|/)apps/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    new RegExp(`@repo/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)libs\/db\/src\/features\/db\/(?:remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$/u.test(
      slashedPath,
    ) ||
    isSecretFileName(slashedPath.split("/").at(-1) ?? slashedPath) ||
    /@repo\/db\/(?:remote|testing)(?:\/|$)/u.test(slashedPath) ||
    privateAdminPath(slashedPath, application) ||
    hostPrivatePath(slashedPath, application)
  );
};

export { applicationsExcept, isSecretFileName, privatePath };
