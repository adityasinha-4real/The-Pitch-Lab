export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "Sign in to do that.",
  FORBIDDEN: "You don't have access to that.",
  SLOT_TAKEN: "Someone just grabbed that slot. Pick another one.",
  SLOT_PAST: "That slot has already kicked off.",
  SLOT_CLOSED: "The turf is closed at that hour.",
  SLOT_INVALID: "Slots start on the hour.",
  SLOT_TOO_FAR: "You can book up to a week ahead.",
  SLOT_UNPRICED: "That slot isn't open for booking.",
  TURF_NOT_FOUND: "We couldn't find that turf.",
  HOLD_NOT_FOUND: "That hold has already been released.",
  HOLD_EXPIRED: "Your hold ran out of time. Pick the slot again.",
  BOOKING_NOT_FOUND: "We couldn't find that booking.",
  NOT_CANCELLABLE: "That booking can't be cancelled.",
  ALREADY_STARTED: "That game has already kicked off.",
  NOT_SPLITTABLE: "Only upcoming confirmed bookings can be split.",
  SPLIT_EXISTS: "This booking is already being split.",
  SEATS_INVALID: "Split between 2 and 14 players.",
  SHARE_NOT_FOUND: "That split link isn't valid.",
  SPLIT_CLOSED: "This split is closed.",
  SEAT_PAID: "That share is already paid.",
  SEAT_PENDING: "Someone is paying for that share right now. Try another.",
  NOT_OPENABLE: "Only upcoming confirmed bookings can be opened up.",
  GAME_NOT_FOUND: "That game is no longer listed.",
  GAME_CLOSED: "That game has already kicked off.",
  GAME_FULL: "That game is full.",
  OWN_GAME: "That's your own game.",
  ALREADY_JOINED: "You're already in this game.",
  NOT_JOINED: "You're not in this game.",
  BLOCK_NOT_FOUND: "That block has already been lifted.",
  AMOUNT_MISMATCH: "Payment amount didn't match.",
  PAYMENT_FAILED: "The payment didn't go through.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  INVALID_INPUT: "Something about that request wasn't right.",
  INTERNAL: "Something went wrong on our side. Try again.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function isErrorCode(s: string): s is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, s);
}

export class AppError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = "AppError";
  }
}

export type Failure = { ok: false; error: ErrorCode; message: string };
export type ActionResult<T extends object = object> = ({ ok: true } & T) | Failure;

export function fail(code: ErrorCode): Failure {
  return { ok: false, error: code, message: ERROR_MESSAGES[code] };
}
