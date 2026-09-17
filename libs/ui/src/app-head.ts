interface AppHead {
  links: { href: string; rel: string }[];
  meta: ({ charSet: string } | { content: string; name: string } | { title: string })[];
}

function appHead(title: string, stylesheet: string): AppHead {
  return {
    links: [{ href: stylesheet, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title },
    ],
  };
}

export { appHead };
