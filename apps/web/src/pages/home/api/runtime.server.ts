import { runner } from "@r_masseater/workers-tracing/effect";

import { featureFlagsLive } from "#/pages/home/config/feature-flags.server";

const runRequest = runner(featureFlagsLive);

export { runRequest };
