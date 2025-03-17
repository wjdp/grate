// The default title of the application, also set in nuxt.config.ts as that
// cannot import from this file.
export const HEAD_TITLE = "grate";

export function getPageTitle(pageTitle: string | string[]): string {
  if (Array.isArray(pageTitle)) {
    const titleJoined = pageTitle.join(" › ");
    return `${titleJoined} › ${HEAD_TITLE}`;
  }
  return `${pageTitle} › ${HEAD_TITLE}`;
}
