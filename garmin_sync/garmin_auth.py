"""
Script d'auth Garmin one-shot via garminconnect (remplace garth déprécié).
Génère les tokens DI OAuth2 pour l'Edge Function Supabase.

Usage :
    GARMIN_EMAIL=... GARMIN_PASSWORD=... python garmin_auth.py
"""

import base64
import json
import os
import sys
import time


def decode_jwt_exp(token: str) -> int:
    """Extrait le timestamp d'expiration depuis un JWT sans vérification de signature."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return int(data.get("exp", time.time() + 3600))
    except Exception:
        return int(time.time()) + 3600


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        print("Usage : GARMIN_EMAIL=... GARMIN_PASSWORD=... python garmin_auth.py")
        sys.exit(1)

    print(f"Connexion à Garmin Connect pour {email}…")
    print("(5 stratégies d'auth en cascade — peut prendre 10-30s)")

    from garminconnect import Garmin, GarminConnectAuthenticationError

    try:
        api = Garmin(email=email, password=password)
        api.login()
    except GarminConnectAuthenticationError as e:
        print(f"\n✗ Échec d'authentification : {e}")
        print("Vérifiez vos identifiants ou attendez la levée du rate-limit Garmin.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Erreur inattendue : {e}")
        sys.exit(1)

    print(f"✓ Connecté en tant que {api.display_name}")

    client = api.client
    di_token = getattr(client, "di_token", None)
    di_refresh = getattr(client, "di_refresh_token", None)
    di_client_id = getattr(client, "di_client_id", None)

    if not di_token:
        print("\n✗ Aucun DI token récupéré (connexion peut-être via JWT_WEB fallback).")
        print("Essayez de relancer dans ~1h si le rate-limit persiste.")
        sys.exit(1)

    expires_at = decode_jwt_exp(di_token)

    tokens = {
        "access_token": di_token,
        "refresh_token": di_refresh or "",
        "expires_at": expires_at,
        "token_type": "Bearer",
        "di_client_id": di_client_id or "",
    }

    print("\nCopiez ce JSON comme secret GARMIN_TOKENS dans Supabase :")
    print("-" * 60)
    print(json.dumps(tokens))
    print("-" * 60)
    print("\nCommande Supabase CLI :")
    tokens_json = json.dumps(tokens).replace("'", "\\'")
    print(
        f"supabase secrets set GARMIN_TOKENS='{tokens_json}'"
        " --project-ref lhcouyccseuyczcmatoa"
    )


if __name__ == "__main__":
    main()
