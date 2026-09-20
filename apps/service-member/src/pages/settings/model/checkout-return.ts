/** @canonical-values ui.checkout-return */
const checkoutReturns = ["cancel", "success"] as const;
type CheckoutReturn = (typeof checkoutReturns)[number];
const CHECKOUT_RETURN = {
  cancel: checkoutReturns[0],
  success: checkoutReturns[1],
} as const satisfies Record<string, CheckoutReturn>;

interface CheckoutReturnSearch {
  readonly checkout?: CheckoutReturn;
}

function isCheckoutReturn(value: unknown): value is CheckoutReturn {
  return typeof value === "string" && (checkoutReturns as readonly string[]).includes(value);
}

function readCheckoutReturn(raw: unknown): CheckoutReturnSearch {
  const value = typeof raw === "object" && raw !== null ? Reflect.get(raw, "checkout") : undefined;
  return isCheckoutReturn(value) ? { checkout: value } : {};
}

export { CHECKOUT_RETURN, readCheckoutReturn };
export type { CheckoutReturn, CheckoutReturnSearch };
