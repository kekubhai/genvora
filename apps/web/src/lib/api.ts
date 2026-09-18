export const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function apiPath(path: string) {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
