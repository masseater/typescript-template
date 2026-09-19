import preview from "../../../storybook/preview";
import { PaginationLink } from "./pagination-link";

const meta = preview.meta({
  args: { children: "2", current: false, to: "/" },
  component: PaginationLink,
});

export const Other = meta.story();

export const Current = meta.story({ args: { current: true } });
