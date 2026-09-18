import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "#entities/session/index.ts";
import { loginPath } from "@template/ui";
import { redirect } from "@tanstack/react-router";
import { sessionOptions } from "#entities/session/index.ts";

const entrances: ReadonlySet<string> = new Set(["/", "/login", "/signup"]);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function enterPublicFrame(queryClient: QueryClient, pathname: string): Promise<void> {
  if (!entrances.has(pathname)) {
    return;
  }
  const { session } = await queryClient.query(sessionOptions);
  if (session !== undefined) {
    throw redirect({ params: { id: session.user.id }, to: "/users/$id" });
  }
}

async function enterMemberFrame(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  queryClient: QueryClient,
  href: string,
): Promise<{ session: Session }> {
  const { session } = await queryClient.query(sessionOptions);
  if (session === undefined) {
    throw redirect({ href: loginPath(href) });
  }
  return { session };
}

export { enterMemberFrame, enterPublicFrame };
