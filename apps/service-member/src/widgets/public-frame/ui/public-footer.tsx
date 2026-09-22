import { TextLink } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { m } from "#shared/i18n/index.ts";
import { publicContentTrack } from "../model/public-content-track.ts";

import type { ReactElement } from "react";

function PublicFooter(): ReactElement {
  const { pathname } = useLocation();
  const track = publicContentTrack(pathname);
  return (
    <footer className="w-full border-t border-border">
      <div
        className={`mx-auto w-full ${track} px-4 py-6 text-center text-sm leading-normal text-muted-foreground`}
      >
        <p>{serviceName}</p>
        <p className="mt-2">
          <TextLink to="/contact">{m.contact_link()}</TextLink>
        </p>
      </div>
    </footer>
  );
}

export { PublicFooter };
