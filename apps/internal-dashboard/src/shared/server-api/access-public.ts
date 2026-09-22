const publicPaths: ReadonlySet<string> = new Set([
  "/login",
  "/consent",
  "/mcp",
  "/api/telemetry",
  "/api/health",
  "/api/session",
]);

function isPublic(path: string): boolean {
  return (
    publicPaths.has(path) ||
    path === "/wiki" ||
    path.startsWith("/wiki/") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/.well-known/oauth-")
  );
}

export { isPublic };
