import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

const legacyRoots = new Set(["getting-started", "guidelines", "pages", "plans"]);

const Route = createFileRoute("/$")({
  beforeLoad: ({
    location,
  }: Readonly<{
    location: Readonly<{ pathname: string }>;
  }>) => {
    const segments = location.pathname.split("/").filter(Boolean);
    const [head = ""] = segments;
    if (!legacyRoots.has(head)) {
      throw notFound();
    }
    const suffix = segments.map((segment) => encodeURIComponent(segment)).join("/");
    throw redirect({
      href: `/wiki/${suffix}`,
      replace: true,
    });
  },
});

export { Route };
