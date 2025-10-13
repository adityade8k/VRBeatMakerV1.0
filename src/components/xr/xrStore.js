// xr/xrStore.js
import { createXRStore } from '@react-three/xr'
import { CustomHand } from './CustomHand.jsx'

// One store app-wide. Both hands will use CustomHand.
export const store = createXRStore({
  hand: CustomHand,
})
