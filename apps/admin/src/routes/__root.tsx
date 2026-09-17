import { RootDocument } from "#components/root-document.tsx";
import { createRootRoute } from "@tanstack/react-router";
import styles from "@template/ui/styles.css?url";

const Route = createRootRoute({
  component: RootDocument,
  head: () => ({
    links: [{ href: styles, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "管理者アプリ" },
    ],
  }),
});

export { Route };
