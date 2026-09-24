import { AGREEMENT_KIND } from "@repo/config";
import { createFileRoute } from "@tanstack/react-router";

import { loadPublishedAgreement } from "#entities/agreement/index.ts";
import { PrivacyRoute } from "#pages/legal/index.ts";

const Route = createFileRoute("/_public/privacy")({
  component: PrivacyRoute,
  loader: () => loadPublishedAgreement(AGREEMENT_KIND.privacy),
});

export { Route };
