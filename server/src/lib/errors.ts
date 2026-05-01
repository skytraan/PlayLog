// Replaces Convex's ConvexError. Carries an HTTP status so routes can
// translate domain failures into appropriate response codes.
export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
