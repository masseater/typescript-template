import { PublicHeader } from "./public-header.tsx";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const PublicFrame = ({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement => {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
};

export { PublicFrame };
