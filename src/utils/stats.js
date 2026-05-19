// src/utils/stats.js
import { getMealsForDate, getActivitiesForDate } from '../db';

/**
 * Formate une date en 'YYYY-MM-DD'
 */
function toISO(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Retourne le nombre de jours dans un mois donné
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Retourne un tableau d'entrées pour chaque jour du mois donné.
 * Chaque entrée : { day, date, ingested, burned }
 * burned = TDEE + calories sportives du jour
 *
 * @param {number} year
 * @param {number} month  - 1..12
 * @param {number} tdee   - dépense de base en kcal/jour
 */
export async function getMonthlyData(year, month, tdee) {
  const totalDays = daysInMonth(year, month);
  const today = new Date().toISOString().slice(0, 10);

  const promises = Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    const date = toISO(year, month, day);
    return Promise.all([
      getMealsForDate(date),
      getActivitiesForDate(date),
    ]).then(([meals, acts]) => {
      const ingested = meals.reduce((s, m) => s + (m.totalCalories ?? 0), 0);
      const sport = acts.reduce((s, a) => s + (a.caloriesBrulees ?? 0), 0);
      // Pour les jours futurs (pas encore passés), burned = 0 si pas de données
      const isFuture = date > today;
      const burned = isFuture && ingested === 0 && sport === 0 ? 0 : tdee + sport;
      return { day, date, ingested, burned: isFuture ? 0 : burned };
    });
  });

  return Promise.all(promises);
}

/**
 * Retourne le bilan cumulé du mois
 * { totalIngested, totalBurned, netBalance, fatKg }
 *
 * @param {number} year
 * @param {number} month  - 1..12
 * @param {number} tdee
 * @param {number} [cible] - cible calorique journalière (si absent, utilise tdee)
 */
export async function getMonthBilan(year, month, tdee, cible) {
  // La cible effective : si non fournie, on utilise tdee (rétrocompatibilité)
  const cibleEffective = cible ?? tdee;

  const data = await getMonthlyData(year, month, tdee);
  const today = new Date().toISOString().slice(0, 10);

  // On ne compte que les jours passés (ou aujourd'hui)
  const pastDays = data.filter(d => d.date <= today);

  // Ne compter que les jours avec au moins un repas ou une activité trackée
  const trackedDays = pastDays.filter(d => {
    const sport = tdee > 0 ? Math.max(0, d.burned - tdee) : 0;
    return d.ingested > 0 || sport > 0;
  });

  const totalIngested = trackedDays.reduce((s, d) => s + d.ingested, 0);

  const totalBurned = trackedDays.reduce((s, d) => {
    const sport = tdee > 0 ? Math.max(0, d.burned - tdee) : 0;
    return s + cibleEffective + sport;
  }, 0);

  const netBalance = totalIngested - totalBurned;
  // 1 kg de graisse ≈ 7700 kcal
  const fatKg = Math.round((netBalance / 7700) * 100) / 100;

  return { totalIngested, totalBurned, netBalance, fatKg };
}

/**
 * Retourne les tendances par semaine du mois.
 * [{ week, label, avgIngested, avgBurned, trend: 'surplus'|'deficit' }, ...]
 *
 * @param {number} year
 * @param {number} month  - 1..12
 * @param {number} tdee
 */
export async function getWeeklyTrends(year, month, tdee) {
  const data = await getMonthlyData(year, month, tdee);
  const today = new Date().toISOString().slice(0, 10);

  // Découper les jours en semaines (S1 = jours 1-7, S2 = 8-14, S3 = 15-21, S4 = 22+)
  const weeks = [
    { week: 1, label: 'S1', days: data.filter(d => d.day >= 1 && d.day <= 7) },
    { week: 2, label: 'S2', days: data.filter(d => d.day >= 8 && d.day <= 14) },
    { week: 3, label: 'S3', days: data.filter(d => d.day >= 15 && d.day <= 21) },
    { week: 4, label: 'S4', days: data.filter(d => d.day >= 22) },
  ];

  return weeks
    .map(({ week, label, days }) => {
      // Jours passés uniquement
      const pastDays = days.filter(d => d.date <= today);
      if (pastDays.length === 0) return null;

      const avgIngested = Math.round(
        pastDays.reduce((s, d) => s + d.ingested, 0) / pastDays.length
      );
      const avgBurned = Math.round(
        pastDays.reduce((s, d) => s + d.burned, 0) / pastDays.length
      );
      const trend = avgIngested > avgBurned ? 'surplus' : 'deficit';

      return { week, label, avgIngested, avgBurned, trend };
    })
    .filter(Boolean);
}
