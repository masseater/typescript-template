/** @canonical-values ui.status-variant */
const statusVariants = ["empty", "failure", "info", "pending", "success"] as const;

type StatusVariant = (typeof statusVariants)[number];

const STATUS_VARIANT = {
  empty: statusVariants[0],
  failure: statusVariants[1],
  info: statusVariants[2],
  pending: statusVariants[3],
  success: statusVariants[4],
} as const;

export { STATUS_VARIANT };
export type { StatusVariant };
