import { createRootRoute } from "@tanstack/react-router";
import { Array as Arr, Option, Schema, pipe } from "effect";
import { webAnalyticsBeacon } from "security-headers";

import { RootDocument } from "#/app/shell/root-document";

import appCss from "#/app/styles.css?url";

const Route = createRootRoute({
  head: () => ({
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "typescript-template" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: pipe(
      Schema.decodeUnknownOption(Schema.NonEmptyString)(import.meta.env["VITE_CF_BEACON_TOKEN"]),
      Option.map(webAnalyticsBeacon),
      Arr.fromOption,
    ),
  }),
  shellComponent: RootDocument,
});

export { Route };
