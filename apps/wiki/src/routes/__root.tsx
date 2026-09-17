import { RootDocument } from "#/components/root-document.tsx";
import { createRootRoute } from "@tanstack/react-router";
import styles from "#/styles/app.css?url";

interface RootHead {
  links: { href: string; rel: string }[];
  meta: ({ charSet: string } | { content: string; name: string } | { title: string })[];
}

function head(): RootHead {
  return {
    links: [{ href: styles, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "Wiki" },
    ],
  };
}

const Route = createRootRoute({ component: RootDocument, head });

export { Route };
