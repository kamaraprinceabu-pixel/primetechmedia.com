import base64
import hashlib
import hmac
import json
import os
import secrets
import smtplib
from email.message import EmailMessage
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8001"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")
GMAIL_SMTP_USER = os.environ.get("GMAIL_SMTP_USER", "")
GMAIL_SMTP_PASSWORD = os.environ.get("GMAIL_SMTP_PASSWORD", "")

TABLE_URL = f"{SUPABASE_URL}/rest/v1/submissions"


def supabase_request(method, url, data=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "Supabase environment variables are not configured"
        )

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
        with urllib.request.urlopen(
            request,
            timeout=30
        ) as response:
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


def get_secret():
    if ADMIN_SECRET:
        return ADMIN_SECRET

    if ADMIN_PASSWORD:
        return hashlib.sha256(
            ADMIN_PASSWORD.encode("utf-8")
        ).hexdigest()

    return ""


def create_admin_token():
    secret = get_secret()

    if not secret:
        raise RuntimeError(
            "ADMIN_SECRET or ADMIN_PASSWORD must be configured"
        )

    timestamp = str(
        int(datetime.now(timezone.utc).timestamp())
    )

    nonce = secrets.token_urlsafe(24)

    payload = f"{timestamp}.{nonce}"

    signature = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    token_data = f"{payload}.{signature}"

    return base64.urlsafe_b64encode(
        token_data.encode("utf-8")
    ).decode("utf-8").rstrip("=")


def verify_admin_token(token):
    if not token:
        return False

    secret = get_secret()

    if not secret:
        return False

    try:
        padding = "=" * (
            4 - len(token) % 4
        )

        decoded = base64.urlsafe_b64decode(
            token + padding
        ).decode("utf-8")

        parts = decoded.split(".")

        if len(parts) != 3:
            return False

        timestamp, nonce, signature = parts

        payload = f"{timestamp}.{nonce}"

        expected_signature = hmac.new(
            secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(
            signature,
            expected_signature
        ):
            return False

        token_time = int(timestamp)

        current_time = int(
            datetime.now(timezone.utc).timestamp()
        )

        max_age = 60 * 60 * 24

        if current_time - token_time > max_age:
            return False

        if token_time > current_time + 60:
            return False

        return True

    except Exception:
        return False

def send_email_reply(recipient, subject, message):
    if not GMAIL_SMTP_USER or not GMAIL_SMTP_PASSWORD:
        raise RuntimeError(
            "Gmail SMTP environment variables are not configured"
        )

    email = EmailMessage()

    email["From"] = GMAIL_SMTP_USER
    email["To"] = recipient
    email["Subject"] = subject

    email.set_content(message)

    with smtplib.SMTP(
        "smtp.gmail.com",
        587,
        timeout=30
    ) as smtp:

        smtp.starttls()

        smtp.login(
            GMAIL_SMTP_USER,
            GMAIL_SMTP_PASSWORD
        )

        smtp.send_message(email)

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

    def get_auth_token(self):
        authorization = self.headers.get(
            "Authorization",
            ""
        )

        if not authorization.startswith(
            "Bearer "
        ):
            return None

        return authorization[7:].strip()

    def require_admin(self):
        token = self.get_auth_token()

        if not verify_admin_token(token):
            self.send_json(
                401,
                {
                    "error": "Unauthorized"
                }
            )

            return False

        return True

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

        if self.path == "/api/admin/session":
            if self.require_admin():
                self.send_json(
                    200,
                    {
                        "authenticated": True
                    }
                )

            return

        if self.path == "/api/submissions":

            if not self.require_admin():
                return

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

                self.send_json(
                    200,
                    formatted
                )

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

        if self.path == "/api/admin/reply":

            if not self.require_admin():
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

                recipient = str(
                    data.get("recipient", "")
                ).strip()

                subject = str(
                    data.get("subject", "")
                ).strip()

                message = str(
                    data.get("message", "")
                ).strip()

                if not recipient:
                    self.send_json(
                        400,
                        {
                            "error": "Recipient email is required"
                        }
                    )
                    return

                if not subject:
                    self.send_json(
                        400,
                        {
                            "error": "Email subject is required"
                        }
                    )
                    return

                if not message:
                    self.send_json(
                        400,
                        {
                            "error": "Reply message is required"
                        }
                    )
                    return

                send_email_reply(
                    recipient,
                    subject,
                    message
                )

                self.send_json(
                    200,
                    {
                        "success": True,
                        "message": "Reply sent successfully"
                    }
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
                    f"Send reply error: {error}",
                    flush=True
                )

                self.send_json(
                    500,
                    {
                        "error": "Unable to send email reply"
                    }
                )

            return

        if self.path == "/api/admin/login":

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

                password = data.get(
                    "password",
                    ""
                )

                if not ADMIN_PASSWORD:
                    self.send_json(
                        500,
                        {
                            "error": "Admin password is not configured"
                        }
                    )

                    return

                if not secrets.compare_digest(
                    password,
                    ADMIN_PASSWORD
                ):
                    self.send_json(
                        401,
                        {
                            "error": "Incorrect password"
                        }
                    )

                    return

                token = create_admin_token()

                self.send_json(
                    200,
                    {
                        "authenticated": True,
                        "token": token
                    }
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
                    f"Admin login error: {error}",
                    flush=True
                )

                self.send_json(
                    500,
                    {
                        "error": "Unable to create admin session"
                    }
                )

            return

        if self.path == "/api/admin/logout":

            self.send_json(
                200,
                {
                    "success": True
                }
            )

            return

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

            submission = convert_submission(
                data
            )

            result = supabase_request(
                "POST",
                TABLE_URL,
                submission
            )

            if (
                isinstance(result, list)
                and result
            ):
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

        if not self.require_admin():
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