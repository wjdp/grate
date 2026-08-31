import { describe, expect, it } from "vitest";
import htmlToBareDescription from "./htmlToBareDescription";

describe("htmlToBareDescription", () => {
  it("passes plain text through unchanged", () => {
    expect(htmlToBareDescription("A game about exploring caves.")).toBe(
      "A game about exploring caves.",
    );
  });

  it("strips paragraph and line-break tags", () => {
    expect(htmlToBareDescription("<p>First line.<br>Second line.</p>")).toBe(
      "First line. Second line.",
    );
  });

  it("strips a realistic GOG-style description down to the lead text", () => {
    const html = `
      <p>Explore a vast underground world full of secrets.</p>
      <p>Fight monsters and uncover ancient lore.</p>
      <video muted loop autoplay poster="https://example.com/poster.jpg">
        <source src="https://example.com/trailer.mp4" type="video/mp4">
      </video>
      <h4>KEY FEATURES</h4>
      <ul>
        <li>Huge open world</li>
        <li>Deep crafting system</li>
      </ul>
    `;

    const result = htmlToBareDescription(html);

    expect(result).toBe(
      "Explore a vast underground world full of secrets. Fight monsters and uncover ancient lore.",
    );
    expect(result).not.toMatch(/</);
    expect(result).not.toMatch(/KEY FEATURES/i);
  });

  it("decodes common HTML entities", () => {
    expect(
      htmlToBareDescription("Fish &amp; Chips&nbsp;&#39;n&#39; more"),
    ).toBe("Fish & Chips 'n' more");
  });

  it("collapses runs of whitespace and newlines", () => {
    expect(htmlToBareDescription("Line one\n\n  \t Line two")).toBe(
      "Line one Line two",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToBareDescription("")).toBe("");
  });
});
