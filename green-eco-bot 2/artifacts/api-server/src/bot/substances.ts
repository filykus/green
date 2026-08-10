export type SubstanceClass = "F" | "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

export interface Substance {
  key: string;
  name: string;
  category: string;
  substanceClass: SubstanceClass;
  basePrice: number; // per unit, quick-sell price
}

export const CLASS_PRICES: Record<SubstanceClass, number> = {
  F: 150,
  E: 400,
  D: 900,
  C: 2000,
  B: 5000,
  A: 12000,
  S: 30000,
  SS: 80000,
  SSS: 220000,
};

export const CLASS_ORDER: SubstanceClass[] = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];

export const SUBSTANCES: Substance[] = [
  // Стимуляторы
  { key: "cocaine", name: "Кокаин", category: "Стимуляторы", substanceClass: "A", basePrice: CLASS_PRICES.A },
  { key: "amphetamine", name: "Фен / Амфетамин", category: "Стимуляторы", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "alpha_pvp", name: "Альфа-ПВП", category: "Стимуляторы", substanceClass: "S", basePrice: CLASS_PRICES.S },
  { key: "methamphetamine", name: "Метамфетамин", category: "Стимуляторы", substanceClass: "S", basePrice: CLASS_PRICES.S },
  { key: "mephedrone", name: "Мефедрон", category: "Стимуляторы", substanceClass: "A", basePrice: CLASS_PRICES.A },
  { key: "vint", name: "Винт", category: "Стимуляторы", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "crack", name: "Крэк", category: "Стимуляторы", substanceClass: "S", basePrice: CLASS_PRICES.S },
  { key: "dextroamphetamine", name: "Декстроамфетамин", category: "Стимуляторы", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "methylphenidate", name: "Метилфенидат", category: "Стимуляторы", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "cathinone", name: "Катинон", category: "Стимуляторы", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "mdpv", name: "МДПВ", category: "Стимуляторы", substanceClass: "SS", basePrice: CLASS_PRICES.SS },

  // Опиоиды
  { key: "heroin", name: "Героин", category: "Опиоиды", substanceClass: "SSS", basePrice: CLASS_PRICES.SSS },
  { key: "methadone", name: "Метадон", category: "Опиоиды", substanceClass: "SS", basePrice: CLASS_PRICES.SS },
  { key: "morphine", name: "Морфин", category: "Опиоиды", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "tramadol", name: "Трамадол", category: "Опиоиды", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "codeine", name: "Кодеин", category: "Опиоиды", substanceClass: "D", basePrice: CLASS_PRICES.D },
  { key: "oxycodone", name: "Оксикодон", category: "Опиоиды", substanceClass: "A", basePrice: CLASS_PRICES.A },
  { key: "fentanyl", name: "Фентанил", category: "Опиоиды", substanceClass: "SSS", basePrice: CLASS_PRICES.SSS },
  { key: "hydromorphone", name: "Гидроморфон", category: "Опиоиды", substanceClass: "SS", basePrice: CLASS_PRICES.SS },
  { key: "opium", name: "Опиум", category: "Опиоиды", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "buprenorphine", name: "Бупренорфин", category: "Опиоиды", substanceClass: "A", basePrice: CLASS_PRICES.A },

  // Психоделики
  { key: "lsd", name: "ЛСД", category: "Психоделики", substanceClass: "A", basePrice: CLASS_PRICES.A },
  { key: "psilocybin", name: "Псилоцибин", category: "Психоделики", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "mescaline", name: "Мескалин", category: "Психоделики", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "dmt", name: "ДМТ", category: "Психоделики", substanceClass: "S", basePrice: CLASS_PRICES.S },
  { key: "ayahuasca", name: "Аяуаска", category: "Психоделики", substanceClass: "S", basePrice: CLASS_PRICES.S },
  { key: "salvia", name: "Сальвия", category: "Психоделики", substanceClass: "D", basePrice: CLASS_PRICES.D },
  { key: "nbome", name: "NBOMe", category: "Психоделики", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "lsa", name: "LSA", category: "Психоделики", substanceClass: "C", basePrice: CLASS_PRICES.C },

  // Эмпатогены
  { key: "mdma", name: "МДМА", category: "Эмпатогены", substanceClass: "B", basePrice: CLASS_PRICES.B },

  // Делирианты
  { key: "scopolamine", name: "Скополамин", category: "Делирианты", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "atropine", name: "Атропин", category: "Делирианты", substanceClass: "D", basePrice: CLASS_PRICES.D },
  { key: "diphenhydramine", name: "Димедрол", category: "Делирианты", substanceClass: "E", basePrice: CLASS_PRICES.E },
  { key: "datura_seeds", name: "Семена дурмана", category: "Делирианты", substanceClass: "F", basePrice: CLASS_PRICES.F },

  // Депрессанты
  { key: "ghb", name: "GHB", category: "Депрессанты", substanceClass: "SS", basePrice: CLASS_PRICES.SS },
  { key: "barbiturates", name: "Барбитураты", category: "Депрессанты", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "phenobarbital", name: "Фенобарбитал", category: "Депрессанты", substanceClass: "D", basePrice: CLASS_PRICES.D },
  { key: "xanax", name: "Ксанакс", category: "Депрессанты", substanceClass: "B", basePrice: CLASS_PRICES.B },
  { key: "diazepam", name: "Диазепам", category: "Депрессанты", substanceClass: "C", basePrice: CLASS_PRICES.C },
  { key: "clonazepam", name: "Клоназепам", category: "Депрессанты", substanceClass: "C", basePrice: CLASS_PRICES.C },

  // Каннабиноиды
  { key: "cannabis", name: "Каннабис", category: "Каннабиноиды", substanceClass: "E", basePrice: CLASS_PRICES.E },
  { key: "hashish", name: "Гашиш", category: "Каннабиноиды", substanceClass: "D", basePrice: CLASS_PRICES.D },
  { key: "spice", name: "Спайс", category: "Каннабиноиды", substanceClass: "B", basePrice: CLASS_PRICES.B },

  // Редкие
  { key: "nutmeg", name: "Мускатный орех", category: "Редкие", substanceClass: "F", basePrice: CLASS_PRICES.F },
  { key: "kratom", name: "Кратом", category: "Редкие", substanceClass: "E", basePrice: CLASS_PRICES.E },
  { key: "bromo_dragonfly", name: "Стрекоза / Bromo-DragonFLY", category: "Редкие", substanceClass: "SS", basePrice: CLASS_PRICES.SS },
  { key: "salvia_x80", name: "Сальвия x80 экстракт", category: "Редкие", substanceClass: "SSS", basePrice: CLASS_PRICES.SSS },
  { key: "krokodil", name: "Крокодил ☠️", category: "Редкие", substanceClass: "SSS", basePrice: CLASS_PRICES.SSS },
];

export const SUBSTANCE_MAP = new Map<string, Substance>(
  SUBSTANCES.map((s) => [s.key, s])
);

// Harvest probability weights by class (lower class = more common)
export const HARVEST_WEIGHTS: Record<SubstanceClass, number> = {
  F: 28,
  E: 22,
  D: 18,
  C: 13,
  B: 9,
  A: 5,
  S: 2.5,
  SS: 1.5,
  SSS: 1,
};

export function getRandomSubstance(): Substance {
  // Build weighted pool
  const pool: Substance[] = [];
  for (const substance of SUBSTANCES) {
    const weight = Math.floor(HARVEST_WEIGHTS[substance.substanceClass] * 10);
    for (let i = 0; i < weight; i++) {
      pool.push(substance);
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function formatSubstanceLine(key: string, qty: number): string {
  const s = SUBSTANCE_MAP.get(key);
  if (!s) return `${key} — ${qty} шт.`;
  return `${s.name} (${s.substanceClass}) — ${qty} шт.`;
}

export function isClassAtLeast(cls: SubstanceClass, threshold: SubstanceClass): boolean {
  return CLASS_ORDER.indexOf(cls) >= CLASS_ORDER.indexOf(threshold);
}
