/** Conflito de serialização/concorrência na transação (o chamador pode pedir retry). */
export class TransactionConflictError extends Error {
  readonly code = "TRANSACTION_CONFLICT";

  constructor(message = "Transaction conflict", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TransactionConflictError";
  }
}
