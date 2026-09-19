const linkWrapperFiles = [
  "libs/ui/src/shared/ui/button-link.tsx",
  "libs/ui/src/shared/ui/card-link.tsx",
  "libs/ui/src/shared/ui/dropdown-menu-link-item.tsx",
  "libs/ui/src/shared/ui/navigation-link.tsx",
  "libs/ui/src/shared/ui/pagination-link.tsx",
  "libs/ui/src/shared/ui/text-link.tsx",
];

const reactElementTypeFiles = [...linkWrapperFiles, "libs/ui/src/shared/ui/icon.tsx"];

const uiSharedPartFiles = ["libs/ui/src/shared/ui/**"];

const linkComponents = [
  "ButtonLink",
  "CardLink",
  "DropdownMenuLinkItem",
  "Link",
  "NavigationLink",
  "PaginationLink",
  "TextLink",
];

const uiA11yComponents = {
  ...Object.fromEntries(linkComponents.map((componentName) => [componentName, "a"])),
  Button: "button",
  Checkbox: "button",
  DropdownMenuTrigger: "button",
  Heading: "h2",
};

export {
  linkComponents,
  linkWrapperFiles,
  reactElementTypeFiles,
  uiA11yComponents,
  uiSharedPartFiles,
};
