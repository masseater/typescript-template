import type { ReactElement } from "react";

function MemberSummary({
  name,
  profile,
}: Readonly<{ name: string; profile: string }>): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-base leading-tight font-bold">{name}</span>
      <span className="line-clamp-2 text-sm leading-normal text-muted-foreground">{profile}</span>
    </div>
  );
}

export { MemberSummary };
