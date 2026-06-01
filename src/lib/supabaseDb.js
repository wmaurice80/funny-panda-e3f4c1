// src/lib/supabaseDb.js
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

/**
 * Upsert le profil de l'utilisateur connecté dans Supabase.
 * @param {Object} profile - Profil en camelCase (format IndexedDB)
 * @returns {Object|null} Le profil inséré/mis à jour, ou null en cas d'erreur
 */
export async function pushProfile(profile) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const payload = {
      id: userId,
      prenom: profile.prenom ?? null,
      poids: profile.poids ?? null,
      taille: profile.taille ?? null,
      age: profile.age ?? null,
      sexe: profile.sexe ?? null,
      niveau_activite: profile.niveauActivite ?? null,
      objectif: profile.objectif ?? null,
      vitesse_objectif: profile.vitesseObjectif ?? null,
      tdee_mesure: profile.tdeeMesure ?? null,
      tdee_sport: profile.tdeeSport ?? null,
      masse_grasse: profile.masseGrasse ?? null,
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Récupère le profil de l'utilisateur connecté depuis Supabase.
 * @returns {Object|null} Profil en camelCase, ou null si non trouvé/erreur
 */
export async function pullProfile() {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    if (!data) return null

    return {
      prenom: data.prenom,
      poids: data.poids,
      taille: data.taille,
      age: data.age,
      sexe: data.sexe,
      niveauActivite: data.niveau_activite,
      objectif: data.objectif,
      vitesseObjectif: data.vitesse_objectif,
      tdeeMesure: data.tdee_mesure,
      tdeeSport: data.tdee_sport,
      masseGrasse: data.masse_grasse,
    }
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// MEALS
// ---------------------------------------------------------------------------

/**
 * Insère un repas dans Supabase.
 * @param {Object} meal - Repas en camelCase (format IndexedDB), avec meal.id = local_id
 * @returns {Object|null} Le repas inséré, ou null en cas d'erreur
 */
export async function pushMeal(meal) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const payload = {
      user_id: userId,
      date: meal.date ?? null,
      heure: meal.heure ?? null,
      categorie: meal.categorie ?? null,
      aliments: meal.aliments ?? null,
      total_calories: meal.totalCalories ?? null,
      total_proteines: meal.totalProteines ?? null,
      note: meal.note ?? null,
      fiabilite: meal.fiabilite ?? null,
      local_id: meal.id ?? null,
    }

    const { data, error } = await supabase
      .from('meals')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Supprime un repas dans Supabase par son local_id.
 * @param {number|string} localId - L'identifiant local IndexedDB du repas
 * @returns {boolean|null} true si supprimé, null en cas d'erreur
 */
export async function deleteMealRemote(localId) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('user_id', userId)
      .eq('local_id', localId)

    if (error) throw error
    return true
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Récupère les repas d'une date donnée depuis Supabase.
 * @param {string} date - Date au format YYYY-MM-DD
 * @returns {Array} Tableau de repas en camelCase, ou [] en cas d'erreur
 */
export async function pullMealsForDate(date) {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('heure', { ascending: true })

    if (error) throw error
    return (data ?? []).map(formatMeal)
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return []
  }
}

/**
 * Récupère tous les repas de l'utilisateur depuis Supabase.
 * @returns {Array} Tableau de repas en camelCase, ou [] en cas d'erreur
 */
export async function pullAllMeals() {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('heure', { ascending: true })

    if (error) throw error
    return (data ?? []).map(formatMeal)
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return []
  }
}

/** Convertit un repas Supabase (snake_case) en camelCase. */
function formatMeal(row) {
  return {
    id: row.local_id,
    remoteId: row.id,
    date: row.date,
    heure: row.heure,
    categorie: row.categorie,
    aliments: row.aliments,
    totalCalories: row.total_calories,
    totalProteines: row.total_proteines,
    note: row.note,
    fiabilite: row.fiabilite,
  }
}

// ---------------------------------------------------------------------------
// ACTIVITIES
// ---------------------------------------------------------------------------

/**
 * Insère une activité dans Supabase.
 * @param {Object} activity - Activité en camelCase (format IndexedDB), avec activity.id = local_id
 * @returns {Object|null} L'activité insérée, ou null en cas d'erreur
 */
export async function pushActivity(activity) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const payload = {
      user_id: userId,
      date: activity.date ?? null,
      heure: activity.heure ?? null,
      type: activity.type ?? null,
      duree: activity.duree ?? null,
      calories_brulees: activity.caloriesBrulees ?? null,
      note: activity.note ?? null,
      local_id: activity.id ?? null,
    }

    const { data, error } = await supabase
      .from('activities')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Supprime une activité dans Supabase par son local_id.
 * @param {number|string} localId - L'identifiant local IndexedDB de l'activité
 * @returns {boolean|null} true si supprimé, null en cas d'erreur
 */
export async function deleteActivityRemote(localId) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('user_id', userId)
      .eq('local_id', localId)

    if (error) throw error
    return true
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Récupère toutes les activités de l'utilisateur depuis Supabase.
 * @returns {Array} Tableau d'activités en camelCase, ou [] en cas d'erreur
 */
export async function pullAllActivities() {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('heure', { ascending: true })

    if (error) throw error
    return (data ?? []).map(formatActivity)
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return []
  }
}

/** Convertit une activité Supabase (snake_case) en camelCase. */
function formatActivity(row) {
  return {
    id: row.local_id,
    remoteId: row.id,
    date: row.date,
    heure: row.heure,
    type: row.type,
    duree: row.duree,
    caloriesBrulees: row.calories_brulees,
    note: row.note,
  }
}

// ---------------------------------------------------------------------------
// WEIGHTS
// ---------------------------------------------------------------------------

/**
 * Upsert une pesée dans Supabase (contrainte UNIQUE sur user_id + date).
 * @param {Object} weight - { date: string, poids: number }
 * @returns {Object|null} La pesée insérée/mise à jour, ou null en cas d'erreur
 */
export async function pushWeight(weight) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const payload = {
      user_id: userId,
      date: weight.date,
      poids: weight.poids,
    }

    const { data, error } = await supabase
      .from('weights')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Supprime la pesée d'une date donnée pour l'utilisateur connecté.
 * @param {string} date - Date au format YYYY-MM-DD
 * @returns {boolean|null} true si supprimé, null en cas d'erreur
 */
export async function deleteWeightRemote(date) {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const { error } = await supabase
      .from('weights')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)

    if (error) throw error
    return true
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return null
  }
}

/**
 * Récupère toutes les pesées de l'utilisateur, triées par date ASC.
 * @returns {Array} Tableau de pesées { date, poids }, ou [] en cas d'erreur
 */
export async function pullAllWeights() {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('weights')
      .select('date, poids')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (error) throw error
    return data ?? []
  } catch (error) {
    console.warn('[supabaseDb]', error.message)
    return []
  }
}

// ---------------------------------------------------------------------------
// GARMIN DAILY
// ---------------------------------------------------------------------------

/**
 * Récupère les 90 derniers jours de données Garmin pour l'utilisateur connecté.
 * @param {string} userId - L'identifiant Supabase de l'utilisateur
 * @returns {Array} Tableau de { date, total_kcal, active_kcal, bmr_kcal, steps }, ou [] en cas d'erreur
 */
export async function pullGarminDaily(userId) {
  const { data, error } = await supabase
    .from('garmin_daily')
    .select('date, total_kcal, active_kcal, bmr_kcal, steps')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(90)
  if (error) throw error
  return data ?? []
}
