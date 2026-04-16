from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(_request):
    return JsonResponse({
        'status': 'ok',
        'message': 'HOS backend is live',
        'api': '/api/plan-trip/',
    })

urlpatterns = [
    path('', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/', include('hos_backend.core.urls')),
]
