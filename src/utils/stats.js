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
 * Chaque entrée : { day, date, ingested, proteines, burned, isSportDay }
 * burned = tdeeSport si activités ce jour, sinon tdeeMesure (sport géré via toggle)
 *
 * @param {number} year
 * @param {number} month     - 1..12
 * @param {number} tdeeMesure - TDEE jours de repos
 * @param {number} tdeeSport  - TDEE jours de sport (0 = non renseigné)
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
      const proteines = meals.reduce((s, m) => s + (m.totalProteines ?? 0), 0);
      const sport = acts.reduce((s, a) => s + (a.caloriesBrulees ?? 0), 0);
      const isSportDay = acts.length > 0;
      const isFuture = date > today;
      const burned = (isFuture && ingested === 0) ? 0 : tdee + sport;
      return { day, date, ingested, proteines, burned, isSportDay };
    });
  });

  return Promise.all(promises);
}

/**
 * Retourne le bilan cumulé du mois
 * { totalIngested, totalBurned, netBalance, fatKg }
 *
 * @param {number} year
 * @param {number} month     - 1..12
 * @param {number} tdeeMesure
 * @param {number} tdeeSport
 * @param {number} [cible]   - cible repos (si absent, utilise tdeeMesure)
 * @param {number} [cibleSport] - cible sport (si absent, utilise tdeeSport)
 */
export async function getMonthBilan(year, month, tdee, cible) {
  const cibleEffective = cible ?? tdee;
  const data = await getMonthlyData(year, month, tdee);
  const today = new Date().toISOString().slice(0, 10);

  const pastDays = data.filter(d => d.date <= today && d.ingested > 0);

  const totalIngested = pastDays.reduce((s, d) => s + d.ingested, 0);

  // Cible par jour = cible repos + sport de ce jour
  const totalBurned = pastDays.reduce((s, d) => {
    const sportJour = Math.max(0, d.burned - tdee);
    return s + cibleEffective + sportJour;
  }, 0);

  const netBalance = totalIngested - totalBurned;
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
  const lastDay = daysInMonth(year, month);
  const MOIS_COURT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  const m = MOIS_COURT[month - 1];
  const weeks = [
    { week: 1, label: `1–7 ${m}`,         days: data.filter(d => d.day >= 1  && d.day <= 7)  },
    { week: 2, label: `8–14 ${m}`,        days: data.filter(d => d.day >= 8  && d.day <= 14) },
    { week: 3, label: `15–21 ${m}`,       days: data.filter(d => d.day >= 15 && d.day <= 21) },
    { week: 4, label: `22–${lastDay} ${m}`, days: data.filter(d => d.day >= 22) },
  ];

  return weeks
    .map(({ week, label, days }) => {
      // Jours passés avec repas enregistrés uniquement (cohérent avec getMonthBilan)
      // Exclure les jours sans repas évite que les zéros écrasent la moyenne ingérée
      const pastDays = days.filter(d => d.date <= today && d.ingested > 0);
      if (pastDays.length === 0) return null;

      const totalIngested = pastDays.reduce((s, d) => s + d.ingested, 0);
      const totalBurned = pastDays.reduce((s, d) => s + d.burned, 0);

      const avgIngested = Math.round(totalIngested / pastDays.length);
      const avgBurned = Math.round(totalBurned / pastDays.length);
      const trend = avgIngested > avgBurned ? 'surplus' : 'deficit';

      // Calcul solde net de masse grasse : 7700 kcal = 1 kg de graisse
      const netBalance = totalIngested - totalBurned;
      const fatKg = Math.round((netBalance / 7700) * 100) / 100;

      return { week, label, avgIngested, avgBurned, trend, netBalance, fatKg };
    })
    .filter(Boolean);
}
