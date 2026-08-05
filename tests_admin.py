import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class AdminPageTests(unittest.TestCase):
    def test_admin_page_contains_auth_and_actions(self):
        admin_html = (ROOT / 'admin.html').read_text(encoding='utf-8')
        self.assertIn('adminLoginForm', admin_html)
        self.assertIn('logoutAdminBtn', admin_html)
        self.assertIn('logoutAdminBtn', admin_html)
        self.assertIn('adminLoginCard', admin_html)

    def test_script_contains_admin_auth_logic(self):
        script_js = (ROOT / 'script.js').read_text(encoding='utf-8')
        self.assertIn("const adminPassword = 'PrimeTech2026!'", script_js)
        self.assertIn("localStorage.setItem('adminAuthenticated', 'true')", script_js)
        self.assertIn("data-action=\"reply\"", script_js)

    def test_script_uses_fallback_api_url(self):
        script_js = (ROOT / 'script.js').read_text(encoding='utf-8')
        self.assertIn("http://127.0.0.1:8001", script_js)
        self.assertIn("window.location.origin", script_js)


if __name__ == '__main__':
    unittest.main()
