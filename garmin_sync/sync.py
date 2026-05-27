import argparse
import logging
import sys
import time
from datetime import date, timedelta

from garmin_client import get_client, test_auth, AuthenticationError
from garminconnect import GarminConnectAuthenticationError, GarminConnectTooManyRequestsError
from garmin_fetch import sync_daily_summary, fetch_daily_summary
from garmin_activities import sync_activities, fetch_activities_for_date
from garmin_weights import sync_weight, fetch_weight_for_date
from circuit_breaker import garmin_circuit, CircuitOpenError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

log = logging.getLogger(__name__)


def get_dates(days_back: int) -> list[str]:
    """Retourne la liste des `days_back` dernières dates au format YYYY-MM-DD, aujourd'hui inclus."""
    today = date.today()
    return [
        (today - timedelta(days=days_back - 1 - i)).strftime("%Y-%m-%d")
        for i in range(days_back)
    ]


def sync_date(client, date_str: str, dry_run: bool, delay: float) -> dict:
    """Synchronise une seule date. Retourne un rapport sous forme de dict."""
    report = {
        "date": date_str,
        "tdee_ok": False,
        "activities_ok": 0,
        "activities_err": 0,
        "weight_ok": False,
    }

    if dry_run:
        log.info("[DRY-RUN] %s — récupération des données (aucune écriture)", date_str)

        daily = fetch_daily_summary(client, date_str)
        log.info("[DRY-RUN] TDEE qui SERAIT écrit : %s", daily)
        report["tdee_ok"] = daily is not None

        time.sleep(delay)

        activities = fetch_activities_for_date(client, date_str)
        count = len(activities) if activities else 0
        log.info("[DRY-RUN] %d activité(s) qui SERAIENT importées : %s", count, activities)
        report["activities_ok"] = count

        time.sleep(delay)

        weight = fetch_weight_for_date(client, date_str)
        log.info("[DRY-RUN] Poids qui SERAIT synchronisé : %s", weight)
        report["weight_ok"] = weight is not None

        return report

    # Mode normal
    try:
        garmin_circuit.raise_if_open()

        log.info("%s — sync TDEE…", date_str)
        report["tdee_ok"] = sync_daily_summary(client, date_str)
        time.sleep(delay)

        log.info("%s — sync activités…", date_str)
        ok, err = sync_activities(client, date_str)
        report["activities_ok"] = ok
        report["activities_err"] = err
        time.sleep(delay)

        log.info("%s — sync poids…", date_str)
        report["weight_ok"] = sync_weight(client, date_str)

        garmin_circuit.record_success()

    except GarminConnectTooManyRequestsError:
        log.error("%s — trop de requêtes (429) : circuit breaker notifié", date_str)
        garmin_circuit.record_failure()
        raise

    return report


def main():
    parser = argparse.ArgumentParser(description="CalSnap — Garmin Sync")
    parser.add_argument("--days", type=int, default=1, help="Nombre de jours à synchroniser")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture Supabase")
    parser.add_argument("--test-auth", action="store_true", help="Teste l'authentification et quitte")
    args = parser.parse_args()

    if args.test_auth:
        log.info("Test d'authentification Garmin…")
        test_auth()
        log.info("Authentification OK")
        sys.exit(0)

    try:
        log.info("Connexion à Garmin Connect…")
        client = get_client()
    except (AuthenticationError, GarminConnectAuthenticationError) as exc:
        log.error("Échec d'authentification : %s", exc)
        sys.exit(1)

    dates = get_dates(args.days)
    mode_label = "DRY-RUN" if args.dry_run else "NORMAL"
    log.info("Mode %s — %d date(s) à traiter : %s", mode_label, len(dates), dates)

    reports = []
    for date_str in dates:
        try:
            r = sync_date(client, date_str, dry_run=args.dry_run, delay=1.0)
            reports.append(r)
        except CircuitOpenError:
            log.error("[CIRCUIT_OPEN] Synchronisation interrompue")
            sys.exit(1)
        except (AuthenticationError, GarminConnectAuthenticationError) as exc:
            log.error("Erreur d'authentification pendant la sync : %s", exc)
            sys.exit(1)
        except Exception as exc:
            log.error("%s — erreur inattendue : %s", date_str, exc)
            reports.append({
                "date": date_str,
                "tdee_ok": False,
                "activities_ok": 0,
                "activities_err": 0,
                "weight_ok": False,
            })

    # Rapport final
    total = len(reports)
    tdee_ok = sum(1 for r in reports if r["tdee_ok"])
    act_ok = sum(r["activities_ok"] for r in reports)
    act_err = sum(r["activities_err"] for r in reports)
    weight_ok = sum(1 for r in reports if r["weight_ok"])

    print()
    print("=== Rapport CalSnap Garmin Sync ===")
    print(f"Dates traitées       : {total}")
    print(f"TDEE mis à jour      : {tdee_ok}/{total}")
    print(f"Activités importées  : {act_ok} ({act_err} erreurs)")
    print(f"Poids synchronisés   : {weight_ok}/{total}")
    print(f"Mode                 : {mode_label}")


if __name__ == "__main__":
    main()
