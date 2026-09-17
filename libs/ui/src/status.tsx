import type { ReactElement, ReactNode } from "react";

function Status({
  error = false,
  children,
}: Readonly<{ error?: boolean; children: ReactNode }>): ReactElement {
  return (
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      {children}
    </p>
  );
}

export { Status };
