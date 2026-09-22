function fieldError(errors: readonly unknown[]): string | undefined {
  const [first] = errors;
  if (first === undefined) {
    return undefined;
  }
  if (typeof first === "string") {
    return first;
  }
  if (typeof first === "object" && first !== null && "message" in first) {
    return String((first as Readonly<{ message: unknown }>).message);
  }
  return undefined;
}

export { fieldError };
