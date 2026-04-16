import { useState } from 'react'
import TripForm from './components/TripForm'
import ResultsPage from './components/ResultsPage'
import './App.css'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Truck Driver Route Planner</h1>
          <p>Build a compliant driving schedule with daily HOS segments and cycle tracking.</p>
        </div>
      </header>
      <main className="app-main">
        <TripForm
          onSubmit={async (payload) => {
            setError('')
            setLoading(true)
            setResult(null)
            try {
              const response = await fetch(`${API_BASE}/api/plan-trip/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              const data = await response.json()
              if (!response.ok) {
                throw new Error(data.error || JSON.stringify(data.errors || data))
              }
              setResult(data)
            } catch (err) {
              setError(err.message)
            } finally {
              setLoading(false)
            }
          }}
          loading={loading}
        />
        <ResultsPage result={result} error={error} />
      </main>
    </div>
  )
}

export default App
