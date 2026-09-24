import { userInboxBinding } from "@repo/config";

type InboxNamespace = Pick<DurableObjectNamespace, "get" | "idFromName">;

type InboxEnv = {
  readonly [userInboxBinding]?: InboxNamespace;
};

const missingInbox = "USER_INBOX binding is required";

function inboxOf(env: InboxEnv): InboxNamespace {
  const namespace = env[userInboxBinding];
  if (namespace === undefined) {
    throw new Error(missingInbox);
  }
  return namespace;
}

function stubFor(env: InboxEnv, userId: string): DurableObjectStub {
  const namespace = inboxOf(env);
  return namespace.get(namespace.idFromName(userId));
}

function openRealtime(env: InboxEnv, userId: string, request: Request): Promise<Response> {
  return stubFor(env, userId).fetch(request);
}

export { openRealtime };
export type { InboxEnv, InboxNamespace };
