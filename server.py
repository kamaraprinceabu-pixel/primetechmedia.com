import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILES = {
    'submissions': 'submissions.json',
    'clients': 'clients.json',
    'bookings': 'bookings.json',
    'services': 'services.json',
    'portfolio': 'portfolio.json',
    'blog': 'blog.json',
    'testimonials': 'testimonials.json',
    'staff': 'staff.json',
    'settings': 'settings.json',
    'activity': 'activity.json',
    'invoices': 'invoices.json',
    'payments': 'payments.json',
    'files': 'files.json',
    'announcements': 'announcements.json'
}
PASSWORD_SALT = b'prime-tech-media-salt-2026'
SESSION_STORE = {}
SESSION_DURATION_SECONDS = 60 * 60 * 8

DEFAULT_DATA = {
    'submissions': [],
    'clients': [],
    'bookings': [],
    'services': [],
    'portfolio': [],
    'blog': [],
    'testimonials': [],
    'staff': [
        {
            'id': 1,
            'username': 'superadmin',
            'name': 'Super Admin',
            'role': 'Super Admin',
            'passwordHash': 'ced88b5b5c34bdf0e0a0881ff8679b3989952b01595cc7e2c4c6f312941815c0',
            'salt': 'prime-tech-media-salt-2026',
            'active': True,
            'createdAt': '2026-08-05T00:00:00Z'
        }
    ],
    'settings': {
        'companyName': 'Prime Tech & Media Consultancy',
        'logo': 'assets/logo/prime.png',
        'email': 'info@primetechmedia.com',
        'phone': '+232 77 335304',
        'address': 'Freetown, Sierra Leone',
        'hours': 'Mon – Fri: 8:00 AM – 6:00 PM',
        'social': {
            'facebook': '',
            'instagram': '',
            'linkedin': '',
            'tiktok': '',
            'youtube': ''
        },
        'seoTitle': 'Prime Tech & Media Consultancy',
        'seoDescription': 'Modern technology and media solutions built for ambitious brands in Sierra Leone.',
        'seoKeywords': 'IT consultancy Sierra Leone, web development, branding, live streaming, media production'
    },
    'activity': [],
    'invoices': [],
    'payments': [],
    'files': [],
    'announcements': []
}


def get_data_file(resource):
    filename = DATA_FILES.get(resource)
    if not filename:
        return None
    return os.path.join(ROOT, filename)


def load_data(resource):
    path = get_data_file(resource)
    if not path:
        return None
    if not os.path.exists(path):
        save_data(resource, DEFAULT_DATA.get(resource, []))
    with open(path, 'r', encoding='utf-8') as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError:
            return DEFAULT_DATA.get(resource, [])


def save_data(resource, payload):
    path = get_data_file(resource)
    if not path:
        return None
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)
    return payload


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 150000).hex()


def verify_password(password, stored_hash, salt):
    candidate = hash_password(password, salt if isinstance(salt, bytes) else salt.encode('utf-8'))
    return hmac.compare_digest(candidate, stored_hash)


def require_auth(headers):
    auth = headers.get('Authorization', '')
    token = auth.replace('Bearer ', '').strip()
    session = SESSION_STORE.get(token)
    if not session or session.get('expiresAt') < datetime.now(timezone.utc):
        return None
    return session


def require_csrf(headers, session):
    return headers.get('X-CSRF-Token') == session.get('csrfToken')


def parse_resource_path(path):
    segments = path.strip('/').split('/')
    if len(segments) < 2 or segments[0] != 'api':
        return None, None
    resource = segments[1]
    item_id = None
    if len(segments) >= 3:
        item_id = segments[2]
    return resource, item_id


def get_query_filters(parsed):
    params = parse_qs(parsed.query)
    return {key: values[0] for key, values in params.items()}


def filter_items(items, filters):
    if not filters:
        return items
    results = items
    if 'q' in filters:
        query = filters['q'].lower()
        results = [item for item in results if any(query in str(value).lower() for value in item.values())]
    if 'type' in filters:
        results = [item for item in results if str(item.get('type', '')).lower() == filters['type'].lower()]
    if 'status' in filters:
        results = [item for item in results if str(item.get('status', '')).lower() == filters['status'].lower()]
    return results


def add_activity(action, user, resource, item_id=None, details=None):
    activity = load_data('activity')
    entry = {
        'id': len(activity) + 1,
        'action': action,
        'resource': resource,
        'itemId': item_id,
        'details': details or {},
        'user': user,
        'createdAt': now_iso()
    }
    activity.append(entry)
    save_data('activity', activity)
    return entry


def compute_analytics():
    clients = load_data('clients') or []
    bookings = load_data('bookings') or []
    invoices = load_data('invoices') or []
    payments = load_data('payments') or []
    submissions = load_data('submissions') or []
    services = load_data('services') or []
    activity = load_data('activity') or []
    popular_services = {}
    for booking in bookings:
        service = booking.get('service', 'Unknown')
        popular_services[service] = popular_services.get(service, 0) + 1
    return {
        'totalClients': len(clients),
        'totalBookings': len(bookings),
        'activeProjects': len([item for item in bookings if item.get('status') in ('approved', 'in-progress')]),
        'completedProjects': len([item for item in bookings if item.get('status') == 'completed']),
        'revenue': sum(float(payment.get('amount', 0) or 0) for payment in payments),
        'pendingPayments': len([inv for inv in invoices if inv.get('status') == 'pending']),
        'newMessages': len([message for message in submissions if message.get('type') == 'contact' and not message.get('read')]),
        'recentActivity': activity[-6:],
        'popularServices': sorted(popular_services.items(), key=lambda pair: pair[1], reverse=True)[:5],
        'clientGrowth': len(clients),
        'servicesCount': len(services)
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        resource, item_id = parse_resource_path(parsed.path)
        filters = get_query_filters(parsed)

        if parsed.path == '/api/analytics':
            self._send_json(200, compute_analytics())
            return

        if resource == 'settings' and item_id is None:
            settings = load_data('settings')
            self._send_json(200, settings)
            return

        if resource in DATA_FILES:
            items = load_data(resource) or []
            if item_id:
                item = next((item for item in items if str(item.get('id')) == item_id), None)
                if item is None:
                    self._send_json(404, {'error': 'Resource not found'})
                    return
                self._send_json(200, item)
                return
            filtered = filter_items(items, filters)
            self._send_json(200, filtered)
            return

        self._send_response_file(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        resource, item_id = parse_resource_path(parsed.path)
        length = int(self.headers.get('Content-Length', '0'))
        payload = {}
        if length:
            body = self.rfile.read(length).decode('utf-8')
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {}

        if parsed.path == '/api/auth/login':
            username = payload.get('username', 'superadmin')
            password = payload.get('password', '')
            staff = load_data('staff') or []
            user = next((item for item in staff if item.get('username') == username and item.get('active')), None)
            if not user or not verify_password(password, user.get('passwordHash', ''), user.get('salt', PASSWORD_SALT)):
                self._send_json(401, {'error': 'Invalid credentials'})
                return
            token = secrets.token_urlsafe(32)
            csrf_token = secrets.token_urlsafe(24)
            expires = datetime.now(timezone.utc).timestamp() + SESSION_DURATION_SECONDS
            SESSION_STORE[token] = {'username': username, 'role': user.get('role', 'Staff'), 'expiresAt': datetime.fromtimestamp(expires, timezone.utc), 'csrfToken': csrf_token}
            self._send_json(200, {'token': token, 'csrfToken': csrf_token, 'user': username, 'role': user.get('role', 'Staff')})
            return

        if resource == 'submissions' and item_id is None:
            submissions = load_data('submissions') or []
            record = {
                'id': len(submissions) + 1,
                'type': payload.get('type', 'contact'),
                'createdAt': payload.get('createdAt') or now_iso(),
                'name': payload.get('name', ''),
                'email': payload.get('email', ''),
                'subject': payload.get('subject', ''),
                'message': payload.get('message', payload.get('project', '')),
                'service': payload.get('service', payload.get('subject', '')),
                'company': payload.get('company', ''),
                'phone': payload.get('phone', ''),
                'budget': payload.get('budget', ''),
                'project': payload.get('project', ''),
                'status': 'new',
                'read': False,
                'archived': False,
                'details': payload
            }
            submissions.append(record)
            save_data('submissions', submissions)
            add_activity('new message', 'public', 'submissions', record['id'], {'type': record['type']})
            self._send_json(200, {'success': True, 'record': record})
            return

        if resource not in DATA_FILES or item_id is not None:
            self._send_json(404, {'error': 'Not found'})
            return

        session = require_auth(self.headers)
        if not session:
            self._send_json(401, {'error': 'Unauthorized'})
            return
        if not require_csrf(self.headers, session):
            self._send_json(403, {'error': 'CSRF token missing or invalid'})
            return

        items = load_data(resource) or []
        record = {'id': len(items) + 1, 'createdAt': now_iso(), **payload}
        if resource == 'files':
            record.setdefault('type', 'image')
        if resource == 'invoices':
            record.setdefault('status', 'pending')
        if resource == 'payments':
            record.setdefault('status', 'recorded')
        items.append(record)
        save_data(resource, items)
        add_activity('create', session['username'], resource, record['id'], payload)
        self._send_json(200, {'success': True, 'record': record})

    def do_PUT(self):
        parsed = urlparse(self.path)
        resource, item_id = parse_resource_path(parsed.path)
        length = int(self.headers.get('Content-Length', '0'))
        payload = {}
        if length:
            body = self.rfile.read(length).decode('utf-8')
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {}

        if not resource or not item_id or resource not in DATA_FILES:
            self._send_json(404, {'error': 'Not found'})
            return

        session = require_auth(self.headers)
        if not session:
            self._send_json(401, {'error': 'Unauthorized'})
            return
        if not require_csrf(self.headers, session):
            self._send_json(403, {'error': 'CSRF token missing or invalid'})
            return

        items = load_data(resource) or []
        item = next((item for item in items if str(item.get('id')) == item_id), None)
        if item is None:
            self._send_json(404, {'error': 'Not found'})
            return
        item.update(payload)
        item['updatedAt'] = now_iso()
        save_data(resource, items)
        add_activity('update', session['username'], resource, item_id, payload)
        self._send_json(200, {'success': True, 'record': item})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        resource, item_id = parse_resource_path(parsed.path)

        if resource == 'submissions' and item_id is None:
            session = require_auth(self.headers)
            if not session:
                self._send_json(401, {'error': 'Unauthorized'})
                return
            if not require_csrf(self.headers, session):
                self._send_json(403, {'error': 'CSRF token missing or invalid'})
                return
            save_data('submissions', [])
            add_activity('bulk delete', session['username'], 'submissions', None, {'action': 'clear all'})
            self._send_json(200, {'success': True, 'cleared': True})
            return

        if not resource or not item_id or resource not in DATA_FILES:
            self._send_json(404, {'error': 'Not found'})
            return

        session = require_auth(self.headers)
        if not session:
            self._send_json(401, {'error': 'Unauthorized'})
            return
        if not require_csrf(self.headers, session):
            self._send_json(403, {'error': 'CSRF token missing or invalid'})
            return

        items = load_data(resource) or []
        filtered = [item for item in items if str(item.get('id')) != item_id]
        if len(filtered) == len(items):
            self._send_json(404, {'error': 'Not found'})
            return
        save_data(resource, filtered)
        add_activity('delete', session['username'], resource, item_id, {})
        self._send_json(200, {'success': True, 'deleted': item_id})

    def _send_response_file(self, path):
        if path in ('/', '/index.html'):
            file_path = os.path.join(ROOT, 'index.html')
        else:
            clean_path = path.lstrip('/')
            file_path = os.path.join(ROOT, clean_path)

        if os.path.isdir(file_path):
            file_path = os.path.join(file_path, 'index.html')

        if os.path.exists(file_path) and os.path.isfile(file_path):
            with open(file_path, 'rb') as handle:
                content = handle.read()
            self.send_response(200)
            self.send_header('Content-Type', self._guess_content_type(file_path))
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()

    def _guess_content_type(self, path):
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.json'):
            return 'application/json; charset=utf-8'
        if path.endswith('.svg'):
            return 'image/svg+xml'
        if path.endswith('.png'):
            return 'image/png'
        if path.endswith('.webp'):
            return 'image/webp'
        return 'application/octet-stream'


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8001), Handler)
    print('Server running on http://127.0.0.1:8001')
    server.serve_forever()
