from rest_framework import serializers

class TripPlanSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    distance_miles = serializers.FloatField(min_value=0)
    cycle_hours_used = serializers.FloatField(min_value=0, max_value=100)

    def validate(self, data):
        if data['distance_miles'] == 0:
            raise serializers.ValidationError('Distance must be greater than 0 miles.')
        return data
