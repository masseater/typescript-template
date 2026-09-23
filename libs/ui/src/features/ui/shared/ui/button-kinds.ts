import { KIND, SIZE } from "baseui/button";

const kindByVariant = {
  danger: KIND.dangerPrimary,
  primary: KIND.primary,
  secondary: KIND.secondary,
} as const;

const sizeBySize = {
  large: SIZE.large,
  medium: SIZE.default,
  small: SIZE.compact,
} as const;

export { kindByVariant, sizeBySize };
