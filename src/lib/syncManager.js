// src/lib/syncManager.js
//
// M-Sprint 2B — Gestionnaire de synchronisation dual-write.
// Chaque fonction :
//   1. Écrit en IndexedDB via db.js (await — bloque jusqu'au succès local)
//   2. Lance la sync Supabase en arrière-plan (fire-and-forget, pas d'await)
//   3. Retourne le résultat IndexedDB immédiatement
//
// Le mode offline reste entièrement fonctionnel : les erreurs Supabase sont
// silencieusement ignorées (.catch(() => {})) et n'empêchent pas l'écriture locale.

import { addMeal, deleteMeal, addActivity, deleteActivity, addWeight, deleteWeight, saveProfile, putGarminDaily, getActivitiesForDate } from '../db';
import {
  pushMeal,
  deleteMealRemote,
  pushActivity,
  deleteActivityRemote,
  pushWeight,
  deleteWeightRemote,
  pushProfile,
  pullGarminDaily,
  pullGarminActivitiesForDates,
} from './supabaseDb';

// ── Profil ────────────────────────────────────────────────────────────────────

export async function syncedSaveProfile(profile) {
  const result = await saveProfile(profile);
  pushProfile(profile).catch(() => {});
  return result;
}

// ── Repas ─────────────────────────────────────────────────────────────────────

export async function syncedAddMeal(meal) {
  const id = await addMeal(meal);
  pushMeal({ ...meal, id }).catch(() => {});
  return id;
}

export async function syncedDeleteMeal(id) {
  await deleteMeal(id);
  deleteMealRemote(id).catch(() => {});
}

// ── Activités ─────────────────────────────────────────────────────────────────

export async function syncedAddActivity(activity) {
  const id = await addActivity(activity);
  pushActivity({ ...activity, id }).catch(() => {});
  return id;
}

export async function syncedDeleteActivity(id) {
  await deleteActivity(id);
  deleteActivityRemote(id).catch(() => {});
}

// ── Poids ─────────────────────────────────────────────────────────────────────

export async function syncedAddWeight(weight) {
  const id = await addWeight(weight);
  pushWeight(weight).catch(() => {});
  return id;
}

export async function syncedDeleteWeight(id) {
  await deleteWeight(id);
  deleteWeightRemote(id).catch(() => {}); // par date
}

// ── Garmin Daily ──────────────────────────────────────────────────────────────

/**
 * Télécharge les données garmin_daily depuis Supabase et les stocke dans IndexedDB.
 * À appeler au login (fire-and-forget possible, mais await conseillé pour que les stats
 * soient disponibles dès le premier rendu de la page Stats).
 *
 * @param {string} userId - L'identifiant Supabase de l'utilisateur
 */
export async function syncGarminDaily(userId) {
  try {
    const rows = await pullGarminDaily(userId);
    await Promise.all(rows.map(row => putGarminDaily(row)));
  } catch (err) {
    console.warn('[syncManager] syncGarminDaily', err.message);
  }
}

/**
 * Tire les activités importées par Garmin depuis Supabase et les insère dans IndexedDB
 * si elles n'existent pas encore localement (dédup par date + note).
 * @param {string} userId
 * @param {string[]} dates - dates syncées ['YYYY-MM-DD', ...]
 */
export async function syncGarminActivities(userId, dates) {
  try {
    const remoteActivities = await pullGarminActivitiesForDates(userId, dates);
    const localByDate = {};
    await Promise.all(dates.map(async (d) => {
      localByDate[d] = await getActivitiesForDate(d);
    }));
    for (const remote of remoteActivities) {
      const local = localByDate[remote.date] ?? [];
      const exists = local.some(a => a.note === remote.note);
      if (!exists) {
        // strip id/remoteId pour laisser IndexedDB auto-incrémenter
        const { id: _id, remoteId: _rid, ...data } = remote;
        await addActivity(data);
      }
    }
  } catch (err) {
    console.warn('[syncManager] syncGarminActivities', err.message);
  }
}
