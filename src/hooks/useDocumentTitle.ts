import { useEffect } from 'react'

/** Set `document.title` for the current page (restored on unmount). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
