"""
Encryption utility for scenario data.

Uses AES-256 (via Fernet) to encrypt scenario JSON before writing to
PostgreSQL. The encryption key is loaded from the SCENARIO_ENCRYPTION_KEY
environment variable and never touches the database.

Generating a key (run once, save to Railway env vars):
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# ── key loading ──────────────────────────────────────────────────────────────

def _load_key() -> Fernet | None:
    """Load the Fernet key from environment. Returns None if not configured."""
    key = os.environ.get("SCENARIO_ENCRYPTION_KEY", "").strip()
    if not key:
        logger.warning(
            "SCENARIO_ENCRYPTION_KEY not set — scenario data will be stored "
            "unencrypted. Set this variable in Railway to enable encryption."
        )
        return None
    try:
        return Fernet(key.encode())
    except Exception as e:
        logger.error(f"Invalid SCENARIO_ENCRYPTION_KEY: {e}")
        return None


# Module-level singleton — loaded once at startup
_fernet: Fernet | None = _load_key()


# ── public API ───────────────────────────────────────────────────────────────

def encrypt_data(plaintext: str) -> str:
    """
    Encrypt a JSON string for storage.

    If no encryption key is configured, returns the plaintext unchanged
    so the app continues to work without encryption.
    """
    if _fernet is None:
        return plaintext
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_data(ciphertext: str) -> str:
    """
    Decrypt a stored value back to a JSON string.

    Handles both encrypted values (when a key is configured) and legacy
    plaintext values (written before encryption was enabled), so existing
    data in the database continues to work transparently after the key
    is first added.
    """
    if _fernet is None:
        return ciphertext

    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # Not encrypted — legacy plaintext row written before encryption
        # was enabled. Return as-is; it will be re-encrypted on next save.
        logger.debug("decrypt_data: received unencrypted legacy value — returning plaintext")
        return ciphertext
    except Exception as e:
        logger.error(f"decrypt_data: unexpected error: {e}")
        raise