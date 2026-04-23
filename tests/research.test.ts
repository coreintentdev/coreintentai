import { describe, it, expect } from "vitest";
import { _extractCitations } from "../src/capabilities/research/index.js";

describe("Research — Citation Extraction", () => {
  it("extracts markdown links", () => {
    const content =
      "According to [Reuters](https://reuters.com/article/123) and [Bloomberg](https://bloomberg.com/news/456)";
    const citations = _extractCitations(content);
    expect(citations).toContain("https://reuters.com/article/123");
    expect(citations).toContain("https://bloomberg.com/news/456");
  });

  it("extracts bare URLs", () => {
    const content =
      "Source: https://example.com/data and also https://sec.gov/filings/abc";
    const citations = _extractCitations(content);
    expect(citations).toContain("https://example.com/data");
    expect(citations).toContain("https://sec.gov/filings/abc");
  });

  it("extracts numbered references", () => {
    const content = `Analysis shows growth.

[1] Goldman Sachs Research Report
[2] JP Morgan Market Analysis`;
    const citations = _extractCitations(content);
    expect(citations).toContain("Goldman Sachs Research Report");
    expect(citations).toContain("JP Morgan Market Analysis");
  });

  it("deduplicates URLs", () => {
    const content =
      "See [link](https://example.com) and also https://example.com for more.";
    const citations = _extractCitations(content);
    const exampleCount = citations.filter((c) =>
      c.includes("example.com")
    ).length;
    expect(exampleCount).toBe(1);
  });

  it("returns empty array for content without citations", () => {
    const content = "The stock is trending upward with strong momentum.";
    const citations = _extractCitations(content);
    expect(citations).toEqual([]);
  });

  it("handles mixed citation formats", () => {
    const content = `According to [Reuters](https://reuters.com/story), the market is up.
See also https://bloomberg.com/data for raw data.
[1] WSJ Market Report`;
    const citations = _extractCitations(content);
    expect(citations.length).toBeGreaterThanOrEqual(3);
  });

  it("handles http and https", () => {
    const content = "Visit http://old-site.com and https://new-site.com";
    const citations = _extractCitations(content);
    expect(citations).toContain("http://old-site.com");
    expect(citations).toContain("https://new-site.com");
  });
});
