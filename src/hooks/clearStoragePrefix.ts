/** Remove every localStorage key that starts with `prefix`. */
export function clearStoragePrefix(prefix: string): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) toRemove.push(key)
  }
  for (const key of toRemove) localStorage.removeItem(key)
}
