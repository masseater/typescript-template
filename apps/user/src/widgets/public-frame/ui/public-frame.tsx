import type { ReactElement, ReactNode, ReactPortal } from "react";

import { PublicHeader } from "./public-header.tsx";

function PublicFrame({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}

export { PublicFrame };
