"""
Garmin Connect authentication client.
Tries token-based session first, falls back to email/password login.
"""

import argparse
import os
from pathlib import Path

import garth
from garminconnect import Garmin, GarminConnectAuthenticationError

from config import GARMIN_EMAIL, GARMIN_PASSWORD

TOKEN_STORE = str(Path("~/.garth").expanduser())


class AuthenticationError(Exception):
    pass


def get_client() -> Garmin:
    """Return an authenticated Garmin client, using cached tokens when available."""
    # Try resuming from cached garth tokens
    try:
        client = Garmin(email=GARMIN_EMAIL, password=GARMIN_PASSWORD)
        client.garth.load(TOKEN_STORE)
        client.get_full_name()  # test rapide pour vérifier que le token est valide
        return client
    except Exception:
        pass

    # Tokens invalides ou absents — login email/password
    try:
        client = Garmin(email=GARMIN_EMAIL, password=GARMIN_PASSWORD)
        client.login()
        client.garth.dump(TOKEN_STORE)
        return client
    except GarminConnectAuthenticationError:
        raise AuthenticationError(
            "Authentification Garmin échouée. "
            "Relancer avec --reauth ou vérifier MFA."
        )


def test_auth() -> None:
    """Print a confirmation line with the user's first name."""
    client = get_client()
    full_name = client.get_full_name()
    prenom = full_name.split()[0] if full_name else "inconnu"
    print(f"✓ Connecté en tant que {prenom}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Garmin Connect auth helper")
    parser.add_argument(
        "--test-auth",
        action="store_true",
        help="Verify authentication and display connected user",
    )
    args = parser.parse_args()

    if args.test_auth:
        test_auth()
