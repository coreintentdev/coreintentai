/**
 * CoreIntent AI — Robust JSON Parsing
 *
 * LLMs return JSON in unpredictable wrappers — markdown fences, preamble text,
 * trailing commentary, or raw. This utility tries multiple extraction strategies
 * in order so the rest of the codebase doesn't need to care.
 *
 * Strategies (tried in order):
 *   1. Direct JSON.parse (fastest — handles clean responses)
 *   2. Extract from ```json ... ``` fences
 *   3. Extract from ``` ... ``` fences (no language tag)
 *   4. Find first { ... } or [ ... ] bracket pair (handles preamble/trailing text)
 *   5. Strip common LLM preamble ("Here is the JSON:", "Sure!", etc.)
 */

import type { z } from "zod";

export class JsonParseError extends Error {
  public readonly rawContent: string;

  constructor(message: string, rawContent: string) {
    super(message);
    this.name = "JsonParseError";
    this.rawContent = rawContent;
  }
}

/**
 * Parse a JSON object from LLM output, validated against a Zod schema.
 *
 * @param content  Raw LLM response string
 * @param schema   Zod schema to validate the parsed object
 * @returns        Validated, typed result
 * @throws         JsonParseError if no valid JSON can be extracted
 */
export function parseJsonResponse<T>(
  content: string,
  schema: z.ZodType<T>
): T {
  const parsed = extractJson(content);
  return schema.parse(parsed);
}

/**
 * Parse a JSON array from LLM output, validated per-element against a Zod schema.
 */
export function parseJsonArrayResponse<T>(
  content: string,
  schema: z.ZodType<T>
): T[] {
  const parsed = extractJson(content);

  if (!Array.isArray(parsed)) {
    throw new JsonParseError(
      `Expected a JSON array but got ${typeof parsed}`,
      content
    );
  }

  return parsed.map((item: unknown) => schema.parse(item));
}

/**
 * Extract a JSON value from raw LLM output using multiple strategies.
 */
export function extractJson(content: string): unknown {
  const trimmed = content.trim();

  // Strategy 1: Direct parse
  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  // Strategy 2: ```json ... ``` fences
  const jsonFence = trimmed.match(/```json\s*([\s\S]*?)```/);
  if (jsonFence) {
    const result = tryParse(jsonFence[1].trim());
    if (result !== undefined) return result;
  }

  // Strategy 3: ``` ... ``` fences (no language tag)
  const plainFence = trimmed.match(/```\s*([\s\S]*?)```/);
  if (plainFence) {
    const result = tryParse(plainFence[1].trim());
    if (result !== undefined) return result;
  }

  // Strategy 4: Find outermost { ... } or [ ... ] bracket pair
  const bracketResult = extractBracketedJson(trimmed);
  if (bracketResult !== undefined) return bracketResult;

  // Strategy 5: Strip common preamble and retry
  const stripped = stripPreamble(trimmed);
  if (stripped !== trimmed) {
    const result = tryParse(stripped);
    if (result !== undefined) return result;

    // Also try bracket extraction on stripped content
    const bracketStripped = extractBracketedJson(stripped);
    if (bracketStripped !== undefined) return bracketStripped;
  }

  throw new JsonParseError(
    `Could not extract valid JSON from LLM response (${trimmed.length} chars). ` +
      `First 200 chars: ${trimmed.slice(0, 200)}`,
    content
  );
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Find the outermost balanced { } or [ ] pair in a string and parse it.
 * Tries whichever bracket appears first in the text so that an enclosing
 * array (e.g. `[{"ticker":"AAPL",...}]`) is preferred over an inner object.
 */
function extractBracketedJson(text: string): unknown | undefined {
  const pairs: Array<[string, string]> = [
    ["{", "}"],
    ["[", "]"],
  ];

  // Sort bracket pairs by which appears first in the text
  const sorted = pairs
    .map(([open, close]) => ({ open, close, idx: text.indexOf(open) }))
    .filter((p) => p.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  for (const { open, close, idx: startIdx } of sorted) {
    // Walk forward to find the matching close bracket
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === "\\") {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === open) depth++;
      if (ch === close) depth--;

      if (depth === 0) {
        const candidate = text.slice(startIdx, i + 1);
        const result = tryParse(candidate);
        if (result !== undefined) return result;
        break;
      }
    }
  }

  return undefined;
}

/**
 * Strip common LLM preamble patterns that appear before JSON.
 */
function stripPreamble(text: string): string {
  // Remove lines before the first { or [
  const patterns = [
    /^(?:here(?:'s| is) (?:the |my )?(?:json|analysis|response|result)[:\s]*)/i,
    /^(?:sure[!,.]?\s*)/i,
    /^(?:certainly[!,.]?\s*)/i,
    /^(?:okay[!,.]?\s*)/i,
    /^(?:the (?:json|analysis|response|result) is[:\s]*)/i,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }

  return result.trim();
}
