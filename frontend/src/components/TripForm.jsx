import { useState } from 'react'

const initialState = {
  current_location: '',
  pickup_location: '',
  dropoff_location: '',
  distance_miles: '',
  cycle_hours_used: '',
}

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState(initialState)
  const [formError, setFormError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    setFormError('')

    const payload = {
      current_location: form.current_location.trim(),
      pickup_location: form.pickup_location.trim(),
      dropoff_location: form.dropoff_location.trim(),
      distance_miles: Number(form.distance_miles),
      cycle_hours_used: Number(form.cycle_hours_used),
    }

    if (!payload.current_location || !payload.pickup_location || !payload.dropoff_location) {
      setFormError('Please fill in all location fields.')
      return
    }
    if (Number.isNaN(payload.distance_miles) || payload.distance_miles <= 0) {
      setFormError('Distance must be a positive number.')
      return
    }
    if (Number.isNaN(payload.cycle_hours_used) || payload.cycle_hours_used < 0) {
      setFormError('Cycle hours used must be a non-negative number.')
      return
    }
    if (payload.cycle_hours_used > 70) {
      setFormError('Cycle hours cannot exceed 70 hours.')
      return
    }

    onSubmit(payload)
  }

  return (
    <section className="panel panel-form">
      <div>
        <h2>Plan Your Route</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
          Enter trip details to calculate HOS-compliant schedule
        </p>
      </div>
      <form onSubmit={handleSubmit} className="trip-form">
        <label>
          Current Location
          <input
            value={form.current_location}
            onChange={(event) => setForm({ ...form, current_location: event.target.value })}
            placeholder="e.g., Home Terminal, Yard A"
            type="text"
          />
        </label>

        <label>
          Pickup Location
          <input
            value={form.pickup_location}
            onChange={(event) => setForm({ ...form, pickup_location: event.target.value })}
            placeholder="e.g., Chicago, IL or 123 Main St"
            type="text"
          />
        </label>

        <label>
          Dropoff Location
          <input
            value={form.dropoff_location}
            onChange={(event) => setForm({ ...form, dropoff_location: event.target.value })}
            placeholder="e.g., St. Louis, MO or Destination Terminal"
            type="text"
          />
        </label>

        <label>
          Distance (miles)
          <input
            type="number"
            step="10"
            min="0"
            value={form.distance_miles}
            onChange={(event) => setForm({ ...form, distance_miles: event.target.value })}
            placeholder="e.g., 500"
          />
        </label>

        <label>
          Current Cycle Hours Used
          <input
            type="number"
            step="1"
            min="0"
            max="70"
            value={form.cycle_hours_used}
            onChange={(event) => setForm({ ...form, cycle_hours_used: event.target.value })}
            placeholder="Hours used in 8-day cycle (0-70)"
          />
        </label>

        {formError && <div className="form-error">{formError}</div>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? '⏳ Calculating Schedule...' : '📍 Calculate Schedule'}
        </button>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(15, 118, 110, 0.05)', borderRadius: '12px', fontSize: '0.85rem', color: '#0d6854', lineHeight: '1.6' }}>
          <strong>HOS Rules Applied:</strong>
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.5rem' }}>
            <li>70-hour / 8-day cycle limit</li>
            <li>11-hour driving limit per day</li>
            <li>14-hour on-duty work window</li>
            <li>Fuel stops every 1,000 miles</li>
            <li>1-hour pickup &amp; drop-off time</li>
          </ul>
        </div>
      </form>
    </section>
  )
}
