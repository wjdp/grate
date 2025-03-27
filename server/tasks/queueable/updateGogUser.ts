import { updateGogUser } from "~/lib/gog/service";

export default async () => {
  await updateGogUser();
};
