/** Keys we sync between localStorage and the signed-in cloud blob. */
export const APP_DATA_KEY_PREFIX = 'gc:'

export type AppDataBlob = Record<string, unknown>

export const collectLocalAppData = (): AppDataBlob => {
  const data: AppDataBlob = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key?.startsWith(APP_DATA_KEY_PREFIX)) continue
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      data[key] = JSON.parse(raw)
    } catch {
      // Skip unreadable keys
    }
  }
  return data
}

export const writeLocalAppData = (data: AppDataBlob) => {
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(APP_DATA_KEY_PREFIX)) continue
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore quota / private-mode failures.
    }
  }
}

export const clearLocalAppData = () => {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(APP_DATA_KEY_PREFIX)) toRemove.push(key)
  }
  for (const key of toRemove) localStorage.removeItem(key)
}

export const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeLocalJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota / private-mode failures.
  }
}
