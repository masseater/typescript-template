const linkComponents = [
  "ButtonLink",
  "CardLink",
  "DropdownMenuLinkItem",
  "Link",
  "NavigationLink",
  "PaginationLink",
  "TextLink",
];

const uiSharedPartFiles = ["libs/ui/src/shared/ui/**"];

const uiA11yComponents = {
  ...Object.fromEntries(linkComponents.map((name) => [name, "a"])),
  Button: "button",
  Checkbox: "button",
  DropdownMenuTrigger: "button",
  Heading: "h2",
};

export { linkComponents, uiA11yComponents, uiSharedPartFiles };
