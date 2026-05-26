export interface DailySummary {
  date: string
  tdeeKcal: number
  activeKcal: number
  bmrKcal: number
  steps: number
  restingHr: number | null
}

export interface GarminActivity {
  garminActivityId: number
  date: string
  heure: string
  type: string
  duree: number       // minutes
  caloriesBrulees: number
  note: string
}

export interface WeightRecord {
  date: string
  poidsKg: number
  masseGrassePct: number | null
}

export interface SyncReport {
  date: string
  tdeeOk: boolean
  activitiesOk: number
  activitiesErr: number
  weightOk: boolean
}
