import { describe, expect, it } from "vitest";
import { normaliseGameName } from "./normaliseGameName";

describe("normaliseGameName", () => {
  it("strips trademark glyphs and trailing whitespace", () => {
    expect(normaliseGameName("Dishonored®: Death of the Outsider™ ")).toBe(
      normaliseGameName("Dishonored®: Death of the Outsider™"),
    );
  });

  it("strips trademark glyphs and punctuation", () => {
    expect(normaliseGameName("STAR WARS™: Squadrons")).toBe(
      normaliseGameName("Star Wars Squadrons"),
    );
  });

  it("strips 'game of the year edition'", () => {
    expect(normaliseGameName("Tomb Raider GAME OF THE YEAR EDITION")).toBe(
      normaliseGameName("Tomb Raider"),
    );
  });

  it("strips 'redux' as a whole word", () => {
    expect(normaliseGameName("Metro 2033 Redux")).toBe(
      normaliseGameName("Metro 2033"),
    );
  });

  it("strips 'remastered'", () => {
    expect(normaliseGameName("BioShock Remastered")).toBe(
      normaliseGameName("BioShock"),
    );
  });

  it("treats 'complete edition' and 'redux' as equivalent editions", () => {
    expect(normaliseGameName("Metro: Last Light Complete Edition")).toBe(
      normaliseGameName("Metro: Last Light Redux"),
    );
  });

  it('strips "director\'s cut"', () => {
    expect(normaliseGameName("Wasteland 2: Director's Cut")).toBe(
      normaliseGameName("Wasteland 2"),
    );
  });

  it("strips 'enhanced edition'", () => {
    expect(normaliseGameName("Little Nightmares Enhanced Edition")).toBe(
      normaliseGameName("Little Nightmares"),
    );
  });

  it("strips a trailing bare 'enhanced'", () => {
    expect(normaliseGameName("Grand Theft Auto V Enhanced")).toBe(
      normaliseGameName("Grand Theft Auto V"),
    );
  });

  it("does not strip 'edition' when not part of edition vocabulary", () => {
    expect(normaliseGameName("Bad North: Jotunn Edition")).toBe(
      "bad north jotunn edition",
    );
  });

  it("keeps year disambiguators", () => {
    expect(normaliseGameName("Layers of Fear (2016)")).toBe(
      normaliseGameName("Layers of Fear (2016)"),
    );
    expect(normaliseGameName("Layers of Fear (2016)")).not.toBe(
      normaliseGameName("Layers of Fear 2"),
    );
  });

  it("does not conflate sequels", () => {
    expect(normaliseGameName("Portal")).not.toBe(normaliseGameName("Portal 2"));
    expect(normaliseGameName("BioShock")).not.toBe(
      normaliseGameName("BioShock 2"),
    );
    expect(normaliseGameName("Sid Meier's Civilization V")).not.toBe(
      normaliseGameName("Sid Meier's Civilization VI"),
    );
  });

  it("does not match 'redux' inside another word", () => {
    expect(normaliseGameName("Reduxian Adventures")).toBe(
      "reduxian adventures",
    );
  });
});
