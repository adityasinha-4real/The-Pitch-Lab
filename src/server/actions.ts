import "server-only";
import { AppError, fail, type Failure } from "@/domain/errors";

/** Convert anything thrown inside a server action into a safe, typed failure. */
export function toFailure(err: unknown): Failure {
  if (err instanceof AppError) return fail(err.code);
  console.error("server action failed", err);
  return fail("INTERNAL");
}
