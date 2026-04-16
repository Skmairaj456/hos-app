from django.test import TestCase
from django.urls import reverse

from .services import calculate_schedule


class ScheduleServiceTests(TestCase):
    def test_basic_schedule_outputs_days(self):
        result = calculate_schedule(distance=300, cycle_used=0)
        self.assertIn('schedule', result)
        self.assertGreaterEqual(len(result['schedule']), 1)
        self.assertEqual(result['initial_cycle_hours_used'], 0.0)
        self.assertGreaterEqual(result['remaining_cycle_hours'], 0.0)
        self.assertLessEqual(result['remaining_cycle_hours'], 70.0)

    def test_cycle_reset_applies_when_needed(self):
        result = calculate_schedule(distance=1600, cycle_used=69)
        self.assertTrue(result['cycle_reset_applied'])
        self.assertIn('schedule', result)
        self.assertTrue(any(day['segments'][0]['type'] == 'cycle_reset' for day in result['schedule']))

    def test_fuel_stop_segment_added(self):
        result = calculate_schedule(distance=1200, cycle_used=0)
        self.assertTrue(any(any(seg['type'] == 'fuel_stop' for seg in day['segments']) for day in result['schedule']))


class TripPlannerAPITests(TestCase):
    def test_plan_trip_api_valid_request(self):
        url = reverse('plan-trip')
        data = {
            'current_location': 'Home Garage',
            'pickup_location': 'Chicago, IL',
            'dropoff_location': 'St. Louis, MO',
            'distance_miles': 300,
            'cycle_hours_used': 30,
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('plan', response.json())

    def test_plan_trip_api_invalid_request(self):
        url = reverse('plan-trip')
        data = {
            'current_location': '',
            'pickup_location': 'Chicago, IL',
            'dropoff_location': 'St. Louis, MO',
            'distance_miles': 0,
            'cycle_hours_used': -5,
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('errors', response.json())
