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

import { addMeal, deleteMeal, addActivity, deleteActivity, addWeight, deleteWeight, saveProfile } from '../db';
import {
  pushMeal,
  deleteMealRemote,
  pushActivity,
  deleteActivityRemote,
  pushWeight,
  deleteWeightRemote,
  pushProfile,
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
