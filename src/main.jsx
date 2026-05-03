import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import GeoGuard from './components/GeoGuard'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GeoGuard>
      <App />
    </GeoGuard>
  </React.StrictMode>
)
