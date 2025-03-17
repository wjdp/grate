import type { GameWithSteam } from "./types/Game";

export interface ArtUrls {
  header: string;
  poster: string;
  posterSmall: string;
  background: string;
}

const ART_URL_BASE_PATH = "/art/steam";

export function getGameArtUrls(game: GameWithSteam): ArtUrls | null {
  if (!game.steamGame) {
    return null;
  }
  const { steamGame } = game;
  return {
    header: `${ART_URL_BASE_PATH}/${steamGame.appId}/header`,
    poster: `${ART_URL_BASE_PATH}/${steamGame.appId}/poster`,
    posterSmall: `${ART_URL_BASE_PATH}/${steamGame.appId}/posterSmall`,
    background: `${ART_URL_BASE_PATH}/${steamGame.appId}/backgroundV6B`,
  };
}
