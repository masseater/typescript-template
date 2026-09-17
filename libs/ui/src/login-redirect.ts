const HOME = "/";
const LOGIN = "/login";
const localOrigin = "https://app.invalid";

function redirectTarget(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /^\/[/\\]/u.test(value)) {
    return HOME;
  }
  const url = new URL(value, localOrigin);
  return url.origin === localOrigin && url.pathname !== LOGIN ? value : HOME;
}

function loginPath(current: string): string {
  if (new URL(current, localOrigin).pathname === LOGIN) {
    return current;
  }
  return current === HOME
    ? LOGIN
    : `${LOGIN}?${new URLSearchParams({ redirect: current }).toString()}`;
}

export { loginPath, redirectTarget };
