import { z } from "zod";

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ParseError";
  }
}

const EXTRACTION_PATTERNS = [
  /```json\s*([\s\S]*?)```/,
  /```\s*([\s\S]*?)```/,
  /\{[\s\S]*\}/,
  /\[[\s\S]*\]/,
];

function extractJson(content: string): string {
  const trimmed = content.trim();

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return trimmed;
  }

  for (const pattern of EXTRACTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const candidate = match[1]?.trim() ?? match[0].trim();
      if (
        (candidate.startsWith("{") && candidate.endsWith("}")) ||
        (candidate.startsWith("[") && candidate.endsWith("]"))
      ) {
        return candidate;
      }
    }
  }

  return trimmed;
}

export function parseJsonResponse<T extends z.ZodType>(
  content: string,
  schema: T
): z.infer<T> {
  const jsonStr = extractJson(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new ParseError(
      `Failed to extract valid JSON from model response`,
      content
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ParseError(
      `Response JSON failed schema validation: ${issues}`,
      content,
      result.error
    );
  }

  return result.data;
}

export function parseJsonArrayResponse<T extends z.ZodType>(
  content: string,
  itemSchema: T
): z.infer<T>[] {
  const jsonStr = extractJson(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new ParseError(
      `Failed to extract valid JSON array from model response`,
      content
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ParseError(
      `Expected a JSON array but got ${typeof parsed}`,
      content
    );
  }

  return parsed.map((item: unknown, index: number) => {
    const result = itemSchema.safeParse(item);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new ParseError(
        `Array item [${index}] failed schema validation: ${issues}`,
        content,
        result.error
      );
    }
    return result.data;
  });
}
