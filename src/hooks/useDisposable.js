import { useEffect, useMemo } from 'react'

export function useDisposable(factory, deps) {
  const resource = useMemo(() => factory(), deps)
  useEffect(() => () => {
    // geometry/material/texture — anything with dispose()
    resource?.dispose?.()
  }, [resource])
  return resource
}