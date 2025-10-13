import { Suspense, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export default function GLTFModels({ paths = [] }) {
  useEffect(() => {
    paths.forEach((p) => { try { useGLTF.preload(p) } catch {} })
  }, [paths])

  return (
    <Suspense fallback={null}>
      <group>
        {paths.map((path, i) => (
          <Model key={path} url={path} index={i} total={paths.length} />
        ))}
      </group>
    </Suspense>
  )
}

function Model({ url, index, total }) {
  const gltf = useGLTF(url)
  const x = index*0.2
  const z = -0.6
  const y = 1

  return (
    <group position={[x-0.3, y, z]} rotation={[0, 0, 0]} scale = {[0.035, 0.035, 0.035]}>
      <primitive object={gltf.scene} />
    </group>
  )
}
