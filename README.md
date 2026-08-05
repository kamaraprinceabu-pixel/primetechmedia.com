## Backend note

The website now uses a simple JSON-backed submission endpoint. In this environment, launching Python directly was blocked by the local Windows Python alias, so the frontend is prepared to call the endpoint at http://127.0.0.1:8001/api/submissions once a Python runtime is available.

If you want to run it locally, use:

```powershell
python server.py
```
