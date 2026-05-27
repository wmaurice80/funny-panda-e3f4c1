import logging

from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

from config import CALSNAP_USER_ID
from supabase_push import upsert_activity

logger = logging.getLogger(__name__)

ACTIVITY_TYPE_MAP = {
    "running": "course",
    "trail_running": "course",
    "cycling": "velo",
    "indoor_cycling": "velo",
    "road_biking": "velo",
    "swimming": "natation",
    "lap_swimming": "natation",
    "open_water_swimming": "natation",
    "walking": "marche",
    "hiking": "marche",
    "strength_training": "musculation",
    "fitness_equipment": "musculation",
    "hiit": "hiit",
    "cardio_training": "hiit",
    "yoga": "yoga",
    "pilates": "yoga",
}


def map_activity_type(garmin_type_key: str) -> str:
    """Retourne le type CalSnap correspondant au type Garmin, ou 'autre' si absent."""
    return ACTIVITY_TYPE_MAP.get(garmin_type_key, "autre")


def fetch_activities_for_date(client: Garmin, date: str) -> list[dict]:
    """
    Récupère et normalise les activités Garmin pour une date donnée (format YYYY-MM-DD).
    Retourne une liste de dicts normalisés (peut être vide).
    """
    raw_activities = client.get_activities_by_date(date, date)
    activities = []

    for raw in raw_activities:
        start_time_local = raw.get("startTimeLocal")
        if not start_time_local:
            logger.warning(
                "[ACTIVITE] startTimeLocal absent pour l'activité %s — ignorée",
                raw.get("activityId"),
            )
            continue

        activity_type_key = (raw.get("activityType") or {}).get("typeKey", "")
        duration_seconds = raw.get("duration") or 0
        duree = max(int(duration_seconds) // 60, 1)

        activity = {
            "user_id": CALSNAP_USER_ID,
            "date": start_time_local[:10],
            "heure": start_time_local[11:16],
            "type": map_activity_type(activity_type_key),
            "duree": duree,
            "calories_brulees": int(raw.get("calories") or 0),
            "note": f"Importé Garmin — {raw.get('activityName', '')}",
            "garmin_activity_id": int(raw.get("activityId")),
        }
        activities.append(activity)

    return activities


def sync_activities(client: Garmin, date: str) -> tuple[int, int]:
    """
    Synchronise les activités Garmin du jour donné vers Supabase.
    Retourne (insérées_ou_mises_à_jour, erreurs).
    """
    try:
        activities = fetch_activities_for_date(client, date)
    except GarminConnectAuthenticationError:
        raise
    except GarminConnectTooManyRequestsError:
        logger.error("[RATE LIMIT] Trop de requêtes Garmin pour les activités %s", date)
        raise
    except Exception as exc:
        logger.error("[GARMIN ERROR] activités %s : %s", date, exc)
        return (0, 0)

    ok = 0
    err = 0

    for activity in activities:
        logger.info(
            "[ACTIVITE] %s → %s %dmin %dkcal",
            activity["date"],
            activity["type"],
            activity["duree"],
            activity["calories_brulees"],
        )
        success = upsert_activity(activity)
        if success:
            ok += 1
        else:
            err += 1

    logger.info("[ACTIVITES] %s → %d OK / %d erreurs", date, ok, err)
    return (ok, err)
