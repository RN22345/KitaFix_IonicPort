/** Error codes shared by both repository implementations and the UI. */
export type BookingErrorCode =
  | 'SLOT_TAKEN'
  | 'NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFIG'
  | 'UNKNOWN';

export class BookingError extends Error {
  constructor(
    readonly code: BookingErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'BookingError';
  }
}

/** Friendly message for the screen. Nothing raw from Postgres reaches the UI. */
export function bookingErrorMessage(error: unknown): string {
  if (error instanceof BookingError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
