/**
 * CoreIntent AI — JSON Extraction Utility
 *
 * Robust extraction and validation of JSON from LLM responses.
 * Models often wrap JSON in markdown code fences or include preamble text.
 * This utility handles all common formats and validates against Zod schemas.
 */

import type { z } from "zod";

/**
 * Extract JSON from an LLM response string.
 *
 * Handles these formats:
 *   1. ```json\n{...}\n```  (fenced JSON)
 *   2. ```\n{...}\n```      (fenced without language tag)
 *   3. Raw JSON string       (no fencing)
 *   4. JSON embedded in text  (finds first { or [ and extracts)
 *
 * @throws {JSONExtractionError} if no valid JSON can be extracted
 */
export function extractJSON(content: string): unknown {
  // Strategy 1: Markdown code fence
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Fence contained invalid JSON — fall through to other strategies
    }
  }

  // Strategy 2: Raw JSON (trimmed)
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid raw JSON — fall through
    }
  }

  // Strategy 3: Find first JSON object or array in the text
  const jsonStart = findJSONBoundary(trimmed);
  if (jsonStart !== null) {
    try {
      return JSON.parse(jsonStart);
    } catch {
      // Found brackets but invalid JSON
    }
  }

  throw new JSONExtractionError(
    `Could not extract valid JSON from response (${content.length} chars)`,
    content
  );
}

/**
 * Extract and validate JSON against a Zod schema.
 * Combines extraction + validation in one step.
 *
 * @throws {JSONExtractionError} if JSON cannot be extracted
 * @throws {ZodError} if JSON doesn't match the schema
 */
export function extractAndValidate<T extends z.ZodType>(
  content: string,
  schema: T
): z.infer<T> {
  const raw = extractJSON(content);
  return schema.parse(raw);
}

/**
 * Extract an array of items, each validated against a schema.
 */
export function extractAndValidateArray<T extends z.ZodType>(
  content: string,
  schema: T
): z.infer<T>[] {
  const raw = extractJSON(content);
  if (!Array.isArray(raw)) {
    throw new JSONExtractionError("Expected a JSON array", content);
  }
  return raw.map((item: unknown) => schema.parse(item));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the first complete JSON object or array in a string by
 * tracking bracket depth.
 */
function findJSONBoundary(text: string): string | null {
  const startChars = ["{", "["];
  const endMap: Record<string, string> = { "{": "}", "[": "]" };

  for (let i = 0; i < text.length; i++) {
    if (!startChars.includes(text[i])) continue;

    const opener = text[i];
    const closer = endMap[opener];
    let depth = 1;
    let inString = false;
    let escaped = false;

    for (let j = i + 1; j < text.length; j++) {
      const char = text[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === opener) depth++;
      if (char === closer) depth--;

      if (depth === 0) {
        return text.slice(i, j + 1);
      }
    }
  }

  return null;
}

export class JSONExtractionError extends Error {
  public readonly rawContent: string;

  constructor(message: string, rawContent: string) {
    super(message);
    this.name = "JSONExtractionError";
    this.rawContent = rawContent.slice(0, 500);
  }
}
