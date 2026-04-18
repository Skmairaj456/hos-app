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

function haversineMiles([lat1, lon1], [lat2, lon2]) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
      const query = (address || '').trim()
      if (!query) return null

      const candidates = [query]
      if (!/\b(usa|united states|us)\b/i.test(query)) {
        candidates.push(`${query}, USA`)
      }

      const tryNominatim = async (q) => {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`,
        )
        if (!response.ok) return null
        const data = await response.json()
        return data?.[0] ? [Number(data[0].lat), Number(data[0].lon)] : null
      }

      const tryPhoton = async (q) => {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`)
        if (!response.ok) return null
        const data = await response.json()
        const coords = data?.features?.[0]?.geometry?.coordinates
        return Array.isArray(coords) && coords.length === 2 ? [Number(coords[1]), Number(coords[0])] : null
      }

      const tryMapsCo = async (q) => {
        const response = await fetch(
          `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&api_key=&limit=1`,
        )
        if (!response.ok) return null
        const data = await response.json()
        return data?.[0] ? [Number(data[0].lat), Number(data[0].lon)] : null
      }

      for (const q of candidates) {
        const fromNominatim = await tryNominatim(q).catch(() => null)
        if (fromNominatim) return fromNominatim

        const fromPhoton = await tryPhoton(q).catch(() => null)
        if (fromPhoton) return fromPhoton

        const fromMapsCo = await tryMapsCo(q).catch(() => null)
        if (fromMapsCo) return fromMapsCo
      }

      return null
    }

    const geocodeCandidates = async (address) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&addressdetails=1`,
      )
      const data = await response.json()
      return Array.isArray(data)
        ? data
            .map((item) => ({
              lat: Number(item.lat),
              lon: Number(item.lon),
              displayName: item.display_name,
            }))
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
        : []
    }

    const loadRoute = async () => {
      try {
        setMapError('')
        setCurrentLocWarning('')

        const [pickupCoord, dropoffCoord] = await Promise.all([
          geocode(result.trip.pickup_location),
          geocode(result.trip.dropoff_location),
        ])

        if (!pickupCoord || !dropoffCoord) {
          const failed = [
            !pickupCoord ? `pickup: "${result.trip.pickup_location}"` : null,
            !dropoffCoord ? `dropoff: "${result.trip.dropoff_location}"` : null,
          ]
            .filter(Boolean)
            .join(' and ')

          setMapError(
            `Unable to geocode ${failed}. Please use fuller address text (city + state/country).`,
          )
          return
        }

        // Try to show current location marker without letting vague text map to wrong places.
        const makeIcon = (color) =>
          L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })

        const getBrowserLocation = () =>
          new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null)
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
              () => resolve(null),
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              },
            )
          })

        const rawCurrentText = (result.trip.current_location || '').trim()
        const normalizedCurrentText = rawCurrentText.toLowerCase()
        const genericInputs = new Set([
          'home',
          'my home',
          'current location',
          'current',
          'my location',
          'here',
        ])
        const shouldPreferGps = genericInputs.has(normalizedCurrentText)

        let usedGps = false
        let currentCoord = null

        // Always try browser GPS first for best accuracy.
        currentCoord = await getBrowserLocation()
        usedGps = !!currentCoord

        if (!currentCoord && rawCurrentText) {
          if (shouldPreferGps) {
            setCurrentLocWarning(
              `Could not access device GPS for "${rawCurrentText}". Showing best text match instead. Enable location permission for precise current location.`,
            )
          }

          const candidates = await geocodeCandidates(rawCurrentText).catch(() => [])
          if (candidates.length > 0) {
            const scored = candidates
              .map((candidate) => {
                const coord = [candidate.lat, candidate.lon]
                const toPickup = haversineMiles(coord, pickupCoord)
                const toDropoff = haversineMiles(coord, dropoffCoord)
                return {
                  coord,
                  displayName: candidate.displayName,
                  score: Math.min(toPickup, toDropoff),
                }
              })
              .sort((a, b) => a.score - b.score)

            currentCoord = scored[0].coord

            if (scored[0].score > 200 && !shouldPreferGps) {
              setCurrentLocWarning(
                `Current location text matched a place far from your route. For better accuracy, use a full address or enable GPS.`,
              )
            }
          }
        }

        if (!currentCoord && rawCurrentText) {
          currentCoord = await getBrowserLocation()
          usedGps = !!currentCoord
        }

        if (currentCoord && usedGps && rawCurrentText) {
          setCurrentLocWarning(
            `Using your device GPS for current location to avoid inaccurate text geocoding.`,
          )
        } else if (!currentCoord) {
          setCurrentLocWarning(
            `Could not resolve current location "${rawCurrentText}" — try a full city/state or enable location access.`,
          )
        }

        if (currentCoord) {
          L.marker(currentCoord, { icon: makeIcon('#06b6d4') })
            .addTo(map)
            .bindPopup(
              usedGps
                ? '<strong>Current Location</strong><br>Device GPS'
                : `<strong>Current Location</strong><br>${result.trip.current_location}`,
            )
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
