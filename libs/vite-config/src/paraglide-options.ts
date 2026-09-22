type AppLocale = "en" | "ja";

const paraglideStrategy = ["url", "cookie", "preferredLanguage", "baseLocale"] as const;

const paraglideCompileOptions = {
  cookieName: "PARAGLIDE_LOCALE",
  emitGitIgnore: true,
  emitPrettierIgnore: false,
  emitReadme: false,
  emitTsDeclarations: true,
  outdir: "./.paraglide",
  outputStructure: "message-modules" as const,
  project: "./project.inlang",
  strategy: [...paraglideStrategy],
  urlPatterns: [
    {
      pattern: "/:path(.*)?",
      localized: [
        ["en", "/en/:path(.*)?"],
        ["ja", "/:path(.*)?"],
      ] satisfies Array<[AppLocale, string]>,
    },
  ],
};

export { paraglideCompileOptions, paraglideStrategy };
