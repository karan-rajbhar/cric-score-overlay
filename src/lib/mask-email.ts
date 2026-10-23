/**
 * "k…@gmail.com": enough for someone who knows the address to recognise
 * it, without showing it. For pending invites on screens other than the
 * one where it was typed.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "…";
  return `${email[0]}…${email.slice(at)}`;
}
