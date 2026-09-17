import { it } from "@effect/vitest";
import { Effect } from "effect";
import { loadArtifacts, assertEntries, assertSeparation, assertPublicSafety } from "./artifacts.ts";

it.live("built Workers have separate executable entries and gated, client-only assets roots", () =>
  Effect.flatMap(loadArtifacts(), assertEntries),
);

it.live("actual user bundles contain no dedicated admin UI, route, gate or database module", () =>
  Effect.flatMap(loadArtifacts(), assertSeparation),
);

it.live(
  "actual public assets contain no source maps, private configuration or local secret values",
  () => Effect.flatMap(loadArtifacts(), assertPublicSafety),
);
