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
  const [currentLocWarning, setCurrentLocWarning] = useState('')

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
        const [pickupCoord, dropoffCoord] = await Promise.all([
          geocode(result.trip.pickup_location),
          geocode(result.trip.dropoff_location),
        ])

        if (!pickupCoord || !dropoffCoord) {
          setMapError('Unable to geocode pickup or dropoff address for mapping.')
          return
        }

        // Try to show current location marker — geocode first, fall back to browser GPS
        const makeIcon = (color) =>
          L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })

        let currentCoord = await geocode(result.trip.current_location).catch(() => null)

        if (!currentCoord) {
          // Try browser geolocation as fallback
          currentCoord = await new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null)
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
              () => resolve(null),
              { timeout: 5000 },
            )
          })
          if (currentCoord) {
            setCurrentLocWarning(`Could not find "${result.trip.current_location}" on map — showing your device's GPS location instead.`)
          } else {
            setCurrentLocWarning(`Could not resolve current location "${result.trip.current_location}" — try entering a city name or address.`)
          }
        } else {
          setCurrentLocWarning('')
        }

        if (currentCoord) {
          L.marker(currentCoord, { icon: makeIcon('#06b6d4') })
            .addTo(map)
            .bindPopup(`<strong>Current Location</strong><br>${result.trip.current_location}`)
        }

        L.marker(pickupCoord, { icon: makeIcon('#10b981') })
          .addTo(map)
          .bindPopup(`<strong>Pickup</strong><br>${result.trip.pickup_location}`)
        L.marker(dropoffCoord, { icon: makeIcon('#ef4444') })
          .addTo(map)
          .bindPopup(`<strong>Dropoff</strong><br>${result.trip.dropoff_location}`)

        // Route is ONLY pickup → dropoff (current location does not affect the route line)
        const coordStr = `${pickupCoord[1]},${pickupCoord[0]};${dropoffCoord[1]},${dropoffCoord[0]}`
        const routeResponse = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
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

        // Add rest/fuel stop markers along the route geometry proportionally
        const coords = route.geometry.coordinates // [lng, lat]
        const totalCoords = coords.length
        let mileAccum = 0

        result.plan.schedule.forEach((day) => {
          day.timeline.forEach((seg) => {
            if (seg.type === 'rest' || seg.type === 'fuel_stop') {
              const fraction = Math.min(mileAccum / result.trip.distance_miles, 1)
              const coordIdx = Math.round(fraction * (totalCoords - 1))
              const [lng, lat] = coords[coordIdx]
              const icon = seg.type === 'fuel_stop' ? makeIcon('#f97316') : makeIcon('#6b7280')
              const label = seg.type === 'fuel_stop' ? 'Fuel Stop' : 'Rest Stop'
              L.marker([lat, lng], { icon })
                .addTo(map)
                .bindPopup(`<strong>${label}</strong><br>${seg.duration_hours}h`)
            }
            if (seg.type === 'driving') {
              mileAccum += seg.duration_hours * 50
            }
          })
        })

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
      {currentLocWarning && <div className="current-loc-warning">{currentLocWarning}</div>}

      <div className="map-legend">
        <span className="map-legend-title">Map Legend</span>
        {[
          { color: '#06b6d4', label: 'Current Location' },
          { color: '#10b981', label: 'Pickup' },
          { color: '#ef4444', label: 'Dropoff' },
          { color: '#6b7280', label: 'Rest Stop' },
          { color: '#f97316', label: 'Fuel Stop' },
          { color: '#2563eb', label: 'Route', line: true },
        ].map(({ color, label, line }) => (
          <span key={label} className="map-legend-item">
            {line ? (
              <span className="map-legend-line" style={{ background: color }} />
            ) : (
              <span className="map-legend-dot" style={{ background: color }} />
            )}
            {label}
          </span>
        ))}
      </div>

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
