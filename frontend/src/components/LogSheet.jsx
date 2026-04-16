const dutyClassMap = {
  driving: 'block-driving',
  rest: 'block-sleeper',
  break: 'block-onduty',
  pickup: 'block-onduty',
  dropoff: 'block-onduty',
  fuel_stop: 'block-onduty',
  cycle_reset: 'block-onduty',
  off: 'block-offduty',
}

function buildRowBlocks(timeline, rowType) {
  if (rowType === 'off') {
    return []
  }

  return timeline
    .filter((segment) => {
      if (rowType === 'driving') return segment.type === 'driving'
      if (rowType === 'sleeper') return segment.type === 'rest'
      if (rowType === 'onduty') return ['break', 'pickup', 'dropoff', 'fuel_stop', 'cycle_reset'].includes(segment.type)
      return false
    })
    .map((segment, index) => ({
      key: `${rowType}-${index}`,
      duration: segment.duration_hours,
      label: segment.label,
      className: dutyClassMap[segment.type] || 'block-offduty',
    }))
}

function summarizeDay(day) {
  const summary = {
    driving: 0,
    sleeper: 0,
    onduty: 0,
  }

  day.timeline.forEach((segment) => {
    if (segment.type === 'driving') summary.driving += segment.duration_hours
    else if (segment.type === 'rest') summary.sleeper += segment.duration_hours
    else summary.onduty += segment.duration_hours
  })

  const totalUsed = summary.driving + summary.sleeper + summary.onduty
  summary.off = Math.max(0, 24 - totalUsed)
  return summary
}

export default function LogSheet({ schedule, trip, plan }) {
  const carrierName = 'Route Planner Co.'
  const officeAddr = 'Not Provided'
  const truckInfo = 'Not Provided'
  const terminalAddr = 'Not Provided'

  return (
    <section className="log-sheet-panel">
      <div className="panel-header">
        <div>
          <h2>Driver Daily Log</h2>
          <p>Rendered as a paper-style log sheet for each planned day.</p>
        </div>
      </div>

      <div className="log-sheet-grid">
        {schedule.map((day) => {
          const totals = summarizeDay(day)
          const totalDistance = day.distance_driven.toFixed(0)
          const dayLabel = `Day ${day.day}`
          const dutyRows = [
            {
              label: '1. Off Duty',
              blocks: totals.off ? [{ key: 'off', duration: totals.off, label: 'Off Duty', className: dutyClassMap.off }] : [],
            },
            {
              label: '2. Sleeper Berth',
              blocks: buildRowBlocks(day.timeline, 'sleeper'),
            },
            {
              label: '3. Driving',
              blocks: buildRowBlocks(day.timeline, 'driving'),
            },
            {
              label: '4. On Duty (not driving)',
              blocks: buildRowBlocks(day.timeline, 'onduty'),
            },
          ]

          return (
            <article key={day.day} className="log-sheet-card">
              <div className="log-sheet-head">
                <div>
                  <h3>Drivers Daily Log</h3>
                  <span className="log-sheet-head-note">(24 hours)</span>
                </div>
                <div className="log-sheet-date-grid">
                  <div className="date-field">
                    <label>month</label>
                    <span />
                  </div>
                  <div className="date-field">
                    <label>day</label>
                    <span />
                  </div>
                  <div className="date-field">
                    <label>year</label>
                    <span />
                  </div>
                </div>
              </div>

              <div className="log-sheet-field-grid">
                <div className="log-sheet-field wide-field">
                  <label>From</label>
                  <span>{trip?.current_location || 'Home Terminal'}</span>
                </div>
                <div className="log-sheet-field wide-field">
                  <label>To</label>
                  <span>{trip?.dropoff_location || 'Destination'}</span>
                </div>
                <div className="log-sheet-field">
                  <label>Total Miles Driving Today</label>
                  <span>{totalDistance} mi</span>
                </div>
                <div className="log-sheet-field">
                  <label>Total Mileage Today</label>
                  <span>{totalDistance} mi</span>
                </div>
                <div className="log-sheet-field">
                  <label>Name of Carrier or Carriers</label>
                  <span>{carrierName}</span>
                </div>
                <div className="log-sheet-field">
                  <label>Main Office Address</label>
                  <span>{officeAddr}</span>
                </div>
                <div className="log-sheet-field">
                  <label>Truck/Tractor and Trailer Numbers or License Plates</label>
                  <span>{truckInfo}</span>
                </div>
                <div className="log-sheet-field">
                  <label>Home Terminal Address</label>
                  <span>{terminalAddr}</span>
                </div>
              </div>

              <div className="log-sheet-chart">
                <div className="chart-time-labels">
                  {Array.from({ length: 24 }, (_, i) => (
                    <span key={i}>{i === 0 ? 'Mid' : i === 12 ? 'Noon' : i}</span>
                  ))}
                </div>
                <div className="chart-duty-blocks">
                  {dutyRows.map((row) => (
                    <div key={row.label} className="chart-row">
                      <div className="chart-row-label">{row.label}</div>
                      <div className="chart-row-bar">
                        {row.blocks.length > 0 ? (
                          row.blocks.map((block) => (
                            <span
                              key={block.key}
                              className={`duty-block ${block.className}`}
                              style={{ width: `${(block.duration / 24) * 100}%` }}
                            >
                              {block.duration.toFixed(1)}
                            </span>
                          ))
                        ) : (
                          <span className="duty-block block-empty">0.0h</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="log-sheet-summary-grid">
                <div className="summary-item">
                  <strong>{dayLabel}</strong>
                  <span>{`${day.distance_driven.toFixed(0)} mi`}</span>
                </div>
                <div className="summary-item">
                  <strong>On Duty</strong>
                  <span>{day.on_duty_hours.toFixed(1)}h</span>
                </div>
                <div className="summary-item">
                  <strong>Driving</strong>
                  <span>{totals.driving.toFixed(1)}h</span>
                </div>
                <div className="summary-item">
                  <strong>Sleeper</strong>
                  <span>{totals.sleeper.toFixed(1)}h</span>
                </div>
                <div className="summary-item">
                  <strong>Rest / Off</strong>
                  <span>{totals.off.toFixed(1)}h</span>
                </div>
                <div className="summary-item">
                  <strong>Fuel Stops</strong>
                  <span>{day.fuel_stops}</span>
                </div>
              </div>

              <div className="log-sheet-info-row">
                <div className="log-sheet-remarks">
                  <h4>Remarks</h4>
                  <p>{day.comment || 'Use time standard of home terminal.'}</p>
                </div>
                <div className="log-sheet-docs">
                  <h4>Shipping Documents</h4>
                  <p>DVIR or manifest number, shipper, commodity, and place of report/release.</p>
                </div>
              </div>

              <div className="log-sheet-recap">
                <div className="recap-card">
                  <strong>70 Hour / 8 Days</strong>
                  <span>{(70 - (plan?.initial_cycle_hours_used || 0)).toFixed(1)}h available</span>
                </div>
                <div className="recap-card">
                  <strong>60 Hour / 7 Days</strong>
                  <span>{(60 - (plan?.initial_cycle_hours_used || 0)).toFixed(1)}h available</span>
                </div>
                <div className="recap-card">
                  <strong>34 Hour Reset</strong>
                  <span>{day.timeline.some((seg) => seg.type === 'cycle_reset') ? 'Scheduled' : 'Not scheduled'}</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
