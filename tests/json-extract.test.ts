import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractJSON,
  extractAndValidate,
  extractAndValidateArray,
  JSONExtractionError,
} from "../src/utils/json-extract.js";

describe("extractJSON", () => {
  it("extracts from markdown code fence with json tag", () => {
    const input = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.';
    expect(extractJSON(input)).toEqual({ key: "value" });
  });

  it("extracts from markdown code fence without language tag", () => {
    const input = '```\n{"ticker": "AAPL"}\n```';
    expect(extractJSON(input)).toEqual({ ticker: "AAPL" });
  });

  it("extracts raw JSON object", () => {
    const input = '{"action": "buy", "confidence": 0.8}';
    expect(extractJSON(input)).toEqual({ action: "buy", confidence: 0.8 });
  });

  it("extracts raw JSON array", () => {
    const input = '[1, 2, 3]';
    expect(extractJSON(input)).toEqual([1, 2, 3]);
  });

  it("extracts JSON embedded in surrounding text", () => {
    const input =
      'Sure! Here is the analysis:\n\n{"sentiment": "bullish", "score": 0.7}\n\nLet me know if you need more.';
    expect(extractJSON(input)).toEqual({ sentiment: "bullish", score: 0.7 });
  });

  it("handles nested JSON objects", () => {
    const input =
      '```json\n{"nested": {"deep": {"value": 42}}}\n```';
    const result = extractJSON(input) as Record<string, unknown>;
    expect(result).toEqual({ nested: { deep: { value: 42 } } });
  });

  it("handles JSON with escaped strings", () => {
    const input = '{"text": "he said \\"hello\\""}';
    expect(extractJSON(input)).toEqual({ text: 'he said "hello"' });
  });

  it("throws JSONExtractionError for non-JSON text", () => {
    expect(() => extractJSON("This is just plain text.")).toThrow(
      JSONExtractionError
    );
  });

  it("throws JSONExtractionError for empty string", () => {
    expect(() => extractJSON("")).toThrow(JSONExtractionError);
  });

  it("prefers fenced JSON over embedded JSON", () => {
    const input =
      '{"wrong": true}\n```json\n{"correct": true}\n```';
    expect(extractJSON(input)).toEqual({ correct: true });
  });
});

describe("extractAndValidate", () => {
  const TestSchema = z.object({
    ticker: z.string(),
    score: z.number().min(0).max(1),
  });

  it("extracts and validates valid JSON", () => {
    const input = '```json\n{"ticker": "AAPL", "score": 0.85}\n```';
    const result = extractAndValidate(input, TestSchema);
    expect(result.ticker).toBe("AAPL");
    expect(result.score).toBe(0.85);
  });

  it("throws ZodError for invalid schema match", () => {
    const input = '{"ticker": "AAPL", "score": 2.0}'; // score > 1
    expect(() => extractAndValidate(input, TestSchema)).toThrow();
  });

  it("throws JSONExtractionError for non-JSON input", () => {
    expect(() => extractAndValidate("no json here", TestSchema)).toThrow(
      JSONExtractionError
    );
  });
});

describe("extractAndValidateArray", () => {
  const ItemSchema = z.object({
    ticker: z.string(),
    action: z.enum(["buy", "sell", "hold"]),
  });

  it("extracts and validates an array of items", () => {
    const input =
      '```json\n[{"ticker": "AAPL", "action": "buy"}, {"ticker": "TSLA", "action": "sell"}]\n```';
    const result = extractAndValidateArray(input, ItemSchema);
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe("AAPL");
    expect(result[1].action).toBe("sell");
  });

  it("throws when response is not an array", () => {
    const input = '{"ticker": "AAPL", "action": "buy"}';
    expect(() => extractAndValidateArray(input, ItemSchema)).toThrow(
      "Expected a JSON array"
    );
  });

  it("throws ZodError when an item fails validation", () => {
    const input = '[{"ticker": "AAPL", "action": "yolo"}]';
    expect(() => extractAndValidateArray(input, ItemSchema)).toThrow();
  });
});
