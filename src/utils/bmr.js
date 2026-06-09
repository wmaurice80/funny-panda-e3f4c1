// src/utils/bmr.js

/** Facteurs protéines en g/kg de poids corporel */
export const PROTEIN_FACTORS = {
  sedentaire: 0.8,
  leger: 1.2,
  modere: 1.6,
  actif: 2.0,
  extreme: 2.2,
};

/**
 * Calcule l'objectif journalier de protéines en grammes.
 * Si profile.masseGrasse est renseigné (> 0 et < 60), utilise la masse maigre (LBM)
 * avec un facteur fixe de 2.3 g/kg LBM (recommandation musculation intense).
 * Sinon, fallback sur poids total × facteur d'activité.
 * @param {{ poids: number, niveauActivite: string, objectif?: string, masseGrasse?: number }} profile
 * @returns {number} grammes de protéines par jour
 */
export function calculateProteinGoal(profile) {
  if (profile.masseGrasse && profile.masseGrasse > 0 && profile.masseGrasse < 60) {
    const lbm = profile.poids * (1 - profile.masseGrasse / 100);
    let goal = Math.round(lbm * 2.3);
    if (profile.objectif === 'prise') goal = Math.round(goal * 1.1); // +10% prise de masse
    return goal;
  }
  // Fallback : poids total × facteur activité
  const factor = PROTEIN_FACTORS[profile.niveauActivite] ?? 1.6;
  let goal = Math.round(profile.poids * factor);
  if (profile.objectif === 'prise') goal = Math.round(goal * 1.2);
  return goal;
}

/**
 * Facteurs d'activité hors sport (le sport est géré séparément via le toggle).
 * Calibrés sur la dépense quotidienne sans séance.
 */
export const ACTIVITY_FACTORS = {
  sedentaire: 1.2,   // ~2430 kcal — bureau toute la journée, quasi aucun mouvement
  leger:      1.3,   // ~2640 kcal — marche quotidienne, courses, debout parfois
  modere:     1.38,  // ~2800 kcal — télétravail actif, déplacements réguliers
  actif:      1.5,   // ~3040 kcal — travail physique léger ou très actif au quotidien
  extreme:    1.7,   // ~3450 kcal — travail physique intense (maçon, déménageur…)
};

/** Labels lisibles pour l'interface */
export const ACTIVITY_LABELS = {
  sedentaire: 'Sédentaire',
  leger: 'Légèrement actif',
  modere: 'Modérément actif',
  actif: 'Très actif',
  extreme: 'Extrêmement actif',
};

/**
 * Calcule l'âge à partir de la date de naissance ou retourne profile.age comme fallback.
 * @param {{ dateNaissance?: string, age?: number }} profile
 * @returns {number}
 */
export function getAge(profile) {
  if (profile.dateNaissance) {
    const today = new Date();
    const birth = new Date(profile.dateNaissance);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }
  return profile.age ?? 30;
}

/**
 * Calcule le BMR selon la formule Mifflin-St Jeor
 * @param {{ poids: number, taille: number, dateNaissance?: string, age?: number, sexe: 'homme'|'femme' }} profile
 * @returns {number} BMR en kcal/jour
 */
export function calculateBMR(profile) {
  const { poids, taille, sexe } = profile;
  const age = getAge(profile);
  const base = 10 * poids + 6.25 * taille - 5 * age;
  return sexe === 'homme' ? base + 5 : base - 161;
}

/**
 * Calcule le TDEE (dépense énergétique totale)
 * @param {number} bmr
 * @param {string} niveauActivite - clé de ACTIVITY_FACTORS
 * @returns {number} TDEE en kcal/jour
 */
export function calculateTDEE(bmr, niveauActivite) {
  const factor = ACTIVITY_FACTORS[niveauActivite] ?? 1.2;
  return Math.round(bmr * factor);
}

/**
 * Retourne le TDEE effectif : mesuré si renseigné, calculé sinon
 * @param {object} profile - { tdeeMesure?, niveauActivite, ... }
 * @param {number} bmr - BMR calculé
 * @returns {number} TDEE en kcal/jour
 */
export function getEffectiveTDEE(profile, bmr) {
  if (profile.tdeeMesure && profile.tdeeMesure > 0) {
    return Math.round(profile.tdeeMesure);
  }
  return calculateTDEE(bmr, profile.niveauActivite);
}

/**
 * Calcule la cible calorique journalière selon l'objectif et la vitesse.
 * Si objectif non fourni, retourne tdee (rétrocompatibilité).
 *
 * @param {number} tdee - TDEE calculé en kcal/jour
 * @param {'perte'|'maintien'|'prise'|undefined} objectif
 * @param {'lente'|'moderee'|'rapide'|undefined} vitesse
 * @returns {number} Cible calorique journalière en kcal
 */
export function calculateCible(tdee, objectif, vitesse) {
  if (!objectif || objectif === 'maintien') return tdee;

  const DELTA = {
    lente: 250,
    moderee: 500,
    rapide: 750,
  };

  const delta = DELTA[vitesse] ?? 250;

  if (objectif === 'perte') return tdee - delta;
  if (objectif === 'prise') {
    // La prise de masse n'a pas d'option "rapide" — on plafonne à modérée
    const safeDelta = vitesse === 'rapide' ? 500 : delta;
    return tdee + safeDelta;
  }

  return tdee;
}
