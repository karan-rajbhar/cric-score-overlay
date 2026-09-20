/**
 * Utilities and validation rules for unique user handles / @usernames.
 * Compatible with standard social platform conventions (Threads, Instagram, X/Twitter).
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Valid handle regex:
 * - 3 to 30 characters
 * - lowercase letters, numbers, and underscores only
 * - must start and end with an alphanumeric character (cannot start or end with underscore)
 */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/;

/**
 * Reserved usernames that cannot be claimed by standard users to avoid
 * routing collisions, spoofing, and system impersonation.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "about",
  "account",
  "admin",
  "administrator",
  "all",
  "analytics",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "bot",
  "broadcast",
  "cai",
  "club",
  "clubs",
  "contact",
  "cricscore",
  "dashboard",
  "dev",
  "developer",
  "docs",
  "edit",
  "explore",
  "faq",
  "graphql",
  "help",
  "home",
  "inbox",
  "info",
  "jobs",
  "join",
  "legal",
  "live",
  "login",
  "logout",
  "match",
  "matches",
  "media",
  "message",
  "messages",
  "moderator",
  "news",
  "notifications",
  "official",
  "overlay",
  "overview",
  "player",
  "players",
  "privacy",
  "profile",
  "root",
  "score",
  "scores",
  "search",
  "security",
  "settings",
  "signin",
  "signup",
  "squad",
  "squads",
  "status",
  "stumps",
  "super",
  "support",
  "system",
  "team",
  "teams",
  "terms",
  "tournament",
  "tournaments",
  "user",
  "users",
  "verify",
]);

export interface UsernameValidationResult {
  isValid: boolean;
  cleanUsername: string;
  error?: string;
}

/**
 * Strips leading '@', trims whitespace, and converts to lowercase.
 */
export function cleanHandle(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim().replace(/^[@%40]+/, "").toLowerCase();
}

/**
 * Formats a username with leading '@' symbol (e.g. "@karan").
 * If username is empty or missing, returns an empty string or optional fallback.
 */
export function formatHandle(
  username: string | null | undefined,
  fallback = "",
): string {
  const clean = cleanHandle(username);
  if (!clean) return fallback;
  return `@${clean}`;
}

/**
 * Validates a proposed username against length, character set, and reserved word rules.
 */
export function validateUsername(
  input: string | null | undefined,
): UsernameValidationResult {
  const clean = cleanHandle(input);

  if (!clean) {
    return {
      isValid: false,
      cleanUsername: "",
      error: "Username is required",
    };
  }

  if (clean.length < USERNAME_MIN_LENGTH) {
    return {
      isValid: false,
      cleanUsername: clean,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (clean.length > USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      cleanUsername: clean,
      error: `Username cannot exceed ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  if (!USERNAME_REGEX.test(clean)) {
    if (clean.startsWith("_") || clean.endsWith("_")) {
      return {
        isValid: false,
        cleanUsername: clean,
        error: "Username cannot start or end with an underscore",
      };
    }
    return {
      isValid: false,
      cleanUsername: clean,
      error:
        "Username can only contain lowercase letters, numbers, and underscores",
    };
  }

  if (RESERVED_USERNAMES.has(clean)) {
    return {
      isValid: false,
      cleanUsername: clean,
      error: "This username is reserved and cannot be claimed",
    };
  }

  return {
    isValid: true,
    cleanUsername: clean,
  };
}
