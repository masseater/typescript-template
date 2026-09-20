function googleAnalyticsBootstrap(measurementId: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());function sanitizeAnalyticsPath(pathname){return pathname.replace(/^\\/(users|messages|board|groups|support)\\/[^/?#]+/u,"/$1/_");}gtag("config",${JSON.stringify(measurementId)},{send_page_view:false});`;
}

export { googleAnalyticsBootstrap };
