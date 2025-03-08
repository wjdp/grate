export const useGames = () => {
  const { $client } = useNuxtApp();
  return useAsyncData("games", () => $client.games.query());
};
