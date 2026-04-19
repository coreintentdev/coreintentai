import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  parseJsonResponse,
  parseJsonArrayResponse,
  ParseError,
} from "../src/utils/json-parser.js";

const TestSchema = z.object({
  name: z.string(),
  value: z.number().min(0).max(100),
});

describe("JSON Parser", () => {
  describe("parseJsonResponse", () => {
    it("parses raw JSON", () => {
      const result = parseJsonResponse('{"name": "test", "value": 42}', TestSchema);
      expect(result.name).toBe("test");
      expect(result.value).toBe(42);
    });

    it("extracts JSON from markdown code fences", () => {
      const content = `Here's the analysis:\n\n\`\`\`json\n{"name": "test", "value": 50}\n\`\`\`\n\nHope that helps!`;
      const result = parseJsonResponse(content, TestSchema);
      expect(result.name).toBe("test");
      expect(result.value).toBe(50);
    });

    it("extracts JSON from code fences without json tag", () => {
      const content = `Result:\n\n\`\`\`\n{"name": "result", "value": 75}\n\`\`\``;
      const result = parseJsonResponse(content, TestSchema);
      expect(result.name).toBe("result");
    });

    it("extracts JSON object embedded in text", () => {
      const content = `The analysis shows that {"name": "embedded", "value": 30} is the correct output.`;
      const result = parseJsonResponse(content, TestSchema);
      expect(result.name).toBe("embedded");
    });

    it("handles whitespace around JSON", () => {
      const content = `\n\n  {"name": "padded", "value": 10}  \n\n`;
      const result = parseJsonResponse(content, TestSchema);
      expect(result.name).toBe("padded");
    });

    it("throws ParseError for invalid JSON", () => {
      expect(() => parseJsonResponse("not json at all", TestSchema)).toThrow(
        ParseError
      );
    });

    it("throws ParseError for schema validation failure", () => {
      const content = '{"name": "test", "value": 150}';
      expect(() => parseJsonResponse(content, TestSchema)).toThrow(ParseError);
    });

    it("includes field path in validation error message", () => {
      const content = '{"name": "test", "value": -5}';
      try {
        parseJsonResponse(content, TestSchema);
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).message).toContain("value");
      }
    });

    it("preserves raw content in ParseError", () => {
      const content = "garbage";
      try {
        parseJsonResponse(content, TestSchema);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as ParseError).rawContent).toBe(content);
      }
    });
  });

  describe("parseJsonArrayResponse", () => {
    it("parses raw JSON array", () => {
      const content = '[{"name": "a", "value": 1}, {"name": "b", "value": 2}]';
      const result = parseJsonArrayResponse(content, TestSchema);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("a");
      expect(result[1].name).toBe("b");
    });

    it("extracts array from markdown fences", () => {
      const content = `\`\`\`json\n[{"name": "x", "value": 10}]\n\`\`\``;
      const result = parseJsonArrayResponse(content, TestSchema);
      expect(result).toHaveLength(1);
    });

    it("throws ParseError for non-array JSON", () => {
      const content = '{"name": "test", "value": 1}';
      expect(() => parseJsonArrayResponse(content, TestSchema)).toThrow(
        ParseError
      );
    });

    it("throws ParseError with item index on validation failure", () => {
      const content =
        '[{"name": "ok", "value": 50}, {"name": "bad", "value": -1}]';
      try {
        parseJsonArrayResponse(content, TestSchema);
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).message).toContain("[1]");
      }
    });
  });
});
