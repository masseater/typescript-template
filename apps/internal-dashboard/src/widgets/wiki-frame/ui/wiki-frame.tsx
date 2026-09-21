import { ButtonLink, Icon, NavigationLink, localState } from "@repo/ui";
import { MenuIcon, SearchIcon } from "lucide-react";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const useTreeOpen = localState(false);

function WikiFrame({
  children,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement {
  const [treeOpen, setTreeOpen] = useTreeOpen();
  function toggleTree(): void {
    setTreeOpen((open) => !open);
  }
  function closeTree(): void {
    setTreeOpen(false);
  }
  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
        <button
          type="button"
          aria-label="文書の木"
          aria-expanded={treeOpen}
          onClick={toggleTree}
          className="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"
        >
          <Icon icon={MenuIcon} />
        </button>
        <NavigationLink to="/wiki" variant="brand">
          Wiki
        </NavigationLink>
        <label className="ml-auto flex max-w-64 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 text-muted-foreground">
          <Icon icon={SearchIcon} size="small" />
          <input
            type="search"
            placeholder="文書を検索"
            disabled
            className="min-w-0 flex-1 bg-transparent text-base leading-tight text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </label>
        <ButtonLink to="/" variant="secondary">
          ダッシュボード
        </ButtonLink>
      </header>
      {treeOpen ? (
        <button
          type="button"
          aria-label="文書の木を閉じる"
          onClick={closeTree}
          className="fixed inset-0 top-12 z-10 bg-foreground/20 md:hidden"
        />
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export { WikiFrame };
