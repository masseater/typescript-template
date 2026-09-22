import { identifiableSegment } from "./sanitize-path.ts";

function googleAnalyticsBootstrap(measurementId: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());function sanitizeAnalyticsPath(pathname){return pathname.replace(new RegExp(${JSON.stringify(identifiableSegment.source)},"u"),"$1/_");}gtag("config",${JSON.stringify(measurementId)},{send_page_view:false});`;
}

export { googleAnalyticsBootstrap };
