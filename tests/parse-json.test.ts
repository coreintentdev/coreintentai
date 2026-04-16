import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractJson,
  parseJsonResponse,
  parseJsonArrayResponse,
  JsonParseError,
} from "../src/utils/parse-json.js";

const TestSchema = z.object({
  name: z.string(),
  value: z.number(),
});

describe("extractJson", () => {
  describe("Strategy 1: Direct parse", () => {
    it("parses clean JSON object", () => {
      const result = extractJson('{"name": "test", "value": 42}');
      expect(result).toEqual({ name: "test", value: 42 });
    });

    it("parses clean JSON array", () => {
      const result = extractJson('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it("parses JSON with whitespace", () => {
      const result = extractJson('  \n  {"name": "test", "value": 1}  \n  ');
      expect(result).toEqual({ name: "test", value: 1 });
    });
  });

  describe("Strategy 2: ```json fences", () => {
    it("extracts from json-tagged fence", () => {
      const content = `Here is the result:

\`\`\`json
{"name": "fenced", "value": 99}
\`\`\`

Hope that helps!`;

      const result = extractJson(content);
      expect(result).toEqual({ name: "fenced", value: 99 });
    });

    it("handles fence with no whitespace after tag", () => {
      const content = '```json{"name":"tight","value":1}```';
      const result = extractJson(content);
      expect(result).toEqual({ name: "tight", value: 1 });
    });
  });

  describe("Strategy 3: plain ``` fences", () => {
    it("extracts from untagged fence", () => {
      const content = `\`\`\`
{"name": "plain", "value": 7}
\`\`\``;

      const result = extractJson(content);
      expect(result).toEqual({ name: "plain", value: 7 });
    });
  });

  describe("Strategy 4: bracket extraction", () => {
    it("extracts JSON from surrounding text (object)", () => {
      const content =
        'The analysis is as follows: {"name": "embedded", "value": 5} — end of analysis.';
      const result = extractJson(content);
      expect(result).toEqual({ name: "embedded", value: 5 });
    });

    it("extracts JSON array from surrounding text", () => {
      const content = 'Here are the results: [1, 2, 3] and that is all.';
      const result = extractJson(content);
      expect(result).toEqual([1, 2, 3]);
    });

    it("extracts enclosing array when it contains objects", () => {
      const content =
        'Here are the signals: [{"name":"a","value":1},{"name":"b","value":2}]';
      const result = extractJson(content);
      expect(result).toEqual([
        { name: "a", value: 1 },
        { name: "b", value: 2 },
      ]);
    });

    it("handles nested objects", () => {
      const content =
        'Result: {"outer": {"inner": true}, "list": [1, 2]} done.';
      const result = extractJson(content);
      expect(result).toEqual({ outer: { inner: true }, list: [1, 2] });
    });

    it("handles strings with brackets inside JSON", () => {
      const content =
        'Output: {"message": "Hello {world}", "value": 42} end.';
      const result = extractJson(content);
      expect(result).toEqual({ message: "Hello {world}", value: 42 });
    });

    it("handles escaped quotes in strings", () => {
      const content =
        'Result: {"text": "say \\"hello\\"", "n": 1} done.';
      const result = extractJson(content);
      expect(result).toEqual({ text: 'say "hello"', n: 1 });
    });
  });

  describe("Strategy 5: preamble stripping", () => {
    it("strips 'Here is the JSON:' preamble", () => {
      const content = 'Here is the JSON: {"name": "stripped", "value": 3}';
      const result = extractJson(content);
      expect(result).toEqual({ name: "stripped", value: 3 });
    });

    it("strips 'Sure!' preamble", () => {
      const content = 'Sure! {"name": "sure", "value": 8}';
      const result = extractJson(content);
      expect(result).toEqual({ name: "sure", value: 8 });
    });

    it("strips 'Certainly.' preamble", () => {
      const content = 'Certainly. {"name": "certainly", "value": 2}';
      const result = extractJson(content);
      expect(result).toEqual({ name: "certainly", value: 2 });
    });
  });

  describe("error handling", () => {
    it("throws JsonParseError for unparseable content", () => {
      expect(() => extractJson("This is not JSON at all")).toThrow(
        JsonParseError
      );
    });

    it("includes raw content in error", () => {
      try {
        extractJson("no json here");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(JsonParseError);
        expect((e as JsonParseError).rawContent).toBe("no json here");
      }
    });

    it("throws for empty string", () => {
      expect(() => extractJson("")).toThrow(JsonParseError);
    });
  });
});

describe("parseJsonResponse", () => {
  it("parses and validates against schema", () => {
    const result = parseJsonResponse(
      '{"name": "validated", "value": 42}',
      TestSchema
    );
    expect(result).toEqual({ name: "validated", value: 42 });
  });

  it("throws on schema violation", () => {
    expect(() =>
      parseJsonResponse('{"name": "bad", "value": "not_a_number"}', TestSchema)
    ).toThrow();
  });

  it("works with fenced JSON and schema validation", () => {
    const content = `\`\`\`json
{"name": "fenced", "value": 10}
\`\`\``;
    const result = parseJsonResponse(content, TestSchema);
    expect(result).toEqual({ name: "fenced", value: 10 });
  });

  it("works with preamble and schema validation", () => {
    const content =
      'Here is my analysis: {"name": "preamble", "value": 77} That should do it.';
    const result = parseJsonResponse(content, TestSchema);
    expect(result).toEqual({ name: "preamble", value: 77 });
  });
});

describe("parseJsonArrayResponse", () => {
  it("parses and validates array elements", () => {
    const content =
      '[{"name": "a", "value": 1}, {"name": "b", "value": 2}]';
    const result = parseJsonArrayResponse(content, TestSchema);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("a");
    expect(result[1].value).toBe(2);
  });

  it("throws if result is not an array", () => {
    expect(() =>
      parseJsonArrayResponse('{"name": "not_array", "value": 1}', TestSchema)
    ).toThrow(JsonParseError);
  });

  it("throws on invalid array element", () => {
    const content =
      '[{"name": "ok", "value": 1}, {"name": "bad"}]';
    expect(() => parseJsonArrayResponse(content, TestSchema)).toThrow();
  });

  it("handles fenced array", () => {
    const content = `\`\`\`json
[{"name": "x", "value": 99}]
\`\`\``;
    const result = parseJsonArrayResponse(content, TestSchema);
    expect(result).toHaveLength(1);
  });

  it("parses array-of-objects wrapped in preamble text", () => {
    const content =
      'Here are the signals: [{"name":"a","value":1},{"name":"b","value":2}]';
    const result = parseJsonArrayResponse(content, TestSchema);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("a");
    expect(result[1].name).toBe("b");
  });
});
