// src/db.js
import { openDB } from 'idb';

const DB_NAME = 'calsnap-db';
// Version 2 : ajout de l'index 'date' sur le store meals (pour getMealsForDate)
// Version 3 : ajout de l'index 'date' sur le store activities (pour getActivitiesForDate)
// Version 4 : ajout du champ optionnel 'categorie' sur les repas (pas de changement de structure IDB)
// Version 5 : ajout du store 'weights' pour le suivi du poids
const DB_VERSION = 5;

/** Ouvre (ou crée) la base IndexedDB */
function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meals')) {
          const mealsStore = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
          mealsStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('activities')) {
          db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
        }
      }
      if (oldVersion === 1) {
        // Migration v1 → v2 : ajouter l'index 'date' sur le store meals existant.
        const mealsStore = transaction.objectStore('meals');
        if (!mealsStore.indexNames.contains('date')) {
          mealsStore.createIndex('date', 'date', { unique: false });
        }
      }
      if (oldVersion < 3) {
        // Migration v2 → v3 : ajouter l'index 'date' sur le store activities existant.
        // Même pattern que la migration v1→v2 pour meals.
        const activitiesStore = transaction.objectStore('activities');
        if (!activitiesStore.indexNames.contains('date')) {
          activitiesStore.createIndex('date', 'date', { unique: false });
        }
      }
      // Migration v3 → v4 : le champ 'categorie' est optionnel sur les repas.
      // Aucun changement de structure IDB nécessaire — simple bump de version.

      // Migration v4 → v5 : ajout du store 'weights' pour le suivi du poids.
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('weights')) {
          const weightsStore = db.createObjectStore('weights', { keyPath: 'id', autoIncrement: true });
          weightsStore.createIndex('date', 'date', { unique: true });
        }
      }
    },
  });
}

// ─── PROFILE ────────────────────────────────────────────────────────────────

/** Lit le profil unique (id = 'user') */
export async function getProfile() {
  const db = await getDB();
  return db.get('profile', 'user');
}

/** Sauvegarde (crée ou remplace) le profil */
export async function saveProfile(data) {
  const db = await getDB();
  return db.put('profile', { ...data, id: 'user' });
}

/** Supprime le profil */
export async function deleteProfile() {
  const db = await getDB();
  return db.delete('profile', 'user');
}

// ─── MEALS ──────────────────────────────────────────────────────────────────

/** Retourne tous les repas */
export async function getMeals() {
  const db = await getDB();
  return db.getAll('meals');
}

/**
 * Ajoute un repas.
 * Structure attendue :
 * {
 *   date: 'YYYY-MM-DD',   // date du repas
 *   heure: '13:45',        // heure HH:MM
 *   aliments: [{ nom, calories, portion }],
 *   totalCalories: 450,
 *   note: 'Remarque courte' (optionnel),
 *   fiabilite: 'haute|moyenne|basse' (optionnel),
 *   categorie: 'petit-dejeuner|dejeuner|diner|collation|dessert' (optionnel),
 * }
 */
export async function addMeal(meal) {
  const db = await getDB();
  return db.add('meals', { ...meal, createdAt: Date.now() });
}

/**
 * Retourne tous les repas pour une date donnée (format 'YYYY-MM-DD').
 * Utilise l'index 'date' pour une recherche efficace.
 */
export async function getMealsForDate(date) {
  const db = await getDB();
  return db.getAllFromIndex('meals', 'date', date);
}

/** Met à jour un repas existant */
export async function updateMeal(meal) {
  const db = await getDB();
  return db.put('meals', meal);
}

/** Supprime un repas par id */
export async function deleteMeal(id) {
  const db = await getDB();
  return db.delete('meals', id);
}

/**
 * Retourne tous les repas groupés par date, triés du plus récent au plus ancien.
 * Ne nécessite pas de changement de DB_VERSION (lecture seule de meals).
 *
 * Retourne : [{ date: 'YYYY-MM-DD', meals: [...], totalCalories: number }, ...]
 */
export async function getMealsGroupedByDate() {
  const db = await getDB();
  const tous = await db.getAll('meals');

  // Grouper par date
  const map = new Map();
  for (const meal of tous) {
    const date = meal.date ?? 'inconnu';
    if (!map.has(date)) {
      map.set(date, []);
    }
    map.get(date).push(meal);
  }

  // Construire le tableau trié du plus récent au plus ancien
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // tri lexicographique DESC sur 'YYYY-MM-DD'
    .map(([date, meals]) => {
      // Trier les repas du jour par heure croissante
      meals.sort((x, y) => (x.heure ?? '').localeCompare(y.heure ?? ''));
      const totalCalories = meals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0);
      return { date, meals, totalCalories };
    });
}

// ─── ACTIVITIES ─────────────────────────────────────────────────────────────

/** Retourne toutes les activités */
export async function getActivities() {
  const db = await getDB();
  return db.getAll('activities');
}

/** Ajoute une activité */
export async function addActivity(activity) {
  const db = await getDB();
  return db.add('activities', { ...activity, createdAt: Date.now() });
}

/** Met à jour une activité existante */
export async function updateActivity(activity) {
  const db = await getDB();
  return db.put('activities', activity);
}

/** Supprime une activité par id */
export async function deleteActivity(id) {
  const db = await getDB();
  return db.delete('activities', id);
}

/**
 * Retourne toutes les activités pour une date donnée (format 'YYYY-MM-DD').
 * Utilise l'index 'date' pour une recherche efficace.
 */
export async function getActivitiesForDate(date) {
  const db = await getDB();
  return db.getAllFromIndex('activities', 'date', date);
}

// ─── WEIGHTS ────────────────────────────────────────────────────────────────

/**
 * Ajoute une pesée.
 * Si une pesée existe déjà pour cette date, elle est remplacée.
 * { date: 'YYYY-MM-DD', poids: number (kg) }
 */
export async function addWeight({ date, poids }) {
  const db = await getDB();
  // Vérifier si une pesée existe déjà pour cette date
  const existing = await db.getFromIndex('weights', 'date', date);
  if (existing) {
    return db.put('weights', { ...existing, poids });
  }
  return db.add('weights', { date, poids });
}

/** Retourne toutes les pesées, triées par date ASC */
export async function getWeights() {
  const db = await getDB();
  const all = await db.getAll('weights');
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

/** Supprime une pesée par id */
export async function deleteWeight(id) {
  const db = await getDB();
  return db.delete('weights', id);
}

/** Retourne la pesée la plus récente (ou undefined si aucune) */
export async function getLatestWeight() {
  const all = await getWeights();
  return all.length > 0 ? all[all.length - 1] : undefined;
}
