import { expect } from "vite-plus/test";

type ParsedFields = {
  readonly method?: string;
  readonly url?: string;
  readonly status?: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

type HostMessage = Request | Response;

const parsedBodyOf = async (hostMessage: HostMessage): Promise<unknown> => {
  const bodyText = await hostMessage.clone().text();
  if (bodyText === "") return null;
  const mediaType = hostMessage.headers.get("content-type") ?? "";
  return mediaType.includes("json") ? (JSON.parse(bodyText) as unknown) : bodyText;
};

const parsedFieldsOf = async (hostMessage: HostMessage): Promise<ParsedFields> => ({
  ...(hostMessage instanceof Request
    ? { method: hostMessage.method, url: hostMessage.url }
    : { status: hostMessage.status }),
  headers: Object.fromEntries(hostMessage.headers.entries()),
  body: await parsedBodyOf(hostMessage),
});

expect.extend({
  async toHaveParsedFields(received: HostMessage, expectedFields: ParsedFields) {
    const receivedFields = await parsedFieldsOf(received);
    return {
      pass: this.equals(receivedFields, expectedFields),
      message: () =>
        `expected parsed fields ${this.utils.printExpected(expectedFields)}, received ${this.utils.printReceived(receivedFields)}`,
      actual: receivedFields,
      expected: expectedFields,
    };
  },
});

declare module "vite-plus/test" {
  type Assertion<T> = {
    toHaveParsedFields: (expectedFields: ParsedFields) => Promise<T>;
  };
}
