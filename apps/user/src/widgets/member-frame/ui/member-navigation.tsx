import { CompactNavigation } from "./compact-navigation.tsx";
import { NavigationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import { useMemo } from "react";

function MemberNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  const home = useMemo(() => ({ id: userId }), [userId]);
  return (
    <>
      <nav aria-label="メイン" className="hidden items-center gap-1 md:flex">
        <NavigationLink to="/users/$id" params={home}>
          ホーム
        </NavigationLink>
      </nav>
      <div className="md:hidden">
        <CompactNavigation userId={userId} />
      </div>
    </>
  );
}

export { MemberNavigation };
