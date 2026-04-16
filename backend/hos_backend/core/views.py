from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import TripPlanSerializer
from .services import calculate_schedule


class TripPlannerAPIView(APIView):
    """API endpoint for truck driver route planning and HOS compliance."""

    def post(self, request):
        serializer = TripPlanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = calculate_schedule(
                distance=data['distance_miles'],
                cycle_used=data['cycle_hours_used'],
            )
        except Exception as exc:
            return Response(
                {'error': 'Unable to calculate trip plan.', 'details': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = {
            'trip': {
                'current_location': data['current_location'],
                'pickup_location': data['pickup_location'],
                'dropoff_location': data['dropoff_location'],
                'distance_miles': data['distance_miles'],
                'cycle_hours_used': data['cycle_hours_used'],
            },
            'plan': result,
        }
        return Response(response, status=status.HTTP_200_OK)
