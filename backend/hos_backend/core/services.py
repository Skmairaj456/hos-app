AVERAGE_SPEED_MPH = 50
MAX_DRIVING_PER_DAY = 11.0
MAX_WORK_WINDOW = 14.0
MANDATORY_BREAK_AFTER_DRIVING = 8.0
MANDATORY_BREAK_DURATION = 0.5
MIN_REST_HOURS = 10.0
CYCLE_LIMIT = 70.0
RESET_HOURS = 34.0
PICKUP_DURATION = 1.0
DROPOFF_DURATION = 1.0
FUEL_STOP_INTERVAL = 1000.0
FUEL_STOP_DURATION = 0.5


def calculate_schedule(distance, cycle_used):
    """Calculate a realistic HOS multi-day plan for a truck driver.

    Returns a dictionary with day-by-day segments, timeline blocks, and safety notes.
    """
    remaining_distance = float(distance)
    remaining_drive_hours = remaining_distance / AVERAGE_SPEED_MPH
    remaining_cycle_hours = max(0.0, CYCLE_LIMIT - float(cycle_used))
    schedule = []
    total_miles_driven = 0.0
    distance_since_fuel = 0.0
    cycle_reset_applied = False
    notes = []
    day = 1
    first_day = True

    def add_segment(record, segment):
        record['segments'].append(segment)
        record['timeline'].append(segment)
        if segment['type'] == 'driving':
            record['driving_hours'] += segment['duration_hours']
            record['on_duty_hours'] += segment['duration_hours']
        elif segment['type'] in {'pickup', 'dropoff', 'break', 'fuel_stop', 'cycle_reset'}:
            record['on_duty_hours'] += segment['duration_hours']
        elif segment['type'] == 'rest':
            record['rest_hours'] += segment['duration_hours']

    while remaining_drive_hours > 0 or (first_day and not schedule):
        if remaining_cycle_hours <= 0:
            schedule.append({
                'day': day,
                'segments': [{
                    'type': 'cycle_reset',
                    'label': '34-hour reset',
                    'duration_hours': RESET_HOURS,
                    'notes': 'Mandatory 34-hour reset to clear the 70-hour cycle.',
                }],
                'timeline': [{
                    'type': 'cycle_reset',
                    'label': '34-hour reset',
                    'duration_hours': RESET_HOURS,
                    'notes': 'Mandatory 34-hour reset to clear the 70-hour cycle.',
                }],
                'driving_hours': 0.0,
                'on_duty_hours': RESET_HOURS,
                'rest_hours': 0.0,
                'cycle_hours_used': RESET_HOURS,
                'distance_driven': 0.0,
                'fuel_stops': 0,
                'comment': 'Cycle reset day.',
            })
            day += 1
            remaining_cycle_hours = CYCLE_LIMIT
            cycle_reset_applied = True
            continue

        daily_record = {
            'day': day,
            'segments': [],
            'timeline': [],
            'driving_hours': 0.0,
            'on_duty_hours': 0.0,
            'rest_hours': 0.0,
            'cycle_hours_used': 0.0,
            'distance_driven': 0.0,
            'fuel_stops': 0,
            'comment': '',
        }

        if first_day:
            add_segment(daily_record, {
                'type': 'pickup',
                'label': 'Pickup / Preload',
                'duration_hours': PICKUP_DURATION,
                'notes': 'Pickup time before driving begins.',
            })
            remaining_cycle_hours -= PICKUP_DURATION
            total_miles_driven += 0.0
            first_day = False

        available_duty = MAX_WORK_WINDOW - daily_record['on_duty_hours']
        available_cycle = remaining_cycle_hours
        available_drive = min(
            MAX_DRIVING_PER_DAY - daily_record['driving_hours'],
            remaining_drive_hours,
            available_duty,
            available_cycle,
        )

        if available_drive <= 0:
            add_segment(daily_record, {
                'type': 'rest',
                'label': 'Rest / 10-hour reset',
                'duration_hours': MIN_REST_HOURS,
                'notes': 'Mandatory rest because driving capacity is exhausted for the day.',
            })
            daily_record['cycle_hours_used'] = 0.0
            schedule.append(daily_record)
            day += 1
            continue

        predicted_miles = available_drive * AVERAGE_SPEED_MPH
        fuel_needed = 0
        if distance_since_fuel + predicted_miles >= FUEL_STOP_INTERVAL and remaining_distance - predicted_miles > 0:
            fuel_needed = FUEL_STOP_DURATION

        needs_dropoff = remaining_drive_hours <= available_drive
        dropoff_needed = DROPOFF_DURATION if needs_dropoff else 0

        available_drive = min(
            available_drive,
            available_cycle - fuel_needed - dropoff_needed,
            available_duty - fuel_needed - dropoff_needed,
        )

        if available_drive <= 0:
            add_segment(daily_record, {
                'type': 'rest',
                'label': 'Rest / 10-hour reset',
                'duration_hours': MIN_REST_HOURS,
                'notes': 'Mandatory rest because driving capacity is exhausted before required services can be scheduled.',
            })
            daily_record['cycle_hours_used'] = 0.0
            schedule.append(daily_record)
            day += 1
            continue

        predicted_miles = available_drive * AVERAGE_SPEED_MPH
        fuel_needed = 0
        if distance_since_fuel + predicted_miles >= FUEL_STOP_INTERVAL and remaining_distance - predicted_miles > 0:
            fuel_needed = FUEL_STOP_DURATION

        remaining_drive = available_drive

        def drive_chunk(duration):
            nonlocal remaining_drive_hours, remaining_distance, total_miles_driven, distance_since_fuel, remaining_cycle_hours
            miles = duration * AVERAGE_SPEED_MPH
            add_segment(daily_record, {
                'type': 'driving',
                'label': 'Driving',
                'duration_hours': round(duration, 2),
                'notes': 'Driving segment based on remaining route distance.',
            })
            remaining_drive_hours -= duration
            remaining_distance -= miles
            total_miles_driven += miles
            distance_since_fuel += miles
            remaining_cycle_hours -= duration
            daily_record['distance_driven'] += miles

            if distance_since_fuel >= FUEL_STOP_INTERVAL and remaining_distance > 0:
                distance_since_fuel -= FUEL_STOP_INTERVAL
                add_segment(daily_record, {
                    'type': 'fuel_stop',
                    'label': 'Fuel stop',
                    'duration_hours': FUEL_STOP_DURATION,
                    'notes': 'Fuel stop every 1,000 miles as required by assumptions.',
                })
                daily_record['fuel_stops'] += 1
                remaining_cycle_hours -= FUEL_STOP_DURATION

        if daily_record['driving_hours'] < MANDATORY_BREAK_AFTER_DRIVING and remaining_drive > 0:
            before_break = min(remaining_drive, MANDATORY_BREAK_AFTER_DRIVING - daily_record['driving_hours'])
            if before_break > 0:
                drive_chunk(before_break)
                remaining_drive -= before_break

        if daily_record['driving_hours'] >= MANDATORY_BREAK_AFTER_DRIVING and remaining_drive > 0:
            if daily_record['on_duty_hours'] + MANDATORY_BREAK_DURATION <= MAX_WORK_WINDOW and remaining_cycle_hours >= MANDATORY_BREAK_DURATION:
                add_segment(daily_record, {
                    'type': 'break',
                    'label': 'Mandatory break',
                    'duration_hours': MANDATORY_BREAK_DURATION,
                    'notes': 'Required 30-minute break after 8 hours of driving.',
                })
                remaining_cycle_hours -= MANDATORY_BREAK_DURATION
            else:
                remaining_drive = 0

        if remaining_drive > 0:
            drive_chunk(remaining_drive)

        if remaining_distance <= 0:
            add_segment(daily_record, {
                'type': 'dropoff',
                'label': 'Dropoff / Unload',
                'duration_hours': DROPOFF_DURATION,
                'notes': 'Final dropoff and unloading at destination.',
            })
            remaining_cycle_hours -= DROPOFF_DURATION
            daily_record['on_duty_hours'] += DROPOFF_DURATION
            daily_record['cycle_hours_used'] += DROPOFF_DURATION

        if remaining_distance > 0:
            add_segment(daily_record, {
                'type': 'rest',
                'label': 'Rest',
                'duration_hours': MIN_REST_HOURS,
                'notes': 'Minimum 10-hour rest before the next driving window.',
            })

        daily_record['cycle_hours_used'] = round(daily_record['on_duty_hours'], 2)
        schedule.append(daily_record)
        day += 1

    return {
        'schedule': schedule,
        'remaining_cycle_hours': round(remaining_cycle_hours, 2),
        'total_days': len(schedule),
        'initial_cycle_hours_used': float(cycle_used),
        'cycle_reset_applied': cycle_reset_applied,
        'notes': notes,
    }
