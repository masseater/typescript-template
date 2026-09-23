import { sanitizeAnalyticsPath } from "./sanitize-path.ts";

declare global {
  interface Window {
    gtag?: (...arguments_: readonly unknown[]) => void;
  }
}

function trackAnalyticsPageView(pathname: string): void {
  if (typeof window.gtag !== "function") {
    return;
  }
  const pagePath = sanitizeAnalyticsPath(pathname);
  window.gtag("event", "page_view", {
    page_location: `${window.location.origin}${pagePath}`,
    page_path: pagePath,
  });
}

export { trackAnalyticsPageView };
