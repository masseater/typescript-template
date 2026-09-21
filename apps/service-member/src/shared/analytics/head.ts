import { appHead } from "@repo/ui/shell";

import { googleAnalyticsBootstrap } from "./bootstrap.ts";
import { analyticsConsentGranted } from "./consent.ts";

function memberAppHead(
  title: string,
  stylesheet: string,
  measurementId: string | undefined,
): ReturnType<typeof appHead> & {
  scripts?: { async?: boolean; children?: string; src?: string }[];
} {
  const head = appHead(title, stylesheet);
  if (measurementId === undefined || !analyticsConsentGranted()) {
    return head;
  }
  return {
    ...head,
    scripts: [
      {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
      },
      { children: googleAnalyticsBootstrap(measurementId) },
    ],
  };
}

export { memberAppHead };
