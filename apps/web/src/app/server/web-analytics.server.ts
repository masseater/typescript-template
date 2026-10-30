import { env } from "cloudflare:workers";
import { Array as Arr, Option, Record as Rec, String as Str, pipe } from "effect";
import { webAnalyticsBeacon } from "security-headers";

const escapeAttribute = (value: string): string =>
  pipe(value, Str.replaceAll("&", "&amp;"), Str.replaceAll('"', "&quot;"));

const attribute = ([name, value]: readonly [string, string | true]): string =>
  pipe(
    Option.liftPredicate(value, Str.isString),
    Option.match({
      onNone: () => name,
      onSome: (text) => `${name}="${escapeAttribute(text)}"`,
    }),
  );

const beaconTag = (token: string): string =>
  `<script ${pipe(Rec.toEntries(webAnalyticsBeacon(token)), Arr.map(attribute), Arr.join(" "))}></script>`;

const injectBeacon = (response: Response): Response =>
  new HTMLRewriter()
    .on("head", {
      element: (head) => {
        head.append(beaconTag(env.CF_BEACON_TOKEN), { html: true });
      },
    })
    .transform(response);

const withWebAnalytics = (response: Response): Response =>
  pipe(
    Option.fromNullishOr(response.headers.get("Content-Type")),
    Option.filter(Str.startsWith("text/html")),
    Option.match({ onNone: () => response, onSome: () => injectBeacon(response) }),
  );

export { withWebAnalytics };
