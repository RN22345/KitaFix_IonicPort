export type RepairOpsErrorCode =
  | 'INVALID_STATUS'
  | 'NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFIG'
  | 'UNKNOWN';

export class RepairOpsError extends Error {
  constructor(
    readonly code: RepairOpsErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'RepairOpsError';
  }
}

export function repairOpsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
