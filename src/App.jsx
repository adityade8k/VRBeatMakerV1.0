// App.jsx
import { useState, useEffect } from 'react'
import SceneCanvas from './components/sceneCanvas/index.jsx'
import { store } from './components/xr/xrStore.js'

export default function App() {
  const [saveFn, setSaveFn] = useState(null)

  // optional: show a tiny toast after copying
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(t)
  }, [copied])

  const handleSaveClick = async () => {
    if (!saveFn) return
    const url = saveFn() // pushes the state into the URL and returns the full href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // ignore clipboard errors silently
    }
  }

  return (
    <>
      <SceneCanvas store={store} onExposeSave={setSaveFn} />

      {/* Simple overlay button */}
      <div style={{
        position: 'fixed', right: 12, bottom: 12, display: 'flex', gap: 8,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
      }}>
        <button
          onClick={handleSaveClick}
          style={{
            background: '#111827', color: '#e5e7eb', border: '1px solid #374151',
            borderRadius: 8, padding: '10px 14px', cursor: 'pointer'
          }}
          title="Save composition into the URL and copy the link"
        >
          Save Link
        </button>
        {copied && (
          <span style={{
            alignSelf: 'center', background:'#065f46', color:'#ecfdf5',
            borderRadius: 6, padding:'6px 10px', fontSize:12
          }}>
            Link copied
          </span>
        )}
      </div>
    </>
  )
}
