export const useGame = (id: number) => {
  const { $client } = useNuxtApp();
  return useAsyncData("game", async () => $client.game.query({ id }));
};
