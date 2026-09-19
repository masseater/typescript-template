const field = (declared: unknown, key: string): unknown =>
  typeof declared === "object" && declared !== null
    ? Object.getOwnPropertyDescriptor(declared, key)?.value
    : undefined;

export { field };
