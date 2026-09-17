import type { ReactElement, ReactNode, ReactPortal } from "react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

function ProfileLink({
  children,
  className,
  id,
}: Readonly<{
  children?: Readonly<Exclude<ReactNode, ReactPortal>>;
  className?: string;
  id: string;
}>): ReactElement {
  const params = useMemo(() => ({ id }), [id]);
  return (
    <Link to="/users/$id" params={params} className={className}>
      {children}
    </Link>
  );
}

export { ProfileLink };
