import preview from "../../../storybook/preview";
import { PaginationLink } from "./pagination-link";

const meta = preview.meta({
  args: { children: "2", current: false, to: "/" },
  component: PaginationLink,
});

export const OtherPage = meta.story();

export const CurrentPage = meta.story({ args: { current: true } });
