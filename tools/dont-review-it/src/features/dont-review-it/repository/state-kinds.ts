type StateKindId = "server" | "url" | "device" | "screen";

type StateKind = {
  readonly id: StateKindId;
  readonly mechanism: string;
  readonly retiredPackages: Readonly<Record<string, string>>;
};

const tanstackQuery = "TanStack Query (@tanstack/react-query) and route loaders";

const stateKinds = {
  server: {
    id: "server",
    mechanism: tanstackQuery,
    retiredPackages: {
      "@apollo/client": tanstackQuery,
      "@trpc/": tanstackQuery,
      "@urql/": tanstackQuery,
      "react-query": tanstackQuery,
      "react-relay": tanstackQuery,
      "relay-runtime": tanstackQuery,
      swr: tanstackQuery,
      urql: tanstackQuery,
    },
  },
  url: {
    id: "url",
    mechanism: "TanStack Router search params",
    retiredPackages: {},
  },
  device: {
    id: "device",
    mechanism: "Effect Atom Atom.kvs",
    retiredPackages: {},
  },
  screen: {
    id: "screen",
    mechanism: "Effect Atom",
    retiredPackages: {},
  },
} as const satisfies Record<StateKindId, StateKind>;

const atomHeldServerDataMessage =
  "An Atom must not hold server data reached through `fetch`, WebSocket, EventSource, XMLHttpRequest, an `api` segment, or a `client` module. Move that read to a TanStack Query option factory in an `api` segment.";

const serverCacheApiMessage =
  "Server-oriented Atom cache APIs must not be used. Read server data through TanStack Query option factories and invalidate with the Query client.";

const retiredPackagesFromStateKinds = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.values(stateKinds).flatMap((kind) => Object.entries(kind.retiredPackages)),
  );

export {
  atomHeldServerDataMessage,
  retiredPackagesFromStateKinds,
  serverCacheApiMessage,
  stateKinds,
};
