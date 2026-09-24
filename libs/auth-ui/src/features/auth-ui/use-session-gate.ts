import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { sessionAllowed, sessionRedirect } from "./session-redirect.ts";
import { useSession } from "./use-session.ts";

import type { Role } from "@repo/config";
import type { SessionView } from "./protocol.ts";

const useSessionGate = (
  gate: Readonly<{ reloadDocument: boolean; role: Role | undefined; securityExempt: boolean }>,
): Readonly<{ error: string | undefined; loading: boolean; session: SessionView | undefined }> => {
  const { reloadDocument, role, securityExempt } = gate;
  const reading = useSession();
  const { href, pathname } = useLocation();
  const navigate = useNavigate();
  const visit = { href, pathname, role, securityExempt };
  const destination = sessionRedirect(reading, visit);
  useEffect(() => {
    if (destination === undefined) {
      return;
    }
    void navigate({ href: destination, reloadDocument, replace: true });
  }, [destination, navigate, reloadDocument]);
  return {
    error: reading.error,
    loading: reading.loading,
    session: sessionAllowed(reading.session, visit) ? reading.session : undefined,
  };
};

export { useSessionGate };
