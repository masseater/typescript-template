const appHead = (
  title: string,
  stylesheet: string,
): {
  links: { href: string; rel: string }[];
  meta: ({ charSet: string } | { content: string; name: string } | { title: string })[];
} => {
  return {
    links: [{ href: stylesheet, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title },
    ],
  };
};

export { appHead };
