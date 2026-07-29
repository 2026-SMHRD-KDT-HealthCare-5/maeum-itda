import { API_BASE_URL } from '../config'

// Thin fetch wrapper — every REST call should go through this, not a raw
// fetch() scattered across features, so auth headers/error handling only
// need to land in one place once apps/backend exists.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`)
  }
  return response.json() as Promise<T>
}
