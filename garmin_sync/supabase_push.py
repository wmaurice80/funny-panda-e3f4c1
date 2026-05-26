"""
Module de push vers Supabase pour le projet CalSnap.
Gère l'upsert des activités, la mise à jour du TDEE et l'upsert du poids.
Utilise la service role key pour bypasser les RLS policies.
"""

from __future__ import annotations

import logging
import time

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CALSNAP_USER_ID

logger = logging.getLogger(__name__)

client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------

_RETRY_DELAYS = (1, 2, 4)  # secondes (backoff exponentiel, 3 tentatives)


def _is_5xx(exc: Exception) -> bool:
    """Retourne True si l'exception correspond à une erreur serveur (5xx)."""
    msg = str(exc).lower()
    return any(code in msg for code in ("500", "502", "503", "504", "5xx", "server error"))


def _is_4xx(exc: Exception) -> bool:
    """Retourne True si l'exception correspond à une erreur client (4xx)."""
    msg = str(exc).lower()
    return any(
        code in msg for code in ("400", "401", "403", "404", "409", "422", "4xx", "client error")
    )


def _run_with_retry(operation_name: str, fn):
    """
    Exécute fn() avec 3 tentatives et backoff exponentiel sur erreurs 5xx.
    Erreurs 4xx → log immédiat + retourne False sans retry.
    Retourne True en cas de succès, False sinon.
    """
    for attempt, delay in enumerate(_RETRY_DELAYS, start=1):
        try:
            fn()
            return True
        except Exception as exc:
            if _is_4xx(exc):
                logger.error("[SUPABASE_ERROR 4xx] %s — %s", operation_name, exc)
                return False
            logger.warning(
                "[SUPABASE_ERROR] %s — tentative %d/%d — %s",
                operation_name,
                attempt,
                len(_RETRY_DELAYS),
                exc,
            )
            if attempt < len(_RETRY_DELAYS):
                time.sleep(delay)

    logger.error("[SUPABASE_ERROR] %s — échec après %d tentatives", operation_name, len(_RETRY_DELAYS))
    return False


# ---------------------------------------------------------------------------
# API publique
# ---------------------------------------------------------------------------


def upsert_activity(activity: dict) -> bool:
    """
    Upsert une activité dans la table `activities`.

    Payload attendu :
        {
            "user_id": str,           # CALSNAP_USER_ID
            "date": "YYYY-MM-DD",
            "heure": "HH:MM",         # extrait de startTimeLocal
            "type": str,              # course/velo/natation/marche/musculation/hiit/yoga/autre
            "duree": int,             # minutes (entier)
            "calories_brulees": int,
            "note": str,              # "Importé Garmin — [activityName]"
            "garmin_activity_id": int
        }

    Conflit sur (user_id, garmin_activity_id) → mise à jour de calories_brulees, duree, note.
    Retourne True si succès, False sinon.
    """
    garmin_id = activity.get("garmin_activity_id")
    operation = f"upsert_activity(garmin_activity_id={garmin_id})"

    def _do():
        (
            client.table("activities")
            .upsert(
                activity,
                on_conflict="user_id,garmin_activity_id",
            )
            .execute()
        )
        logger.info("[SUPABASE OK] %s", operation)

    success = _run_with_retry(operation, _do)
    if success:
        return True

    return False


def update_tdee(tdee_kcal: int) -> bool:
    """
    Met à jour le champ `tdee_mesure` dans la table `profiles` pour l'utilisateur courant.

    Ne fait rien si tdee_kcal <= 0.
    Retourne True si succès (ou skip), False en cas d'erreur.
    """
    if tdee_kcal <= 0:
        logger.info("[SKIP] update_tdee — valeur invalide : %d kcal", tdee_kcal)
        return True

    operation = f"update_tdee(tdee_kcal={tdee_kcal})"

    def _do():
        (
            client.table("profiles")
            .update({"tdee_mesure": tdee_kcal})
            .eq("id", CALSNAP_USER_ID)
            .execute()
        )
        logger.info("[SUPABASE OK] %s", operation)

    return _run_with_retry(operation, _do)


def upsert_weight(date: str, poids_kg: float, masse_grasse_pct: float | None = None) -> bool:
    """
    Upsert un enregistrement dans la table `weights`.

    Conflit sur UNIQUE(user_id, date) → mise à jour du poids.
    Si masse_grasse_pct est fourni, met aussi à jour `profiles.masse_grasse`.
    Retourne True si toutes les opérations ont réussi, False sinon.
    """
    operation = f"upsert_weight(date={date}, poids_kg={poids_kg})"

    def _do_weight():
        (
            client.table("weights")
            .upsert(
                {"user_id": CALSNAP_USER_ID, "date": date, "poids": poids_kg},
                on_conflict="user_id,date",
            )
            .execute()
        )
        logger.info("[SUPABASE OK] %s", operation)

    success = _run_with_retry(operation, _do_weight)
    if not success:
        return False

    if masse_grasse_pct is not None:
        op_mg = f"update_masse_grasse(date={date}, masse_grasse_pct={masse_grasse_pct})"

        def _do_masse_grasse():
            (
                client.table("profiles")
                .update({"masse_grasse": masse_grasse_pct})
                .eq("id", CALSNAP_USER_ID)
                .execute()
            )
            logger.info("[SUPABASE OK] %s", op_mg)

        return _run_with_retry(op_mg, _do_masse_grasse)

    return True
