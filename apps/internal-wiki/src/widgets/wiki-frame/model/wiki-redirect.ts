import { loginPath } from "@repo/auth-ui/login-redirect";

type WikiSession = Readonly<{
  error: string | undefined;
  loading: boolean;
  session: Readonly<{ strong: boolean }> | undefined;
}>;

const securityPath = "/security";

const wikiAllowed = (state: WikiSession): boolean => state.session?.strong === true;

const wikiRedirect = (state: WikiSession, href: string): string | undefined => {
  if (state.loading || state.error !== undefined || wikiAllowed(state)) {
    return undefined;
  }
  return state.session === undefined ? loginPath(href) : securityPath;
};

export { wikiAllowed, wikiRedirect };
export type { WikiSession };
