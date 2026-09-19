import { Icon } from "@repo/ui";
import { Link2Icon } from "lucide-react";

import { classifySocialUrl } from "./registry.ts";

import type { ReactElement } from "react";
import type { ClassifiedSocialUrl } from "./registry.ts";

function SocialLinkGlyph({
  classified,
}: Readonly<{ classified: Extract<ClassifiedSocialUrl, { ok: true }> }>): ReactElement {
  if (classified.network === null) {
    return <Icon icon={Link2Icon} size="small" />;
  }
  return (
    <svg
      data-slot="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="currentColor"
    >
      <path d={classified.network.path} />
    </svg>
  );
}

function SocialLinkIcon({ url }: Readonly<{ url: string }>): ReactElement | null {
  const classified = classifySocialUrl(url);
  if (!classified.ok) {
    return null;
  }
  return <SocialLinkGlyph classified={classified} />;
}

export { SocialLinkGlyph, SocialLinkIcon };
