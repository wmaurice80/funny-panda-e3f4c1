import logging
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError
from supabase_push import upsert_weight

logger = logging.getLogger(__name__)


def fetch_weight_for_date(client: Garmin, date: str) -> dict | None:
    try:
        data = client.get_body_composition(date, date)
    except GarminConnectAuthenticationError:
        raise
    except GarminConnectTooManyRequestsError:
        logger.warning("[RATE LIMIT] poids %s", date)
        raise
    except Exception as exc:
        logger.error("[GARMIN ERROR] poids %s : %s", date, exc)
        return None

    entry = data[0] if data else None

    if not entry or not entry.get("weight"):
        logger.info("[POIDS SKIP] pas de pesée Garmin pour %s", date)
        return None

    weight_g = entry["weight"]
    if weight_g == 0:
        logger.info("[POIDS SKIP] pas de pesée Garmin pour %s", date)
        return None

    poids_kg = round(weight_g / 1000, 1)
    masse_grasse_pct = entry.get("bodyFat")

    return {
        "date": date,
        "poids_kg": poids_kg,
        "masse_grasse_pct": masse_grasse_pct,
    }


def sync_weight(client: Garmin, date: str) -> bool:
    record = fetch_weight_for_date(client, date)
    if record is None:
        return False

    poids_kg = record["poids_kg"]
    masse_grasse_pct = record["masse_grasse_pct"]

    if masse_grasse_pct is not None:
        logger.info("[POIDS] %s → %s kg (MG: %s%%)", date, poids_kg, masse_grasse_pct)
    else:
        logger.info("[POIDS] %s → %s kg", date, poids_kg)

    return upsert_weight(date, poids_kg, masse_grasse_pct)
