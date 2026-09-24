import { StatusMessage } from "@repo/ui";

import type { ComponentProps, ReactElement } from "react";

const SessionStatus = ({
  children,
  variant,
}: Readonly<{
  children: ComponentProps<typeof StatusMessage>["children"];
  variant: NonNullable<ComponentProps<typeof StatusMessage>["variant"]>;
}>): ReactElement => (
  <div className="flex min-h-dvh items-center justify-center p-4">
    <StatusMessage variant={variant}>{children}</StatusMessage>
  </div>
);

export { SessionStatus };
