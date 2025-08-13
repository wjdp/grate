export const useRecentGames = (limit = 6) => {
  const { $client } = useNuxtApp();
  return useAsyncData("recentGames", () =>
    $client.recentGames.query({ limit }),
  );
};
