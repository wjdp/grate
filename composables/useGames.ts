export const useGames = (options?: {
  immediate?: boolean;
  server?: boolean;
}) => {
  const { $client } = useNuxtApp();
  return useAsyncData("games", () => $client.games.query(), options);
};
