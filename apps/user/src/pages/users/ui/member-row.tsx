import { MemberCard } from "./member-card.tsx";
import type { ReactElement } from "react";
import type { MemberRow as Row } from "#pages/users/model/use-member-list.ts";

function MemberRow({
  measure,
  row,
}: Readonly<{ measure: (node: Element | null) => void; row: Row }>): ReactElement {
  return (
    <li
      ref={measure}
      data-index={row.item.index}
      className="absolute top-0 left-0 w-full"
      style={{ transform: `translateY(${row.offset}px)` }}
    >
      <MemberCard member={row.member} />
    </li>
  );
}

export { MemberRow };
