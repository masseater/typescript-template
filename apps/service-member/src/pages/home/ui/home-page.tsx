import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement } from "react";

function HomePage(): ReactElement {
  return <ShellPage title="ホーム" detail="フォローしている利用者の動きはまだありません。" />;
}

export { HomePage };
