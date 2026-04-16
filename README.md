# Truck Driver Route Planning and HOS Compliance System

A full-stack Django + React application for planning truck driving schedules and validating Hours-of-Service rules.

## Project Structure

hos-app/
  backend/
    manage.py
    requirements.txt
    hos_backend/
      __init__.py
      asgi.py
      settings.py
      urls.py
      wsgi.py
      core/
        __init__.py
        admin.py
        apps.py
        models.py
        serializers.py
        services.py
        views.py
        urls.py
  frontend/
    package.json
    vite.config.js
    index.html
    .env.example
    src/
      main.jsx
      App.jsx
      App.css
      main.css
      components/
        TripForm.jsx
        ResultsPage.jsx

## Backend Setup

1. Create and activate a Python virtual environment:

```powershell
cd hos-app\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
python -m pip install -r requirements.txt
```

3. Run migrations:

```powershell
python manage.py migrate
```

4. Start the Django server:

```powershell
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/plan-trip/`.

## Frontend Setup

1. In a second terminal, install dependencies:

```powershell
cd hos-app\frontend
npm install
```

2. Copy `.env.example` to `.env`:

```powershell
copy .env.example .env
```

3. Start the Vite development server:

```powershell
npm run dev
```

The frontend runs at `http://localhost:5173`.

> NOTE: No paid map API key is required; this app uses OpenStreetMap and OSRM.

## Run Backend Tests

From the backend folder:

```powershell
cd hos-app\backend
py -3 manage.py test hos_backend.core
```

## Deployment Notes

- Backend: Deploy to Render, Heroku, or another Python host. Use `gunicorn hos_backend.wsgi` and ensure `DEBUG=False`.
- Frontend: Deploy to Vercel or Netlify. Build with `npm run build`.
- Set environment variables:
  - `VITE_API_BASE` (backend URL)

## Features

- HOS-compliant schedule generation
- Daily driving, break, rest, and duty segments
- 70-hour cycle handling with 34-hour reset
- React form and results UI
- Free OpenStreetMap routing and map display via OSRM
