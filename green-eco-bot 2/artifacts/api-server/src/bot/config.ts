export type JobType = "office" | "loader" | "garbage" | "cleaner" | "cashier";
export type PoliceRank = "F" | "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

export interface JobConfig {
  key: JobType;
  name: string;
  emoji: string;
  description: string;
  salaryPerShift: number;
  shiftIntervalHours: number; // how often a shift confirmation is sent
  shiftExpiryHours: number;   // how long user has to confirm
}

export const JOBS: Record<JobType, JobConfig> = {
  office: {
    key: "office",
    name: "Офисный работник",
    emoji: "🖥️",
    description: "Стабильный доход, никаких рисков. Раз в несколько часов подтверди присутствие.",
    salaryPerShift: 80,
    shiftIntervalHours: 4,
    shiftExpiryHours: 2,
  },
  loader: {
    key: "loader",
    name: "Грузчик",
    emoji: "📦",
    description: "Физический труд, доход выше среднего. Подтверди выполнение смены.",
    salaryPerShift: 150,
    shiftIntervalHours: 3,
    shiftExpiryHours: 2,
  },
  garbage: {
    key: "garbage",
    name: "Мусорщик",
    emoji: "🗑️",
    description: "Регулярные рейсы по вывозу мусора. Средний+ доход без заморочек.",
    salaryPerShift: 120,
    shiftIntervalHours: 5,
    shiftExpiryHours: 2,
  },
  cleaner: {
    key: "cleaner",
    name: "Уборщик",
    emoji: "🧹",
    description: "Тихая и спокойная работа. Небольшой, но стабильный доход.",
    salaryPerShift: 50,
    shiftIntervalHours: 6,
    shiftExpiryHours: 2,
  },
  cashier: {
    key: "cashier",
    name: "Кассир",
    emoji: "💰",
    description: "Работа за кассой. Средний доход, чуть выше уборщика.",
    salaryPerShift: 100,
    shiftIntervalHours: 4,
    shiftExpiryHours: 2,
  },
};

export const REGULAR_JOBS = Object.values(JOBS);

// Police ranks
export const POLICE_RANKS: PoliceRank[] = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];

// Missions needed to advance FROM this rank to the next
export const RANK_MISSION_REQUIREMENTS: Record<PoliceRank, number> = {
  F: 8,
  E: 15,
  D: 25,
  C: 40,
  B: 60,
  A: 90,
  S: 130,
  SS: 180,
  SSS: 0, // max rank
};

export const POLICE_BASE_SALARY: Record<PoliceRank, number> = {
  F: 200,
  E: 300,
  D: 450,
  C: 600,
  B: 800,
  A: 1100,
  S: 1500,
  SS: 2000,
  SSS: 2800,
};

// Station upgrade multiplier on salary
export const STATION_SALARY_BONUS: Record<number, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.35,
  5: 1.5,
};

export const STATION_UPGRADE_COSTS: Record<number, number> = {
  2: 5000,
  3: 15000,
  4: 40000,
  5: 100000,
};

// Mission interval (hours) based on station level
export const MISSION_INTERVAL_HOURS: Record<number, number> = {
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 2,
};

// Police missions
export interface MissionConfig {
  key: string;
  name: string;
  description: string;
  baseReward: number;
  reputationBonus: number;
}

export const POLICE_MISSIONS: MissionConfig[] = [
  {
    key: "raid_stash",
    name: "Рейд по точке закладки",
    description: "Зачистка точки. Ликвидируй тайник с запрещёнными веществами.",
    baseReward: 400,
    reputationBonus: 2,
  },
  {
    key: "chase_dealer",
    name: "Погоня за закладчиком",
    description: "Поимка бегущего преступника. Не дай уйти!",
    baseReward: 600,
    reputationBonus: 3,
  },
  {
    key: "market_check",
    name: "Проверка рынка",
    description: "Рейд игрового рынка на предмет запрещённых товаров.",
    baseReward: 350,
    reputationBonus: 2,
  },
  {
    key: "protect_informant",
    name: "Защита информатора",
    description: "Прикрытие секретного агента. Не дай его раскрыть.",
    baseReward: 800,
    reputationBonus: 4,
  },
  {
    key: "clean_yard",
    name: "Операция «Чистый двор»",
    description: "Зачистка неблагополучного района. Полная нейтрализация угрозы.",
    baseReward: 1200,
    reputationBonus: 5,
  },
  {
    key: "hunt_top_dealer",
    name: "Охота на крупного барыгу",
    description: "⚠️ Редкая операция. Ликвидация лидера преступной группировки.",
    baseReward: 2500,
    reputationBonus: 10,
  },
];

// Dealer config
export const HARVEST_INTERVAL_HOURS = 6;

export const FARM_HARVEST_COUNT: Record<number, [number, number]> = {
  1: [1, 3],
  2: [2, 5],
  3: [4, 8],
  4: [7, 12],
  5: [10, 20],
};

export const FARM_UPGRADE_COSTS: Record<number, number> = {
  2: 8000,
  3: 25000,
  4: 80000,
  5: 200000,
};

// Worker hire cost per worker (leaflet)
export const WORKER_HIRE_COST = 3000;
// Workers give +40% profit multiplier on market sales
export const WORKER_MARKET_BONUS = 0.40;
// Quick sell is at 70% of base price
export const QUICK_SELL_RATE = 0.70;

// Dealer offer check interval and chance
export const DEALER_OFFER_COOLDOWN_HOURS = 24;
export const DEALER_OFFER_CHANCE = 0.015; // 1.5%

// Police unlock lawfulness requirement
export const POLICE_UNLOCK_LAWFULNESS = 30;
