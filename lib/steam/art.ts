const BASE_URL = "https://steamcdn-a.akamaihd.net/steam/apps";

export interface SteamArtUrls {
  logo: string;
  header: string;
  hero: string;
  posterSmall: string;
  poster: string;
  background: string;
  backgroundV6B: string;
}

export function getSteamArtUrls(appId: number): SteamArtUrls {
  return {
    logo: `${BASE_URL}/${appId}/logo.png`,
    header: `${BASE_URL}/${appId}/header.jpg`,
    hero: `${BASE_URL}/${appId}/library_hero.jpg`,
    posterSmall: `${BASE_URL}/${appId}/library_600x900.jpg`,
    poster: `${BASE_URL}/${appId}/library_600x900_2x.jpg`,
    background: `${BASE_URL}/${appId}/page_bg_generated.jpg`,
    backgroundV6B: `${BASE_URL}/${appId}/page_bg_generated_v6b.jpg`,
  };
}
