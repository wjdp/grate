export function areBackgroundJobsEnabled(): boolean {
  return (process.env.BACKGROUND_JOBS_ENABLED ?? "true") === "true";
}
