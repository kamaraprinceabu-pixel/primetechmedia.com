import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8001"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

TABLE_URL = f"{SUPABASE_URL}/rest/v1/submissions"


def supabase_request(method, url, data=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Supabase environment variables are not configured")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    if method == "POST":
        headers["Prefer"] = "return=representation"

    if method == "DELETE":
        headers["Prefer"] = "return=minimal"

    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_body = response.read().decode("utf-8")

            if not response_body:
                return {}

            return json.loads(response_body)

    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8")

        print(
            f"Supabase error {error.code}: {error_body}",
            flush=True
        )

        raise RuntimeError(
            f"Supabase returned HTTP {error.code}: {error_body}"
        )


def convert_submission(data):
    return {
        "type": data.get("type", "contact"),
        "name": data.get("name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "company": data.get("company"),
        "service": data.get("service"),
        "date": data.get("date") or None,
        "time": data.get("time"),
        "budget": data.get("budget"),
        "message": data.get("message"),
        "created_at": data.get("createdAt")
        or datetime.now(timezone.utc).isoformat()
    }


class Handler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        response = json.dumps(data).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json"
        )
        self.send_header(
            "Content-Length",
            str(len(response))
        )
        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, DELETE, OPTIONS"
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
        )
        self.end_headers()

        self.wfile.write(response)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, DELETE, OPTIONS"
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
        )
        self.end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.send_json(
                200,
                {
                    "status": "online",
                    "message": "PrimeTech API is running"
                }
            )
            return

        if self.path.startswith("/api/submissions"):
            try:
                submissions = supabase_request(
                    "GET",
                    f"{TABLE_URL}?select=*&order=created_at.desc"
                )

                formatted = []

                for submission in submissions:
                    item = dict(submission)

                    item["createdAt"] = item.get(
                        "created_at"
                    )

                    formatted.append(item)

                self.send_json(200, formatted)

            except Exception as error:
                print(
                    f"GET submissions error: {error}",
                    flush=True
                )

                self.send_json(
                    500,
                    {
                        "error": "Unable to fetch submissions"
                    }
                )

            return

        self.send_json(
            404,
            {
                "error": "Not found"
            }
        )

    def do_POST(self):
        if self.path != "/api/submissions":
            self.send_json(
                404,
                {
                    "error": "Not found"
                }
            )
            return

        try:
            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0"
                )
            )

            raw_body = self.rfile.read(
                content_length
            )

            data = json.loads(
                raw_body.decode("utf-8")
            )

            submission = convert_submission(data)

            result = supabase_request(
                "POST",
                TABLE_URL,
                submission
            )

            if isinstance(result, list) and result:
                saved = result[0]
            else:
                saved = submission

            saved["createdAt"] = saved.get(
                "created_at",
                saved.get("createdAt")
            )

            self.send_json(
                201,
                saved
            )

        except json.JSONDecodeError:
            self.send_json(
                400,
                {
                    "error": "Invalid JSON"
                }
            )

        except Exception as error:
            print(
                f"POST submissions error: {error}",
                flush=True
            )

            self.send_json(
                500,
                {
                    "error": "Unable to save submission"
                }
            )

    def do_DELETE(self):
        if self.path != "/api/submissions":
            self.send_json(
                404,
                {
                    "error": "Not found"
                }
            )
            return

        try:
            supabase_request(
                "DELETE",
                f"{TABLE_URL}?id=not.is.null"
            )

            self.send_json(
                200,
                {
                    "success": True
                }
            )

        except Exception as error:
            print(
                f"DELETE submissions error: {error}",
                flush=True
            )

            self.send_json(
                500,
                {
                    "error": "Unable to clear submissions"
                }
            )

    def do_HEAD(self):
        self.send_response(200)
        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )
        self.end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(
        (HOST, PORT),
        Handler
    )

    print(
        f"Server running on {HOST}:{PORT}",
        flush=True
    )

    server.serve_forever()