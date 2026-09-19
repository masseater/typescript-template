import { Icon } from "@repo/ui";
import { SearchIcon } from "lucide-react";

import { FrameSwitch } from "./frame-switch.tsx";

import type { ReactElement, ReactNode } from "react";

function AppChrome({
  tools,
}: Readonly<{
  tools?: ReactNode;
}>): ReactElement {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
      <FrameSwitch />
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">{tools}</div>
    </header>
  );
}

function ChromeSearch({
  placeholder,
}: Readonly<{
  placeholder: string;
}>): ReactElement {
  return (
    <label className="flex max-w-64 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 text-muted-foreground">
      <Icon icon={SearchIcon} size="small" />
      <input
        type="search"
        placeholder={placeholder}
        disabled
        className="min-w-0 flex-1 bg-transparent text-base leading-tight text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </label>
  );
}

export { AppChrome, ChromeSearch };
