import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

const RootDocument = ({ children }: Readonly<{ children: ReactNode }>): ReactNode => (
  <html lang="ja">
    <head>
      <meta charSet="utf-8" />
      <HeadContent />
    </head>
    <body>
      {children}
      <Scripts />
    </body>
  </html>
);

export { RootDocument };
