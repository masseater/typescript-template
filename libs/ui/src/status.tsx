import type { ReactElement, ReactNode, ReactPortal } from "react";

function Status({
  error = false,
  children,
}: Readonly<{
  error?: boolean;
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement {
  return (
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      {children}
    </p>
  );
}

export { Status };
