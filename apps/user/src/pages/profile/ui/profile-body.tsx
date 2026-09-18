import type { ReactElement, ReactNode, ReactPortal } from "react";

const ProfileBody = ({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement => {
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-8">{children}</main>
  );
};

export { ProfileBody };
