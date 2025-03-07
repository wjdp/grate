export function parseIntRouteParam(param: string | string[]): number {
  const parsed = parseInt(Array.isArray(param) ? param[0] : param, 10);
  if (isNaN(parsed)) {
    throw new Error("Invalid route parameter");
  }
  return parsed;
}
