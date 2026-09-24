import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement, ReactNode } from "react";

const WikiGate = ({
  allowed,
  children,
  error,
  loading,
}: Readonly<{
  allowed: boolean;
  children: ReactNode;
  error: string | undefined;
  loading: boolean;
}>): ReactElement | null => {
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <StatusMessage variant={STATUS_VARIANT.pending}>{"読み込み中です。"}</StatusMessage>
      </div>
    );
  }
  if (error !== undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      </div>
    );
  }
  return allowed ? <>{children}</> : null;
};

export { WikiGate };
