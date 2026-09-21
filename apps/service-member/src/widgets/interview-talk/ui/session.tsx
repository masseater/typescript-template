import { STATUS_VARIANT, StatusMessage, localState } from "@repo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { InterviewRoom } from "./room.tsx";

import type { ReactElement } from "react";

const useMounted = localState(false);

function interviewQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { networkMode: "always" },
      queries: { networkMode: "always", retry: false },
    },
  });
}

function InterviewClient({
  onSheetSaved,
  suspended,
}: Readonly<{ onSheetSaved: (() => void) | undefined; suspended: boolean }>): ReactElement {
  const client = useMemo(interviewQueryClient, []);
  return (
    <QueryClientProvider client={client}>
      <InterviewRoom onSheetSaved={onSheetSaved} suspended={suspended} />
    </QueryClientProvider>
  );
}

function InterviewSession({
  onSheetSaved,
  suspended = false,
}: Readonly<{ onSheetSaved?: () => void; suspended?: boolean }>): ReactElement {
  const [mounted, setMounted] = useMounted();
  useEffect(() => {
    setMounted(true);
  }, [setMounted]);
  if (!mounted) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>会話を読み込み中です。</StatusMessage>;
  }
  return <InterviewClient onSheetSaved={onSheetSaved} suspended={suspended} />;
}

export { InterviewSession };
