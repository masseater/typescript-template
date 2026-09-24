type InboxRoute = "feedPost" | "markRead" | "notification" | "snapshot" | "socket";

const routes: readonly Readonly<{ method: string; route: InboxRoute; suffix: string }>[] = [
  { method: "POST", route: "notification", suffix: "/notifications" },
  { method: "POST", route: "markRead", suffix: "/notifications/read" },
  { method: "POST", route: "feedPost", suffix: "/posts" },
  { method: "GET", route: "snapshot", suffix: "/snapshot" },
];

function inboxRouteOf(request: Request): InboxRoute | undefined {
  if (request.headers.get("Upgrade") === "websocket") {
    return "socket";
  }
  const path = URL.parse(request.url)?.pathname ?? "";
  return routes.find((entry) => entry.method === request.method && path.endsWith(entry.suffix))
    ?.route;
}

export { inboxRouteOf };
export type { InboxRoute };
