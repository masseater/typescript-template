import { APPLICATION, applications, type Application } from "@repo/config";
import { Effect, Path } from "effect";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));

const applicationsExcept = (application: Application): Application[] =>
  applications.filter((candidate) => candidate !== application);

const secretFileName = /^(?:\.env.*|\.dev\.vars.*|.*\.(?:pem|key))$/u;

const isSecretFileName = (name: string): boolean => secretFileName.test(name);

const privateAdminPath = (slashedPath: string, application: Application): boolean =>
  application !== APPLICATION.admin &&
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
  const repositoryRelativePath = paths.relative(repositoryRoot, slashedPath).replaceAll("\\", "/");
  const foreignApplications = applicationsExcept(application).join("|");
  return (
    /^(?:infra|tools)(?:\/|$)/u.test(repositoryRelativePath) ||
    new RegExp(`(?:^|/)apps/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    new RegExp(`@repo/(?:${foreignApplications})(?:/|$)`, "u").test(slashedPath) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)libs\/db\/src\/(?:remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$/u.test(
      slashedPath,
    ) ||
    isSecretFileName(slashedPath.split("/").at(-1) ?? slashedPath) ||
    /@repo\/db\/(?:remote|testing)(?:\/|$)/u.test(slashedPath) ||
    privateAdminPath(slashedPath, application)
  );
};

export { applicationsExcept, isSecretFileName, privatePath };
