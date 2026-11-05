import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './fan.css'
import './wireStamps'
import { FanApp } from './FanApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FanApp />
  </StrictMode>,
)
