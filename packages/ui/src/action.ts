import { useCallback, useRef, useState } from "react";
import { errorMessage } from "./protocol";

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const run = useCallback((action: () => Promise<void>) => {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError(null);
    void action()
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => {
        active.current = false;
        setPending(false);
      });
  }, []);
  return { pending, error, run };
}
