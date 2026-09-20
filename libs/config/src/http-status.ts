const httpStatus = {
  accepted: 202,
  badRequest: 400,
  conflict: 409,
  created: 201,
  forbidden: 403,
  found: 302,
  internalServerError: 500,
  methodNotAllowed: 405,
  noContent: 204,
  notFound: 404,
  ok: 200,
  payloadTooLarge: 413,
  paymentRequired: 402,
  serviceUnavailable: 503,
  tooManyRequests: 429,
  unauthorized: 401,
  unsupportedMediaType: 415,
} as const;

export { httpStatus };
