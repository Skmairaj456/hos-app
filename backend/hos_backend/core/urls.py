from django.urls import path
from .views import TripPlannerAPIView

urlpatterns = [
    path('plan-trip/', TripPlannerAPIView.as_view(), name='plan-trip'),
]
