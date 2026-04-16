"""
Encryption utility for scenario data.

Uses AES-128-CBC with HMAC-SHA256 (Fernet) to encrypt scenario JSON before
writing to PostgreSQL. The encryption key is loaded from the
SCENARIO_ENCRYPTION_KEY environment variable and never touches the database.

Generating a key (run once, save to Railway env vars):
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

IMPORTANT: If SCENARIO_ENCRYPTION_KEY is not set and ENVIRONMENT=production,
the application will refuse to start. This prevents silent data exposure in
the event of a misconfigured deployment.
"""

import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# ── key loading ──────────────────────────────────────────────────────────────

def _load_key() -> Fernet | None:
    """
    Load the Fernet key from environment.

    - Production (ENVIRONMENT=production): raises RuntimeError if key is absent.
      A missing key in production means data would be stored in plaintext —
      this is a misconfiguration that must be caught at startup, not silently
      tolerated.
    - Development: warns and returns None (app runs without encryption).
    """
    key = os.environ.get("SCENARIO_ENCRYPTION_KEY", "").strip()
    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

    if not key:
        if is_production:
            raise RuntimeError(
                "SCENARIO_ENCRYPTION_KEY is not set. "
                "This environment variable is required in production. "
                "Generate a key with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                " and add it to your Railway environment variables."
            )
        logger.warning(
            "SCENARIO_ENCRYPTION_KEY not set — scenario data will be stored "
            "unencrypted. Set this variable in Railway to enable encryption."
        )
        return None

    try:
        return Fernet(key.encode())
    except Exception as e:
        if is_production:
            raise RuntimeError(f"Invalid SCENARIO_ENCRYPTION_KEY: {e}") from e
        logger.error(f"Invalid SCENARIO_ENCRYPTION_KEY: {e}")
        return None


# Module-level singleton — loaded once at startup.
# In production, a missing or invalid key raises RuntimeError here,
# which prevents the FastAPI app from starting at all.
_fernet: Fernet | None = _load_key()


# ── public API ───────────────────────────────────────────────────────────────

def encrypt_data(plaintext: str) -> str:
    """
    Encrypt a JSON string for storage.

    If no encryption key is configured (development only), returns the
    plaintext unchanged so the app continues to work locally.
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
