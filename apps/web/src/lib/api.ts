export const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ??
  "https://genvora-api.anirbanghosh060.workers.dev";

export function apiPath(path: string) {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
