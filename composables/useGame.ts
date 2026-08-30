export const useGame = (id: number) => {
  const { $client } = useNuxtApp();
  return useAsyncData(`game-${id}`, async () => $client.game.query({ id }));
};
