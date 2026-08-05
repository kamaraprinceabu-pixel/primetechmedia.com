import hashlib
print(hashlib.pbkdf2_hmac('sha256', b'PrimeTech2026!', b'prime-tech-media-salt-2026', 150000).hex())
