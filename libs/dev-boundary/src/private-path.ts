import path from "node:path";

import { applications, type Application } from "@repo/config";

const applicationsExcept = (application: Application): Application[] =>
  applications.filter((candidate) => candidate !== application);

const privateAdminPath = (slashedPath: string, application: Application): boolean =>
  application !== "service-admin" &&
  (/(?:^|\/)libs\/db\/src\/admin(?:\.[^/]*)?$/u.test(slashedPath) ||
    /@repo\/db\/admin(?:\/|$)/u.test(slashedPath));

const privatePath = ({
  application,
  candidatePath,
  repositoryRoot,
}: Readonly<{
  application: Application;
  candidatePath: string;
  repositoryRoot: string;
}>): boolean => {
  const slashedPath = candidatePath.replaceAll("\\", "/");
  const repositoryRelativePath = path.relative(repositoryRoot, slashedPath).replaceAll("\\", "/");
  const foreignApplications = applicationsExcept(application).join("|");
  return (
    /^(?:infra|tools)(?:\/|$)/u.test(repositoryRelativePath) ||
    new RegExp(`(?:^|/)apps/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    new RegExp(`@repo/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)libs\/db\/src\/(?:remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|[^/]*\.(?:pem|key))$/u.test(
      slashedPath,
    ) ||
    /@repo\/db\/(?:remote|testing)(?:\/|$)/u.test(slashedPath) ||
    privateAdminPath(slashedPath, application)
  );
};

export { applicationsExcept, privatePath };
