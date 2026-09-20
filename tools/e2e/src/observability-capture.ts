import { Schema } from "effect";

import type { Page, Response } from "playwright";

const SessionBody = Schema.Struct({
  user: Schema.optionalKey(
    Schema.Struct({
      id: Schema.optionalKey(Schema.String),
    }),
  ),
});

const decodeSessionBody = Schema.decodeUnknownPromise(SessionBody);

type ObservabilityCapture = {
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly traceIds: readonly string[];
  readonly userId: string | undefined;
};

const requestIdHeader = "x-request-id";
const traceparentHeader = "traceparent";

const traceIdFromTraceparent = (traceparent: string): string | undefined => {
  const [version, traceId] = traceparent.split("-");
  if (version !== "00" || traceId?.length !== 32) {
    return undefined;
  }
  return traceId;
};

const attachObservabilityCapture = (
  page: Page,
): ObservabilityCapture & { readonly stop: () => void } => {
  const requestIds: string[] = [];
  const traceIds: string[] = [];
  const onResponse = (response: Response): void => {
    const requestId = response.headers()[requestIdHeader];
    if (requestId !== undefined && requestId !== "") {
      requestIds.push(requestId);
    }
    const traceparent = response.headers()[traceparentHeader];
    if (traceparent !== undefined) {
      const traceId = traceIdFromTraceparent(traceparent);
      if (traceId !== undefined) {
        traceIds.push(traceId);
      }
    }
  };
  page.on("response", onResponse);
  return {
    get requestIds(): readonly string[] {
      return requestIds;
    },
    get sessionToken(): string | undefined {
      return undefined;
    },
    get traceIds(): readonly string[] {
      return traceIds;
    },
    get userId(): string | undefined {
      return undefined;
    },
    stop: (): void => {
      page.off("response", onResponse);
    },
  };
};

const readSession = async (
  page: Page,
  origin: string,
): Promise<{ readonly sessionToken: string | undefined; readonly userId: string | undefined }> => {
  const response = await page.request.get(`${origin}/api/session`);
  if (!response.ok()) {
    return { sessionToken: undefined, userId: undefined };
  }
  const body = await decodeSessionBody(await response.json());
  const cookies = await page.context().cookies(origin);
  const sessionCookie = cookies.find((cookie) => cookie.name.endsWith(".session_token"));
  return {
    sessionToken: sessionCookie?.value,
    userId: body.user?.id,
  };
};

export { attachObservabilityCapture, readSession };
export type { ObservabilityCapture };
