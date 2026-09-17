const httpStatus = {
  accepted: 202,
  badRequest: 400,
  forbidden: 403,
  internalServerError: 500,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  unsupportedMediaType: 415,
} as const;

export { httpStatus };
