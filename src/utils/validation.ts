/**
 * Name and Room validation utilities for SyncDeck Terminal
 */

const RESERVED_NAMES = new Set([
  "host",
  "admin",
  "moderator",
  "system",
  "teacher",
  "instructor",
  "anonymous",
  "student",
  "user",
  "root",
  "staff",
  "facilitator"
]);

const PROFANITY_WORDS = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "bastard",
  "crap",
  "dick",
  "cunt",
  "pussy",
  "nigger",
  "faggot",
  "slut",
  "whore",
  "dumbass",
  "jackass",
  "retard"
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleanName?: string;
}

/**
 * Validates a display name (for both Host and Participant) with rich, robust rules.
 */
export function validateDisplayName(name: string, role: "HOST" | "STUDENT"): ValidationResult {
  if (!name) {
    return { isValid: false, error: "Display name cannot be empty." };
  }

  // Trim and remove multiple spaces
  let cleaned = name.trim().replace(/\s+/g, " ");

  // 1. Length constraint
  if (cleaned.length < 2) {
    return { isValid: false, error: "Display name must be at least 2 characters." };
  }
  if (cleaned.length > 25) {
    return { isValid: false, error: "Display name must be 25 characters or less." };
  }

  // 2. Character subset rule
  const allowedCharsRegex = /^[a-zA-Z0-9 _-]+$/;
  if (!allowedCharsRegex.test(cleaned)) {
    return { 
      isValid: false, 
      error: "Only letters, numbers, spaces, hyphens (-), and underscores (_) are allowed." 
    };
  }

  // 3. Must contain at least one alphabetical letter
  const hasLetter = /[a-zA-Z]/.test(cleaned);
  if (!hasLetter) {
    return { 
      isValid: false, 
      error: "Display name must contain at least one alphabetical letter (cannot be purely numbers or symbols)." 
    };
  }

  // 4. Prevent purely numeric names (already covered by hasLetter, but let's have a specific check and message for absolute clarity)
  if (/^\d+$/.test(cleaned)) {
    return { isValid: false, error: "Display name cannot consist of numbers only." };
  }

  // 5. Impersonation of standard roles
  const lowerName = cleaned.toLowerCase();
  if (RESERVED_NAMES.has(lowerName)) {
    return { 
      isValid: false, 
      error: `"${cleaned}" is a reserved system label and cannot be used as a display name.` 
    };
  }

  // 6. Check for consecutive identical/triple characters (e.g. "aaa", "111", "---", "___") to prevent spam entries
  const repeatedRegex = /(.)\1\1/;
  if (repeatedRegex.test(lowerName.replace(/\s/g, ""))) {
    return { 
      isValid: false, 
      error: "Display name contains too many repeated consecutive characters." 
    };
  }

  // 7. Standard profanity word list check (case-insensitive substring)
  for (const word of PROFANITY_WORDS) {
    if (lowerName.includes(word)) {
      return { 
        isValid: false, 
        error: "Display name contains inappropriate or unprofessional language." 
      };
    }
  }

  // 8. Auto-capitalize first letter of each word to look professional
  const capitalized = cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return { isValid: true, cleanName: capitalized };
}

/**
 * Validates a Room Code.
 */
export function validateRoomCode(code: string): ValidationResult {
  if (!code) {
    return { isValid: false, error: "Room code is required." };
  }

  const cleaned = code.trim().toUpperCase();

  // Validate format and length
  if (cleaned.length < 4 || cleaned.length > 12) {
    return { isValid: false, error: "Room code must be between 4 and 12 characters." };
  }

  const validCodeRegex = /^[A-Z0-9-]+$/;
  if (!validCodeRegex.test(cleaned)) {
    return { isValid: false, error: "Room code contains invalid characters." };
  }

  return { isValid: true, cleanName: cleaned };
}
