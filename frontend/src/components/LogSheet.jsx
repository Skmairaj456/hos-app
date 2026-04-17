const DUTY_COLORS = {
  driving: '#2563eb',
  rest: '#6b7280',
  break: '#f59e0b',
  pickup: '#10b981',
  dropoff: '#ef4444',
  fuel_stop: '#f97316',
  cycle_reset: '#7c3aed',
  off: '#e5e7eb',
}

const DUTY_ROW = {
  driving: 2,
  rest: 1,
  break: 3,
  pickup: 3,
  dropoff: 3,
  fuel_stop: 3,
  cycle_reset: 3,
}

const ROW_LABELS = ['1. Off Duty', '2. Sleeper Berth', '3. Driving', '4. On Duty (Not Driving)']

function buildRows(timeline) {
  const rows = [[], [], [], []]

  for (const seg of timeline) {
    const start = seg.start_hour !== undefined ? seg.start_hour : 0
    const dur = seg.duration_hours
    const rowIdx = DUTY_ROW[seg.type]
    if (rowIdx !== undefined) {
      rows[rowIdx].push({
        start,
        duration: dur,
        label: seg.label,
        color: DUTY_COLORS[seg.type],
      })
    }
  }

  // Off-duty = gaps in the 24h timeline
  let pos = 0
  for (const seg of timeline) {
    const start = seg.start_hour !== undefined ? seg.start_hour : pos
    if (start > pos + 0.01) {
      rows[0].push({ start: pos, duration: start - pos, label: 'Off Duty', color: DUTY_COLORS.off })
    }
    pos = start + seg.duration_hours
  }
  if (pos < 24 - 0.01) {
    rows[0].push({ start: pos, duration: 24 - pos, label: 'Off Duty', color: DUTY_COLORS.off })
  }

  return rows
}

function DutyGrid({ timeline }) {
  const rows = buildRows(timeline)
  const hourTicks = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div className="log-grid">
      <div className="log-grid-ticks">
        {hourTicks.map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
            {h === 0 ? 'M' : h === 12 ? 'N' : h === 24 ? 'M' : h}
          </span>
        ))}
      </div>
      <div className="log-grid-lines">
        {hourTicks.map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }} />
        ))}
      </div>
      {rows.map((blocks, rowIdx) => (
        <div key={rowIdx} className="log-grid-row">
          <div className="log-grid-row-label">{ROW_LABELS[rowIdx]}</div>
          <div className="log-grid-row-track">
            {blocks.map((b, i) => (
              <div
                key={i}
                className="log-grid-block"
                  title={`${b.label} - ${b.duration.toFixed(2)}h`}
                style={{
                  left: `${(b.start / 24) * 100}%`,
                  width: `${(b.duration / 24) * 100}%`,
                  background: b.color,
                  opacity: b.color === DUTY_COLORS.off ? 0.2 : 0.88,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function summarizeDay(timeline) {
  let driving = 0, sleeper = 0, onduty = 0
  for (const seg of timeline) {
    if (seg.type === 'driving') driving += seg.duration_hours
    else if (seg.type === 'rest') sleeper += seg.duration_hours
    else if (['break', 'pickup', 'dropoff', 'fuel_stop', 'cycle_reset'].includes(seg.type)) onduty += seg.duration_hours
  }
  const total = driving + sleeper + onduty
  const off = Math.max(0, 24 - total)
  return { driving, sleeper, onduty, off, total }
}

export default function LogSheet({ schedule, trip, plan }) {
  if (!schedule || schedule.length === 0) return null

  return (
    <section className="log-sheet-panel">
      <div className="panel-header">
        <h2>Driver Daily Log Sheets</h2>
        <p>One sheet per day with blocks positioned on the 24-hour grid.</p>
      </div>

      <div className="log-sheet-grid">
        {schedule.map((day) => {
          const totals = summarizeDay(day.timeline)

          return (
            <article key={day.day} className="log-sheet-card">
              <div className="log-sheet-head">
                <div>
                  <h3>Driver&apos;s Daily Log &mdash; Day {day.day}</h3>
                  <span className="log-sheet-head-note">(24-Hour Period)</span>
                </div>
                <div className="log-sheet-date-grid">
                  <div className="date-field"><label>Month</label><span>-</span></div>
                  <div className="date-field"><label>Day</label><span>{day.day}</span></div>
                  <div className="date-field"><label>Year</label><span>-</span></div>
                </div>
              </div>

              <div className="log-sheet-field-grid">
                <div className="log-sheet-field wide-field">
                  <label>From</label>
                  <span>{trip?.current_location || '-'}</span>
                </div>
                <div className="log-sheet-field wide-field">
                  <label>To</label>
                  <span>{trip?.dropoff_location || '-'}</span>
                </div>
                <div className="log-sheet-field">
                  <label>Total Miles Driving Today</label>
                  <span>{day.distance_driven.toFixed(0)} mi</span>
                </div>
                <div className="log-sheet-field">
                  <label>Name of Carrier</label>
                  <span>Route Planner Co.</span>
                </div>
              </div>

              <DutyGrid timeline={day.timeline} />

              <div className="log-sheet-summary-grid">
                <div className="summary-item"><strong>Off Duty</strong><span>{totals.off.toFixed(2)}h</span></div>
                <div className="summary-item"><strong>Sleeper Berth</strong><span>{totals.sleeper.toFixed(2)}h</span></div>
                <div className="summary-item"><strong>Driving</strong><span>{totals.driving.toFixed(2)}h</span></div>
                <div className="summary-item"><strong>On Duty (Not Driving)</strong><span>{totals.onduty.toFixed(2)}h</span></div>
                <div className="summary-item"><strong>Total Hours</strong><span>{totals.total.toFixed(2)}h</span></div>
                <div className="summary-item"><strong>Fuel Stops</strong><span>{day.fuel_stops}</span></div>
              </div>

              <div className="log-legend">
                {Object.entries(DUTY_COLORS).filter(([k]) => k !== 'off').map(([type, color]) => (
                  <span key={type} className="legend-item">
                    <span className="legend-swatch" style={{ background: color }} />
                    {type.replace('_', ' ')}
                  </span>
                ))}
              </div>

              <div className="log-sheet-info-row">
                <div className="log-sheet-remarks">
                  <h4>Remarks</h4>
                  <p>{day.comment || 'Time standard of home terminal.'}</p>
                </div>
                <div className="log-sheet-docs">
                  <h4>70-Hr / 8-Day Recap</h4>
                  <p>Available: {(70 - (plan?.initial_cycle_hours_used || 0)).toFixed(1)}h</p>
                  <p>34-Hr Reset: {day.timeline.some((s) => s.type === 'cycle_reset') ? 'Scheduled' : 'Not scheduled'}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
