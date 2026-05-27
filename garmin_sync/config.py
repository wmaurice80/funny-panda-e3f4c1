"""
Environment configuration loader.
All credentials are read from a .env file located in the parent directory.
"""

from pathlib import Path

from dotenv import load_dotenv
import os

# Load .env from the directory containing this script's parent
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise EnvironmentError(
            f"Variable d'environnement manquante : '{name}'. "
            f"Vérifiez votre fichier .env ({_env_path})."
        )
    return value


GARMIN_EMAIL: str = _require("GARMIN_EMAIL")
GARMIN_PASSWORD: str = _require("GARMIN_PASSWORD")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
CALSNAP_USER_ID: str = os.getenv("CALSNAP_USER_ID", "")
