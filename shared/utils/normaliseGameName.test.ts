import { describe, expect, it } from "vitest";
import { isPackagingVariant, normaliseGameName } from "./normaliseGameName";

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

describe("normaliseGameName edition and packaging vocabulary", () => {
  it.each([
    ["Control Ultimate Edition", "Control"],
    ["Disco Elysium - The Final Cut", "Disco Elysium"],
    ["Company of Heroes - Legacy Edition", "Company of Heroes "],
    ["Styx: Shards of Darkness - Deluxe Edition", "Styx: Shards of Darkness"],
    ["Saints Row IV Re-Elected", "Saints Row IV"],
    ["Rise of the Tomb Raider: 20 Year Celebration", "Rise of the Tomb Raider"],
    ["Mafia II (Classic)", "Mafia II: Definitive Edition"],
    ["The Stanley Parable: Ultra Deluxe", "The Stanley Parable"],
    ["We Happy Few - Soundtrack and Digital Goods Bundle", "We Happy Few"],
    ["Mass Effect™ Legendary Edition", "Mass Effect"],
    ["Kingdom: Classic", "Kingdom"],
  ])("keys %s as %s", (variant, plain) => {
    expect(normaliseGameName(variant)).toBe(normaliseGameName(plain));
  });

  it("strips a leading 'the' along with \"director's cut\"", () => {
    expect(normaliseGameName("Lone Survivor: The Director's Cut")).toBe(
      "lone survivor",
    );
  });

  it("keeps the base title when the edition follows a subtitle", () => {
    expect(normaliseGameName("Metro: Last Light Complete Edition")).toBe(
      "metro last light",
    );
  });
});

describe("normaliseGameName test builds", () => {
  it.each([
    ["DEFCON Beta Demo", "DEFCON"],
    ["The Stanley Parable Demo", "The Stanley Parable"],
    ["Fallout 76 Public Test Server", "Fallout 76"],
    ["The Last Starship Playtest", "The Last Starship"],
    ["Eriksholm: The Stolen Dream Demo", "Eriksholm: The Stolen Dream"],
    ["Mortal Shell Tech Beta", "Mortal Shell"],
    ["PlanetSide 2 - Test", "PlanetSide 2"],
    ["Rust - Staging Branch", "Rust"],
    ["Chivalry 2 - Public Testing", "Chivalry 2"],
    ["Galactic Civilizations III (Test branch)", "Galactic Civilizations III"],
    [
      "The Dark Pictures Anthology: Little Hope - Friend's Pass",
      "The Dark Pictures Anthology: Little Hope",
    ],
  ])("keys %s as %s", (build, retail) => {
    expect(normaliseGameName(build)).toBe(normaliseGameName(retail));
  });
});

describe("normaliseGameName words that only look like packaging", () => {
  it.each([
    ["The Turing Test", "the turing test"],
    ["Team Fortress Classic", "team fortress classic"],
    ["Train Simulator Classic", "train simulator classic"],
    ["Wasteland 1 - The Original Classic", "wasteland 1 the original classic"],
    ["Hexcells Plus", "hexcells plus"],
    ["Hexcells Infinite", "hexcells infinite"],
    ["SUPERHOT VR", "superhot vr"],
    ["Fallout 4 VR", "fallout 4 vr"],
    ["Layers of Fear (2016)", "layers of fear (2016)"],
    ["There is no game: Jam Edition 2015", "there is no game jam edition 2015"],
    ["Bad North: Jotunn Edition", "bad north jotunn edition"],
  ])("keys %s as %s", (name, key) => {
    expect(normaliseGameName(name)).toBe(key);
  });

  it("keeps Team Fortress Classic apart from Team Fortress 2", () => {
    expect(normaliseGameName("Team Fortress Classic")).not.toBe(
      normaliseGameName("Team Fortress 2"),
    );
  });

  it.each([
    ["Portal", "Portal 2"],
    ["Fallout", "Fallout 2"],
    ["Fallout 2", "Fallout 3"],
    ["Fallout 4", "Fallout 76"],
    ["Sid Meier's Civilization V", "Sid Meier's Civilization VI"],
    ["BioShock", "BioShock 2"],
    ["Half-Life", "Half-Life 2"],
  ])("keys %s apart from %s", (first, second) => {
    expect(normaliseGameName(first)).not.toBe(normaliseGameName(second));
  });
});

describe("isPackagingVariant", () => {
  const areVariants = (first: string, second: string) =>
    isPackagingVariant(
      { name: first, key: normaliseGameName(first) },
      { name: second, key: normaliseGameName(second) },
    );

  it.each([
    ["The Outer Worlds", "The Outer Worlds: Spacer's Choice Edition"],
    ["Portal", "Portal with RTX"],
    ["Wreckfest", "Wreckfest Throw-A-Santa + Sneak Peek 2.0"],
    ["Fallout", "Fallout: A Post Nuclear Role Playing Game"],
    ["The Walking Dead", "The Walking Dead: Season One"],
  ])("accepts %s and %s", (plain, variant) => {
    expect(areVariants(plain, variant)).toBe(true);
    expect(areVariants(variant, plain)).toBe(true);
  });

  it.each([
    ["Portal", "Portal 2"],
    ["Tomb Raider", "Tomb Raider I-III Remastered Starring Lara Croft"],
    ["Half-Life", "Half-Life: Opposing Force"],
    ["Subnautica", "Subnautica: Below Zero"],
    ["Mirror's Edge", "Mirror's Edge™ Catalyst"],
    ["Prey", "Prey: Typhon Hunter"],
    ["Elite Dangerous", "Elite Dangerous: Arena"],
    ["SUPERHOT", "SUPERHOT VR"],
    ["Hexcells", "Hexcells Plus"],
    ["The Talos Principle", "The Talos Principle 2"],
    ["Telltale Batman Season 1", "Telltale Batman Season 2"],
    ["Battlefield™ 1", "Battlefield™ V"],
    ["Train Sim World® 2", "Train Sim World® 3"],
  ])("rejects %s and %s", (first, second) => {
    expect(areVariants(first, second)).toBe(false);
    expect(areVariants(second, first)).toBe(false);
  });
});
