import { Effect, Schema } from "effect";
import { expect } from "vite-plus/test";

type ParsedFields = {
  readonly method?: string;
  readonly url?: string;
  readonly status?: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

type HostMessage = Request | Response;

const jsonMediaType = "application/json";

const parsedBodyOf = (hostMessage: HostMessage) =>
  Effect.gen(function* parsedBody() {
    const bodyText = yield* Effect.promise(() => hostMessage.clone().text());
    if (bodyText === "") return null;
    const mediaType = hostMessage.headers.get("content-type") ?? "";
    return mediaType.startsWith(jsonMediaType)
      ? yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(bodyText)
      : bodyText;
  }).pipe(Effect.orDie);

const parsedFieldsOf = (hostMessage: HostMessage) =>
  Effect.gen(function* parsedFields() {
    return {
      ...(hostMessage instanceof Request
        ? { method: hostMessage.method, url: hostMessage.url }
        : { status: hostMessage.status }),
      headers: Object.fromEntries(hostMessage.headers.entries()),
      body: yield* parsedBodyOf(hostMessage),
    };
  }).pipe(Effect.orDie);

expect.extend({
  toHaveParsedFields(received: HostMessage, expectedFields: ParsedFields) {
    const matcher = this;
    return Effect.runPromise(
      Effect.gen(function* matchParsedFields() {
        const receivedFields = yield* parsedFieldsOf(received);
        return {
          pass: matcher.equals(receivedFields, expectedFields),
          message: () =>
            `expected parsed fields ${matcher.utils.printExpected(expectedFields)}, received ${matcher.utils.printReceived(receivedFields)}`,
          actual: receivedFields,
          expected: expectedFields,
        };
      }),
    );
  },
});

declare module "vite-plus/test" {
  interface Matchers<R, T> {
    toHaveParsedFields: (expectedFields: ParsedFields) => Promise<void>;
  }
}
