const foldedChars = new Map<string, string>();

/**
 * One letter in lowercase and without its accents ("Á" -> "a"), to compare texts the way MySQL's utf8mb4_general_ci does (#1309).
 * Used by the SQLite search (fold()) and by the autocomplete of the client, which bolds the typed text.
 * NFD only splits letters that carry a combining mark: ø, ł or ß stay as they are.
 */
export const foldChar = (char: string): string => {
  let folded = foldedChars.get(char);
  if (folded === undefined) {
    // ς is how a word-final σ is written: toLowerCase() makes it from Σ depending on what follows
    folded = char.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace('ς', 'σ');
    foldedChars.set(char, folded);
  }
  return folded;
};
