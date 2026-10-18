export class PlannerError extends Error {
  constructor(status, kind, message, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
