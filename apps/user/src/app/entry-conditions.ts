import type { Session } from "#entities/session/index.ts";
import { loadSession } from "#entities/session/index.ts";
import { redirect } from "@tanstack/react-router";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

function safeDestination(candidate: string | undefined): string | undefined {
  return candidate !== undefined && /^\/(?![/\\])/u.test(candidate) ? candidate : undefined;
}

async function enterPublicFrame(pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const session = await loadSession();
  if (session !== undefined) {
    throw redirect({ params: { id: session.user.id }, to: "/users/$id" });
  }
}

async function enterMemberFrame(href: string): Promise<{ session: Session }> {
  const session = await loadSession();
  if (session === undefined) {
    throw redirect({ search: { redirect: href }, to: "/login" });
  }
  return { session };
}

export { enterMemberFrame, enterPublicFrame, safeDestination };
