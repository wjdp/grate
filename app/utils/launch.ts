// Provider protocol URLs (steam://, goggalaxy://) hand off to a desktop app and
// leave the page in place; a store page would otherwise replace grate.
export function openLaunchUrl(url: string) {
  window.open(url, url.startsWith("http") ? "_blank" : "_self");
}
