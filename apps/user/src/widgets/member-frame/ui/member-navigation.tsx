import { CompactNavigation } from "./compact-navigation.tsx";
import { NavigationLink } from "@template/ui/ui";
import type { ReactElement } from "react";

function MemberNavigation({ userId }: Readonly<{ userId: string }>): ReactElement {
  return (
    <>
      <nav aria-label="メイン" className="hidden items-center gap-1 md:flex">
        <NavigationLink to="/users/$id" params={{ id: userId }}>
          ホーム
        </NavigationLink>
        <NavigationLink to="/users" activeOptions={{ exact: true, includeSearch: false }}>
          ユーザーを探す
        </NavigationLink>
      </nav>
      <div className="md:hidden">
        <CompactNavigation userId={userId} />
      </div>
    </>
  );
}

export { MemberNavigation };
