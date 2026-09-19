const HOME = "/";
const LOGIN = "/login";
const localOrigin = "https://app.invalid";

const redirectTarget = (candidateLocation: unknown): string => {
  if (
    typeof candidateLocation !== "string" ||
    !candidateLocation.startsWith("/") ||
    /^\/[/\\]/u.test(candidateLocation)
  ) {
    return HOME;
  }
  const url = new URL(candidateLocation, localOrigin);
  return url.origin === localOrigin && url.pathname !== LOGIN ? candidateLocation : HOME;
};

const loginPath = (currentLocation: string): string => {
  if (new URL(currentLocation, localOrigin).pathname === LOGIN) {
    return currentLocation;
  }
  return currentLocation === HOME
    ? LOGIN
    : `${LOGIN}?${new URLSearchParams({ redirect: currentLocation }).toString()}`;
};

export { loginPath, redirectTarget };
