import { useState } from 'react'
import { createXRStore } from '@react-three/xr'
import SceneCanvas from './components/SceneCanavs.jsx'

const store = createXRStore()

export default function App() {
  const [red, setRed] = useState(false)

  const modelPaths = [
    '/models/button.glb',
    '/models/dial.glb',
    '/models/roller.glb',
    '/models/switch.glb',
  ]

  return (
    <>
      <div style={{ position: 'fixed', zIndex: 10, padding: 12 }}>
        <button onClick={() => store.enterVR()}>Enter VR</button>
      </div>
      <SceneCanvas store={store} paths={modelPaths} red={red} onToggleRed={() => setRed((v) => !v)} />
    </>
  )
}
