// Banned words list — blocks usernames entirely, censors in chat.
// Keep lowercase. Matching is case-insensitive and checks for substring containment.
const BANNED_WORDS: string[] = [
  // Slurs and hate speech
  "nigger", "nigga", "faggot", "fag", "retard", "tranny", "kike", "spic",
  "chink", "gook", "wetback", "beaner", "coon", "darkie", "towelhead",
  "raghead", "cracker",
  // Profanity
  "fuck", "shit", "cunt", "bitch", "asshole", "dickhead", "cocksucker",
  "motherfucker", "twat",
  // Sexual
  "penis", "vagina", "porn", "hentai",
];

/** Returns true if the text contains any banned word (case-insensitive substring match). */
export function containsBannedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

/** Replaces banned words in text with asterisks, preserving the rest. Case-insensitive. */
export function censorText(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}
