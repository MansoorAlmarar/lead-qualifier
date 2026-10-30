// Reads a JSON reply. Returns {} when the body is not JSON, such as an HTML error page from a proxy.
export async function readJson<T extends object>(res: Response): Promise<Partial<T>> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === "object" ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}
