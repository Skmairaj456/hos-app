import { useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import LogSheet from './LogSheet'

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

function formatHours(hours) {
  return `${hours.toFixed(2)}h`
}

export default function ResultsPage({ result, error }) {
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    if (!result) return

    const mapContainer = document.getElementById('route-map')
    if (!mapContainer) return

    const map = L.map(mapContainer).setView([37.0902, -95.7129], 4)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    const geocode = async (address) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      )
      const data = await response.json()
      return data?.[0] ? [Number(data[0].lat), Number(data[0].lon)] : null
    }

    const loadRoute = async () => {
      try {
        const pickupCoord = await geocode(result.trip.pickup_location)
        const dropoffCoord = await geocode(result.trip.dropoff_location)
        if (!pickupCoord || !dropoffCoord) {
          setMapError('Unable to geocode pickup or dropoff address for mapping.')
          return
        }

        const pickupMarker = L.marker(pickupCoord).addTo(map)
        pickupMarker.bindPopup(`Pickup: ${result.trip.pickup_location}`)
        const dropoffMarker = L.marker(dropoffCoord).addTo(map)
        dropoffMarker.bindPopup(`Dropoff: ${result.trip.dropoff_location}`)

        const routeResponse = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupCoord[1]},${pickupCoord[0]};${dropoffCoord[1]},${dropoffCoord[0]}?overview=full&geometries=geojson`,
        )
        const routeData = await routeResponse.json()
        const route = routeData.routes?.[0]
        if (!route) {
          setMapError('Unable to fetch route geometry from OSRM.')
          return
        }

        L.geoJSON(route.geometry, {
          style: { color: '#2563eb', weight: 5, opacity: 0.8 },
        }).addTo(map)

        const bounds = L.geoJSON(route.geometry).getBounds()
        map.fitBounds(bounds, { padding: [40, 40] })
      } catch (err) {
        setMapError('Map loading failed: ' + err.message)
      }
    }

    loadRoute()
    return () => map.remove()
  }, [result])

  if (error) {
    return (
      <section className="panel panel-results">
        <h2>Result Error</h2>
        <div className="error-card">{error}</div>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="panel panel-results">
        <h2>Results</h2>
        <p>Complete the form to calculate a compliant trip schedule.</p>
      </section>
    )
  }

  return (
    <section className="panel panel-results">
      <div className="results-header">
        <div>
          <h2>Trip Summary</h2>
          <p>
            {result.trip.current_location} → {result.trip.pickup_location} → {result.trip.dropoff_location}
          </p>
        </div>
        <div className="summary-badges">
          <span>Distance: {result.trip.distance_miles} mi</span>
          <span>Cycle Remaining: {result.plan.remaining_cycle_hours}h</span>
          <span>Total Days: {result.plan.total_days}</span>
        </div>
      </div>

      <div id="route-map" className="route-map" />
      {mapError && <div className="form-error">{mapError}</div>}

      <div className="route-summary-cards">
        <div className="route-summary-card">
          <strong>Fuel stops</strong>
          <span>{result.plan.schedule.reduce((sum, day) => sum + day.fuel_stops, 0)}</span>
        </div>
        <div className="route-summary-card">
          <strong>Cycle reset used</strong>
          <span>{result.plan.cycle_reset_applied ? 'Yes' : 'No'}</span>
        </div>
      </div>

      <LogSheet schedule={result.plan.schedule} trip={result.trip} plan={result.plan} />

      {result.plan.notes.length > 0 && (
        <div className="notes-panel">
          <h3>Planner Notes</h3>
          <ul>
            {result.plan.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
