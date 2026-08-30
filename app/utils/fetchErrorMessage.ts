import type { FetchError } from "ofetch";

// Nitro's createError puts the useful text in the response body, which ofetch
// exposes as `data`; the FetchError's own message is just the status line.
export default function fetchErrorMessage(error: Error): string {
  return (error as FetchError).data?.message ?? error.message;
}
