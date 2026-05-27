"""
Script d'auth Garmin one-shot via garth.
Génère les tokens OAuth2 dans ~/.garth/ pour l'Edge Function Supabase.
Usage : python garmin_auth.py
"""

import json
import os
from pathlib import Path

import garth

TOKEN_STORE = str(Path("~/.garth").expanduser())


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        print("Usage : GARMIN_EMAIL=... GARMIN_PASSWORD=... python garmin_auth.py")
        raise SystemExit(1)

    print(f"Connexion à Garmin Connect pour {email}…")
    garth.login(email, password)
    garth.dump(TOKEN_STORE)
    print(f"✓ Tokens sauvegardés dans {TOKEN_STORE}")

    token_file = Path(TOKEN_STORE) / "oauth2_token.json"
    if token_file.exists():
        tokens = json.loads(token_file.read_text())
        print("\nCopiez ce JSON comme secret GARMIN_TOKENS dans Supabase :")
        print("-" * 60)
        print(json.dumps(tokens))
        print("-" * 60)
    else:
        print(f"Tokens générés dans {TOKEN_STORE} — vérifiez les fichiers.")


if __name__ == "__main__":
    main()
