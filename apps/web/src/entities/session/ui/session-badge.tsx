import { authClient } from "#/shared/auth";

export function SessionBadge() {
  const session = authClient.useSession();
  if (session.data === null) {
    return <span className="text-muted-foreground text-sm">Guest</span>;
  }
  return <span className="text-sm">{session.data.user.name}</span>;
}
