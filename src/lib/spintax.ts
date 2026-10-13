/**
 * Replaces dynamic variables in the template.
 * Example Input: ("Hi {{name}}!", { name: "John" }) -> "Hi John!"
 */
export function injectVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}|(?<!\{)\{(name|first_name|last_name|phone)\}(?!\})/g, (match, variableName, legacyName) => {
    const key = (variableName || legacyName).trim();
    return variables[key] ?? match;
  });
}

/**
 * Example Input: "{Hello|Hi|Hey} there! Are you looking for {shoes|shirts}?"
 * Example Output: "Hi there! Are you looking for shirts?"
 */
export function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/g;
  
  // Recursively resolve nested spintax if necessary, but simple regex works for flat
  let parsedText = text;
  let match;

  while ((match = spintaxRegex.exec(parsedText)) !== null) {
    const options = match[1].split("|");
    const selectedOption = options[Math.floor(Math.random() * options.length)];
    parsedText = parsedText.substring(0, match.index) + selectedOption + parsedText.substring(match.index + match[0].length);
    // Reset regex index because we modified the string length
    spintaxRegex.lastIndex = 0;
  }

  return parsedText;
}

/**
 * Randomizer for human delays
 * Returns a random delay in milliseconds between min and max.
 */
export function getRandomDelay(minSeconds: number, maxSeconds: number): number {
  const minMs = minSeconds * 1000;
  const maxMs = maxSeconds * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
