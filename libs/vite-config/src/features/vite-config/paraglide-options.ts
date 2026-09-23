import type { CompilerOptions } from "@inlang/paraglide-js";

const paraglideStrategy = ["url", "cookie", "preferredLanguage", "baseLocale"] as const;

const paraglideCompileOptions = (): CompilerOptions => ({
  cookieName: "PARAGLIDE_LOCALE",
  emitGitIgnore: true,
  emitPrettierIgnore: false,
  emitReadme: false,
  emitTsDeclarations: true,
  outdir: "./.paraglide",
  outputStructure: "message-modules",
  project: "./project.inlang",
  strategy: [...paraglideStrategy],
  urlPatterns: [
    {
      pattern: "/:path(.*)?",
      localized: [
        ["en", "/en/:path(.*)?"],
        ["ja", "/:path(.*)?"],
      ],
    },
  ],
});

export { paraglideCompileOptions, paraglideStrategy };
