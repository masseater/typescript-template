const HOME = "/";
const LOGIN = "/login";
const localOrigin = "https://admin.invalid";

function redirectTarget(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /^\/[/\\]/u.test(value)) {
    return HOME;
  }
  const url = new URL(value, localOrigin);
  return url.origin === localOrigin && url.pathname !== LOGIN ? value : HOME;
}

function loginPath(current: string): string {
  return current === HOME
    ? LOGIN
    : `${LOGIN}?${new URLSearchParams({ redirect: current }).toString()}`;
}

export { loginPath, redirectTarget };
