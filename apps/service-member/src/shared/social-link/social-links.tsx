import { classifySocialUrl } from "./registry.ts";
import { SocialLinkGlyph } from "./social-link-icon.tsx";

import type { ReactElement } from "react";

function SocialLinks({ urls }: Readonly<{ urls: readonly string[] }>): ReactElement | null {
  const links = urls.flatMap((url) => {
    const classified = classifySocialUrl(url);
    return classified.ok ? [{ classified, url: classified.url }] : [];
  });
  if (links.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-3">
      {links.map(({ classified, url }) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary"
            aria-label={url}
          >
            <SocialLinkGlyph classified={classified} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export { SocialLinks };
