import logging
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError
from supabase_push import update_tdee

logger = logging.getLogger(__name__)


def fetch_daily_summary(client: Garmin, date: str) -> dict | None:
    try:
        stats = client.get_stats(date)
    except GarminConnectAuthenticationError:
        raise
    except GarminConnectTooManyRequestsError:
        logger.warning("[RATE LIMIT] daily summary %s", date)
        raise
    except Exception as exc:
        logger.error("[GARMIN ERROR] daily summary %s : %s", date, exc)
        return None

    if not stats or not stats.get("totalKilocalories"):
        logger.warning("[GARMIN SKIP] daily summary absent pour %s", date)
        return None

    resting_hr = stats.get("restingHeartRate")

    return {
        "date": date,
        "tdee_kcal": int(stats["totalKilocalories"]),
        "active_kcal": int(stats.get("activeKilocalories", 0)),
        "bmr_kcal": int(stats.get("bmrKilocalories", 0)),
        "steps": int(stats.get("steps", 0)),
        "resting_hr": int(resting_hr) if resting_hr is not None else None,
    }


def sync_daily_summary(client: Garmin, date: str) -> bool:
    summary = fetch_daily_summary(client, date)
    if summary is None:
        return False

    tdee_kcal = summary["tdee_kcal"]
    logger.info("[TDEE] %s → %d kcal", date, tdee_kcal)
    return update_tdee(tdee_kcal)
