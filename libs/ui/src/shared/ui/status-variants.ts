/** @canonical-values ui.status-variant */
const statusVariants = ["failure", "info", "pending", "success"] as const;

type StatusVariant = (typeof statusVariants)[number];

const STATUS_VARIANT = {
  failure: statusVariants[0],
  info: statusVariants[1],
  pending: statusVariants[2],
  success: statusVariants[3],
} as const;

export { STATUS_VARIANT };
export type { StatusVariant };
