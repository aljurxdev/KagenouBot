import AuroraBetaStyler from "@aurora/styler";
import CONSTANTS from "@garden/constants";
import SEEDS_DATA from "@garden/seeds";
import GEAR_DATA from "@garden/gear";
import EGGS_DATA from "@garden/eggs";
import PETS_DATA from "@garden/pets";
import COSMETICS_DATA from "@garden/cosmetics";
import MUTATIONS_DATA from "@garden/mutations";
import WEATHER_DATA from "@garden/weather";
import QUESTS_DATA from "@garden/quests";
import ACHIEVEMENTS_DATA from "@garden/achievements";
import TITLES_DATA from "@garden/titles";
import HONEY_DATA from "@garden/honey";
import CHORES_DATA from "@garden/chores";
import ABUSE_DATA from "@garden/abuse";
import DEV_DATA from "@garden/dev";
import REGISTRY from "@garden/subcommands";

const C: any = CONSTANTS;
const AB: any = ABUSE_DATA;
const DV: any = DEV_DATA;
const SEEDS: Record<string, any> = SEEDS_DATA as any;
const GEARS: Record<string, any> = GEAR_DATA as any;
const EGGS: Record<string, any> = EGGS_DATA as any;
const PETS: Record<string, any> = PETS_DATA as any;
const COSMETICS: Record<string, any> = COSMETICS_DATA as any;
const MUTATIONS: Record<string, any> = MUTATIONS_DATA as any;
const WEATHERS: Record<string, any> = WEATHER_DATA as any;
const QUEST_LIST = QUESTS_DATA as any[];
const ACH_LIST = ACHIEVEMENTS_DATA as any[];
const TITLE_LIST = TITLES_DATA as any[];
const HONEY_LIST = HONEY_DATA as any[];
const CHORE_LIST = CHORES_DATA as any[];
const REG: Record<string, { category: string; usage: string; desc: string; access: string }> = REGISTRY as any;

const DEV_UID: string = C.DEV_UID;
const RARITY: string[] = C.RARITY_ORDER;
const COL_USERS = "users";
const COL_MARKET = "garden_market";
const COL_WORLD = "garden_world";
const NO_REG_KEYS = ["register", "help", "commands", "search", "about", "ping", "version", "tips", "abuse.status"];
const INFO_PREFIXES = ["crop.", "mutation.", "variant.", "weather", "abuse.status"];
const KINDS = ["seeds", "gear", "eggs", "cosmetics"];
const KIND_LABEL: Record<string, string> = { seeds: "seed", gear: "gear", eggs: "egg", cosmetics: "cosmetic" };

interface CropEntry { seedName: string; plantedAt: number; growthTime: number; regrows: boolean; weightBoost?: number; forced?: string[] }
interface Fruit { crop: string; weight: number; mutations: string[]; variant: string; value: number; fav?: boolean }
interface PetEntry { id: string; name: string; nick?: string; rarity: string; level: number; xp: number; weight: number; fav?: boolean }
interface EggEntry { egg: string; placedAt: number; hatchTime: number }
interface SprinklerEntry { type: string; placedAt: number; until: number }
interface QuestEntry { metric: string; goal: number; base: number; sheckles: number; coins: number; xp: number; honey: number; desc: string; claimed: boolean }

interface Garden {
  name: string | null;
  bio: string;
  balance: number;
  honey: number;
  level: number;
  xp: number;
  prestige: number;
  prestigePoints: number;
  perm: { plots: number; backpack: number; growth: number; mutation: number; sell: number };
  expansions: number;
  backpackLevel: number;
  inventory: { seeds: Record<string, number>; gear: Record<string, number>; eggs: Record<string, number>; cosmetics: Record<string, number>; produce: Fruit[] };
  crops: CropEntry[];
  pets: PetEntry[];
  equippedPets: string[];
  petSlots: number;
  placedEggs: EggEntry[];
  eggSlots: number;
  sprinklers: SprinklerEntry[];
  decor: Record<string, number>;
  hive: { level: number; lastCollect: number };
  dex: { crops: Record<string, boolean>; mutations: Record<string, boolean>; pets: Record<string, boolean> };
  counters: Record<string, number>;
  cd: Record<string, number>;
  bought: Record<string, number>;
  quests: { date: string; list: Record<string, QuestEntry> };
  achievements: Record<string, boolean>;
  titles: string[];
  activeTitle?: string;
  friends: string[];
  friendRequests: string[];
  lastDaily: number;
  lastWeekly: number;
  streak: number;
  cashout: { day: string; coins: number };
  rank: Record<string, number>;
  disabled: boolean;
  created: number;
}

interface World { abuseFrom: number; abuseUntil: number; weatherOverride?: { name: string; from: number; until: number }; stockSalt: number }

interface Ctx {
  api: any;
  event: any;
  db: any;
  usersData: any;
  u: any;
  g: Garden;
  isDev: boolean;
  sid: string;
  tid: string;
  mid: string;
  key: string;
  rest: string[];
  now: number;
  send: (header: string, symbol: string, body: string) => Promise<void>;
  save: () => Promise<string>;
  onCd: (key: string, secs: number) => Promise<boolean>;
  col: (name: string) => any;
}

type Handler = (c: Ctx) => Promise<void>;
const H: Record<string, Handler> = {};
let WORLD: World = { abuseFrom: 0, abuseUntil: 0, stockSalt: 0 };

const rnd = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function fmt(n: number): string {
  n = Math.floor(Number(n) || 0);
  if (Math.abs(n) < 1e12) return n.toLocaleString("en-US");
  const u = ["T", "Qa", "Qi", "Sx", "Sp"];
  let v = n / 1e12, i = 0;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return v.toFixed(2) + u[i];
}
function bar(v: number, max: number, n = 10): string {
  const f = Math.max(0, Math.min(n, Math.floor((v / Math.max(1, max)) * n)));
  return "█".repeat(f) + "░".repeat(n - f);
}
function dur(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}
function weighted<T>(arr: T[], wf: (x: T) => number): T {
  const total = arr.reduce((a, b) => a + wf(b), 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= wf(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
}
function seededRng(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genId(): string { return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4); }
function rarityIdx(r: string): number { return RARITY.indexOf(r); }
function icon(r: string): string { return C.RARITY_ICON[r] || "⚪"; }
function isDevUser(id: string): boolean { return id === DEV_UID; }
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function styled(header: string, symbol: string, body: string): string {
  return AuroraBetaStyler.styleOutput({
    headerText: header, headerSymbol: symbol, headerStyle: "bold",
    bodyText: body, bodyStyle: "sansSerif",
    footerText: "Developed by: Aljur Pogoy",
  });
}

function isAuthorized(senderID: string, isDev: boolean): boolean {
  const sid = senderID.toString();
  return isDev
    || (global.config.admins && global.config.admins.map(String).includes(sid))
    || (global.config.developers && global.config.developers.map(String).includes(sid));
}

function newGarden(): Garden {
  return {
    name: null, bio: "", balance: C.START_SHECKLES, honey: 0, level: 1, xp: 0, prestige: 0, prestigePoints: 0,
    perm: { plots: 0, backpack: 0, growth: 0, mutation: 0, sell: 0 }, expansions: 0, backpackLevel: 0,
    inventory: { seeds: { Carrot: 3 }, gear: {}, eggs: {}, cosmetics: {}, produce: [] },
    crops: [], pets: [], equippedPets: [], petSlots: C.PET_SLOTS_BASE, placedEggs: [], eggSlots: C.EGG_SLOTS_BASE,
    sprinklers: [], decor: {}, hive: { level: 1, lastCollect: Date.now() },
    dex: { crops: {}, mutations: {}, pets: {} }, counters: {}, cd: {}, bought: {},
    quests: { date: "", list: {} }, achievements: {}, titles: [], activeTitle: undefined,
    friends: [], friendRequests: [], lastDaily: 0, lastWeekly: 0, streak: 0, cashout: { day: "", coins: 0 },
    rank: {}, disabled: false, created: Date.now(),
  };
}

function normalize(raw: any): Garden {
  const b = newGarden();
  const g: any = { ...b, ...(raw || {}) };
  g.perm = { ...b.perm, ...(g.perm || {}) };
  g.inventory = { ...b.inventory, ...(g.inventory || {}) };
  for (const k of ["seeds", "gear", "eggs", "cosmetics"]) g.inventory[k] = g.inventory[k] || {};
  g.inventory.produce = g.inventory.produce || [];
  g.hive = { ...b.hive, ...(g.hive || {}) };
  g.dex = { crops: {}, mutations: {}, pets: {}, ...(g.dex || {}) };
  g.cashout = { ...b.cashout, ...(g.cashout || {}) };
  for (const k of ["crops", "pets", "equippedPets", "placedEggs", "sprinklers", "titles", "friends", "friendRequests"]) g[k] = g[k] || [];
  for (const k of ["decor", "counters", "cd", "bought", "achievements", "rank"]) g[k] = g[k] || {};
  g.quests = g.quests && g.quests.list ? g.quests : { date: "", list: {} };
  if (raw && raw.balance === undefined) g.balance = C.START_SHECKLES;
  return g as Garden;
}

async function loadUser(db: any, usersData: any, uid: string): Promise<{ uid: string; data: any; g: Garden }> {
  let data: any = (usersData && typeof usersData.get === "function" ? usersData.get(uid) : null) || {};
  const doc = await db.db(COL_USERS).findOne({ userId: uid });
  if (doc && doc.data) data = doc.data;
  return { uid, data, g: normalize(data.garden) };
}

async function saveUser(db: any, usersData: any, uid: string, data: any, g: Garden): Promise<void> {
  data.garden = g;
  if (usersData && typeof usersData.set === "function") usersData.set(uid, data);
  await db.db(COL_USERS).updateOne({ userId: uid }, { $set: { userId: uid, data } }, { upsert: true });
}

async function findGardener(db: any, usersData: any, name: string): Promise<{ uid: string; data: any; g: Garden } | null> {
  const t = (name || "").trim();
  if (!t) return null;
  for (const q of [t, t.replace(/_/g, " ")]) {
    const doc = await db.db(COL_USERS).findOne({ "data.garden.name": { $regex: `^${escapeRe(q)}$`, $options: "i" } });
    if (doc && doc.data && doc.data.garden && doc.data.garden.name) return { uid: doc.userId, data: doc.data, g: normalize(doc.data.garden) };
  }
  return null;
}

async function loadWorld(db: any): Promise<void> {
  const d = await db.db(COL_WORLD).findOne({ key: "world" });
  if (d) WORLD = { abuseFrom: d.abuseFrom || 0, abuseUntil: d.abuseUntil || 0, weatherOverride: d.weatherOverride || undefined, stockSalt: d.stockSalt || 0 };
}

async function saveWorld(db: any): Promise<void> {
  await db.db(COL_WORLD).updateOne({ key: "world" }, { $set: { key: "world", ...WORLD } }, { upsert: true });
}

function abuseActive(t: number): boolean { return t >= WORLD.abuseFrom && t < WORLD.abuseUntil; }

function weatherAt(t: number): string {
  const o = WORLD.weatherOverride;
  if (o && t >= o.from && t < o.until) return o.name;
  if (abuseActive(t)) {
    const slot = Math.floor(t / (AB.weatherRotateSecs * 1000));
    const r = seededRng("abuse" + slot);
    return AB.weathers[Math.floor(r() * AB.weathers.length)];
  }
  const slot = Math.floor(t / (C.WEATHER_SLOT * 1000));
  const r = seededRng("w" + slot);
  const names = Object.keys(WEATHERS);
  const total = names.reduce((a, n) => a + WEATHERS[n].weight, 0);
  let x = r() * total;
  for (const n of names) { x -= WEATHERS[n].weight; if (x <= 0) return n; }
  return names[0];
}

function weatherSpan(from: number, to: number): string[] {
  const set = new Set<string>();
  const n = Math.max(2, Math.min(14, Math.ceil((to - from) / (C.WEATHER_SLOT * 1000)) + 1));
  for (let i = 0; i < n; i++) set.add(weatherAt(from + ((to - from) * i) / (n - 1)));
  return Array.from(set);
}

function weatherEndsAt(t: number): number {
  const name = weatherAt(t);
  let k = t;
  const step = abuseActive(t) ? AB.weatherRotateSecs * 1000 : C.WEATHER_SLOT * 1000;
  for (let i = 0; i < 200; i++) { k = (Math.floor(k / step) + 1) * step; if (weatherAt(k) !== name) return k; }
  return k;
}

function petScale(p: PetEntry): number { return 1 + (p.level - 1) * C.PET.LEVEL_SCALE; }

function petAbility(p: PetEntry): { kind: string; value: number } {
  const a = PETS[p.name]?.ability || { kind: "sell", value: 0 };
  return { kind: a.kind, value: a.kind === "income" ? a.value * (1 + p.level * C.PET.INCOME_LEVEL_SCALE) : a.value * petScale(p) };
}

function equippedPets(g: Garden): PetEntry[] { return g.pets.filter(p => g.equippedPets.includes(p.id)); }

function petBonuses(g: Garden): Record<string, number> {
  const out: Record<string, number> = { sell: 0, growth: 0, mutation: 0, weight: 0, xp: 0, honey: 0, income: 0 };
  for (const p of equippedPets(g)) { const a = petAbility(p); out[a.kind] += a.value; }
  return out;
}

function gearPassive(g: Garden, key: string): number {
  let v = 0;
  for (const [n, d] of Object.entries(GEARS)) if (d.type === "passive" && (g.inventory.gear[n] || 0) > 0 && d.effect[key]) v += d.effect[key];
  return v;
}

function activeSprinklers(g: Garden, from: number, to: number): SprinklerEntry[] {
  return g.sprinklers.filter(s => s.placedAt < to && s.until > from);
}

function growthFactor(g: Garden, seedName: string, t: number, isDev: boolean): number {
  const w = WEATHERS[weatherAt(t)];
  let f = w ? w.growthMult : 1;
  f *= 1 - Math.min(0.6, petBonuses(g).growth + g.perm.growth);
  const sp = activeSprinklers(g, t, t + 1).reduce((a, s) => a + (GEARS[s.type]?.effect.growth || 0), 0);
  f *= 1 - Math.min(0.6, sp);
  if (abuseActive(t)) f *= AB.growthMult;
  if (isDev) f *= 0.02;
  return Math.max(0.01, f);
}

function growthTimeFor(g: Garden, seedName: string, t: number, isDev: boolean): number {
  return Math.max(1000, Math.floor(SEEDS[seedName].growthTime * 1000 * growthFactor(g, seedName, t, isDev)));
}

function mutationBonus(g: Garden, t: number): number {
  return petBonuses(g).mutation + g.perm.mutation + gearPassive(g, "mutation") + (abuseActive(t) ? AB.mutationBonus : 0);
}

function fruitBase(seedName: string, weight: number, muts: string[], variant: string): number {
  const s = SEEDS[seedName];
  const wf = Math.min(30, Math.pow(weight / s.baseWeight, 2));
  const vm = variant === "Gold" ? MUTATIONS.Gold.mult : variant === "Rainbow" ? MUTATIONS.Rainbow.mult : 1;
  const mm = 1 + muts.reduce((a, m) => a + ((MUTATIONS[m]?.mult || 1) - 1), 0);
  return Math.max(1, Math.floor(s.value * wf * vm * mm));
}

function friendBonus(g: Garden): number { return Math.min(C.FRIEND_BONUS_CAP, g.friends.length * C.FRIEND_SELL_BONUS); }

function sellMult(g: Garden, t: number): number {
  let m = (1 + g.prestige * C.PRESTIGE.BONUS) * (1 + petBonuses(g).sell + g.perm.sell + gearPassive(g, "sell")) * (1 + Math.min(C.LEVEL_SELL_BONUS_CAP, g.level * C.LEVEL_SELL_BONUS)) * (1 + friendBonus(g));
  if (abuseActive(t)) m *= AB.sellMult;
  return m;
}

function fruitSell(g: Garden, f: Fruit, t: number): number { return Math.floor(f.value * sellMult(g, t)); }

function rollFruit(g: Garden, seedName: string, crop: CropEntry, readyAt: number, t: number): Fruit {
  const s = SEEDS[seedName];
  let weight = s.baseWeight * (C.WEIGHT_RANGE[0] + Math.random() * (C.WEIGHT_RANGE[1] - C.WEIGHT_RANGE[0]));
  const sp = activeSprinklers(g, crop.plantedAt, readyAt);
  const size = sp.reduce((a, x) => a + (GEARS[x.type]?.effect.size || 0), 0);
  weight *= (1 + petBonuses(g).weight + gearPassive(g, "weight")) * (1 + (crop.weightBoost || 0)) * (1 + size);
  if (Math.random() < C.GIANT_CHANCE) weight *= C.GIANT_MULT;
  const bonus = mutationBonus(g, t);
  const muts: string[] = [...(crop.forced || [])];
  const cap = C.MUTATION_CHANCE_CAP;
  for (const wn of weatherSpan(crop.plantedAt, readyAt)) {
    const w = WEATHERS[wn];
    if (!w) continue;
    for (const m of w.mutations) {
      let ch = m.chance * (1 + bonus);
      if (m.name === "Shocked" && wn === "Thunderstorm") ch *= 1 + gearPassive(g, "thunder") * 0.5;
      if (!muts.includes(m.name) && Math.random() < Math.min(cap, ch)) muts.push(m.name);
    }
  }
  const largeCh = sp.reduce((a, x) => Math.max(a, GEARS[x.type]?.effect.large || 0), 0);
  if (largeCh && !muts.includes("Large") && Math.random() < largeCh) muts.push("Large");
  let variant = "Normal";
  const vb = 1 + bonus;
  if (Math.random() < C.VARIANT.Rainbow * vb) variant = "Rainbow";
  else if (Math.random() < C.VARIANT.Gold * vb) variant = "Gold";
  const final = muts.slice(0, C.MAX_MUTATIONS);
  return { crop: seedName, weight: Math.round(weight * 100) / 100, mutations: final, variant, value: fruitBase(seedName, weight, final, variant) };
}

function xpNeed(l: number): number { return Math.floor(C.XP_BASE * Math.pow(l, C.XP_EXP)); }

function addXp(g: Garden, n: number, t: number): number {
  let amt = n * (1 + petBonuses(g).xp);
  if (abuseActive(t)) amt *= AB.xpMult;
  g.xp += Math.floor(amt);
  let ups = 0;
  while (g.xp >= xpNeed(g.level)) { g.xp -= xpNeed(g.level); g.level += 1; g.balance += C.LEVEL_UP_REWARD * g.level; ups += 1; }
  return ups;
}

function bump(g: Garden, key: string, n = 1): void { g.counters[key] = (g.counters[key] || 0) + n; }

function backpackCap(g: Garden): number { return Math.min(C.BACKPACK_MAX, C.BACKPACK_BASE + g.backpackLevel * C.BACKPACK_STEP + g.perm.backpack); }
function plotCap(g: Garden): number { return Math.min(C.MAX_PLOTS, C.START_PLOTS + g.perm.plots + g.expansions * C.PLOTS_PER_EXPAND); }

function gardenScore(g: Garden): number {
  let s = 0;
  for (const [n, q] of Object.entries(g.decor)) s += (COSMETICS[n]?.score || 0) * q;
  for (const p of g.pets) s += rarityIdx(p.rarity) + 1;
  s += Object.keys(g.dex.crops).length * 2 + g.prestige * 20;
  return s;
}

function hivePerHour(g: Garden): number {
  const bees = equippedPets(g).filter(p => p.name.includes("Bee")).length;
  return C.HIVE.BASE * Math.pow(g.hive.level, C.HIVE.EXP) * (1 + bees * C.HIVE.BEE_BONUS + petBonuses(g).honey);
}

function hiveStored(g: Garden, t: number): number {
  const ph = hivePerHour(g);
  return Math.floor(Math.min(ph * C.HIVE.CAP_HOURS, ((t - g.hive.lastCollect) / 3600000) * ph));
}

function metric(g: Garden, k: string): number {
  switch (k) {
    case "level": return g.level;
    case "prestige": return g.prestige;
    case "pets": return g.pets.length;
    case "cropDex": return Object.keys(g.dex.crops).length;
    case "mutDex": return Object.keys(g.dex.mutations).length;
    case "score": return gardenScore(g);
    case "balance": return g.balance;
    case "hiveLevel": return g.hive.level;
    default: return g.counters[k] || 0;
  }
}

function titleLabel(id: string): string {
  if (id === "dev_abuser") return DV.title;
  return TITLE_LIST.find((t: any) => t.id === id)?.label || id;
}

function grantTitles(g: Garden): string[] {
  const out: string[] = [];
  for (const t of TITLE_LIST) if (!g.titles.includes(t.id) && metric(g, t.metric) >= t.min) { g.titles.push(t.id); out.push(t.id); }
  return out;
}

function titleLine(ids: string[]): string {
  return ids.length ? "\n\n🎖️ New Title: " + ids.map(titleLabel).join(", ") : "";
}

function pruneBought(g: Garden, t: number): void {
  const ws = Math.floor(t / (C.WEATHER_SLOT * 1000));
  for (const k of Object.keys(g.bought)) {
    const p = k.split(":");
    const cur = p[0] === "special" ? ws : Math.floor(t / (C.RESTOCK[p[0]] * 1000));
    if (Number(p[1]) < cur) delete g.bought[k];
  }
}

function updateRank(g: Garden): void {
  g.rank = {
    sheckles: Math.floor(g.balance), level: g.level, harvests: g.counters.harvests || 0, pets: g.pets.length,
    collection: Object.keys(g.dex.crops).length, prestige: g.prestige, score: gardenScore(g),
  };
}

function ensureQuests(g: Garden): void {
  const today = todayStr();
  if (g.quests.date === today && Object.keys(g.quests.list).length) return;
  rollQuests(g, today);
}

function rollQuests(g: Garden, today: string): void {
  g.quests = { date: today, list: {} };
  const pool = [...QUEST_LIST].sort(() => Math.random() - 0.5).slice(0, C.QUESTS_PER_DAY);
  for (const q of pool) g.quests.list[q.id] = { metric: q.metric, goal: q.goal, base: metric(g, q.metric), sheckles: q.sheckles, coins: q.coins, xp: q.xp, honey: q.honey || 0, desc: q.desc, claimed: false };
}

function questDone(g: Garden, q: QuestEntry): number { return Math.max(0, Math.min(q.goal, metric(g, q.metric) - q.base)); }

function matchName(map: Record<string, any>, q: string): string | null {
  const t = (q || "").toLowerCase().trim().replace(/_/g, " ");
  if (!t) return null;
  const keys = Object.keys(map);
  return keys.find(k => k.toLowerCase() === t) || keys.find(k => k.toLowerCase().startsWith(t)) || keys.find(k => k.toLowerCase().includes(t)) || null;
}

function findKind(q: string): { kind: string; name: string } | null {
  for (const k of KINDS) {
    const n = matchName(k === "seeds" ? SEEDS : k === "gear" ? GEARS : k === "eggs" ? EGGS : COSMETICS, q);
    if (n) return { kind: k, name: n };
  }
  return null;
}

function catalogOf(kind: string): Record<string, any> { return kind === "seeds" ? SEEDS : kind === "gear" ? GEARS : kind === "eggs" ? EGGS : COSMETICS; }

function kindFromWord(w: string): string | null {
  const t = (w || "").toLowerCase();
  if (["seed", "seeds"].includes(t)) return "seeds";
  if (["gear", "gears", "tool", "tools"].includes(t)) return "gear";
  if (["egg", "eggs"].includes(t)) return "eggs";
  if (["cosmetic", "cosmetics", "decor", "crate", "crates"].includes(t)) return "cosmetics";
  return null;
}

interface StockRow { name: string; qty: number; key: string; special: boolean }

function stockRows(kind: string, t: number, all: boolean): StockRow[] {
  const len = C.RESTOCK[kind] * 1000;
  const slot = Math.floor(t / len);
  const ab = abuseActive(t);
  const rows: StockRow[] = [];
  for (const [name, it] of Object.entries(catalogOf(kind))) {
    if (it.event || !it.stockChance && !all) continue;
    const r = seededRng(`${kind}:${slot}:${WORLD.stockSalt}:${name}`);
    const roll = r();
    const q = 1 + Math.floor(r() * it.maxStock);
    if (all || (ab && AB.stockAll) || roll < it.stockChance) rows.push({ name, qty: all ? 99 : ab ? q * AB.stockQtyMult : q, key: `${kind}:${slot}:${WORLD.stockSalt}:${name}`, special: false });
  }
  return rows;
}

function specialRows(t: number, all: boolean): (StockRow & { kind: string })[] {
  const slot = Math.floor(t / (C.WEATHER_SLOT * 1000));
  const w = weatherAt(t);
  const rows: (StockRow & { kind: string })[] = [];
  for (const kind of ["seeds", "eggs"]) {
    for (const [name, it] of Object.entries(catalogOf(kind))) {
      if (!it.event) continue;
      if (!all && !(it.event === w) && !abuseActive(t)) continue;
      const r = seededRng(`special:${slot}:${name}`);
      const q = 1 + Math.floor(r() * it.maxStock);
      rows.push({ name, qty: all ? 99 : q, key: `special:${slot}:${name}`, special: true, kind });
    }
  }
  return rows;
}

function remaining(g: Garden, row: StockRow, dev: boolean): number { return dev ? 99 : Math.max(0, row.qty - (g.bought[row.key] || 0)); }

function addInv(g: Garden, kind: string, name: string, qty: number): void {
  const inv: Record<string, number> = (g.inventory as any)[kind];
  inv[name] = (inv[name] || 0) + qty;
}

function takeInv(g: Garden, kind: string, name: string, qty: number): boolean {
  const inv: Record<string, number> = (g.inventory as any)[kind];
  if ((inv[name] || 0) < qty) return false;
  inv[name] -= qty;
  if (inv[name] <= 0) delete inv[name];
  return true;
}

function parseQty(tok: string | undefined, def = 1): number {
  if (!tok) return def;
  const n = parseInt(tok.replace(/,/g, ""), 10);
  return isNaN(n) || n < 1 ? def : n;
}

function parseAmount(tok: string | undefined, max: number): number {
  if (!tok) return NaN;
  if (tok.toLowerCase() === "all") return max;
  return parseInt(tok.replace(/,/g, ""), 10);
}

function resolveKey(args: string[]): { key: string; rest: string[] } {
  const a0 = (args[0] || "").toLowerCase();
  const a1 = (args[1] || "").toLowerCase();
  if (a0 && a1 && REG[`${a0}.${a1}`]) return { key: `${a0}.${a1}`, rest: args.slice(2) };
  if (a0 && REG[a0]) return { key: a0, rest: args.slice(1) };
  return { key: "", rest: args };
}

function pageOf<T>(arr: T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(arr.length / size));
  const p = Math.min(Math.max(1, page || 1), pages);
  return { items: arr.slice((p - 1) * size, p * size), page: p, pages };
}

function fruitLine(f: Fruit, i: number, g?: Garden, t?: number): string {
  const tags = [f.variant !== "Normal" ? f.variant : "", ...f.mutations].filter(Boolean).join(", ");
  const val = g && t ? fruitSell(g, f, t) : f.value;
  return `${i + 1}. ${f.fav ? "⭐ " : ""}${f.crop} ${f.weight}kg${tags ? ` [${tags}]` : ""} — ${fmt(val)}`;
}

function discoverFruit(g: Garden, f: Fruit): void {
  g.dex.crops[f.crop] = true;
  for (const m of f.mutations) g.dex.mutations[m] = true;
  if (f.variant !== "Normal") g.dex.mutations[f.variant] = true;
}

async function afford(c: Ctx, sheckles: number, honey = 0): Promise<boolean> {
  if (c.isDev) return true;
  if (c.g.balance < sheckles || c.g.honey < honey) {
    const need = [sheckles ? `${fmt(sheckles)} Sheckles` : "", honey ? `${fmt(honey)} honey` : ""].filter(Boolean).join(" + ");
    await c.send("Not Enough", "❌", `You need ${need}.\nYou have: ${fmt(c.g.balance)} Sheckles | ${fmt(c.g.honey)} honey`);
    return false;
  }
  return true;
}

function charge(c: Ctx, sheckles: number, honey = 0): void {
  if (c.isDev) return;
  c.g.balance -= sheckles; c.g.honey -= honey;
}

function coinsOf(c: Ctx): number { return Number(c.u.balance) || 0; }
function addCoins(c: Ctx, n: number): void { c.u.balance = coinsOf(c) + Math.floor(n); }

function lvlLine(ups: number, g: Garden): string { return ups ? `\n🎉 Level up! Now level ${g.level}` : ""; }

function applyDevBuff(g: Garden): void {
  g.level = DV.level; g.prestige = DV.prestige; g.balance = DV.sheckles; g.honey = DV.honey;
  for (const k of KINDS) for (const n of Object.keys(catalogOf(k))) (g.inventory as any)[k][n] = DV.itemQty;
  g.expansions = Math.ceil((C.MAX_PLOTS - C.START_PLOTS) / C.PLOTS_PER_EXPAND);
  g.backpackLevel = Math.ceil((C.BACKPACK_MAX - C.BACKPACK_BASE) / C.BACKPACK_STEP);
  g.petSlots = C.PET_SLOTS_MAX; g.eggSlots = C.EGG_SLOTS_MAX;
  g.hive.level = C.HIVE.MAX_LEVEL;
  for (const n of Object.keys(SEEDS)) g.dex.crops[n] = true;
  for (const n of Object.keys(MUTATIONS)) g.dex.mutations[n] = true;
  for (const [n, d] of Object.entries(PETS)) {
    g.dex.pets[n] = true;
    if (!g.pets.some(p => p.name === n)) g.pets.push({ id: genId() + g.pets.length, name: n, rarity: d.rarity, level: 50, xp: 0, weight: 1 });
  }
  for (const t of TITLE_LIST) if (!g.titles.includes(t.id)) g.titles.push(t.id);
  if (!g.titles.includes("dev_abuser")) g.titles.push("dev_abuser");
  if (!g.activeTitle) g.activeTitle = "dev_abuser";
}

function nameLine(g: Garden): string {
  return `${g.activeTitle ? titleLabel(g.activeTitle) + " " : ""}${g.name}`;
}

H["register"] = async (c) => {
  const g = c.g;
  if (g.name) { await c.send("Registration", "🛑", `You already have a garden named ${g.name}. Use /garden status.`); return; }
  const name = c.rest.join(" ").trim();
  if (name.length < C.NAME_MIN || name.length > C.NAME_MAX) { await c.send("Registration", "⚠️", `Usage: /garden register <name> (${C.NAME_MIN}-${C.NAME_MAX} characters)`); return; }
  if (await findGardener(c.db, c.usersData, name)) { await c.send("Registration", "❌", `The name "${name}" is already taken.`); return; }
  g.name = name;
  if (c.isDev) applyDevBuff(g);
  const nt = await c.save();
  await c.send("Registration", "🌱", `Welcome to your garden, ${name}!\n\n💰 ${fmt(g.balance)} Sheckles${c.isDev ? "" : "\n🥕 3x Carrot seeds"}\n🌾 ${plotCap(g)} plots\n\nNext steps:\n/garden stock\n/garden plant Carrot\n/garden status${c.isDev ? "\n\n⚡ Developer account: use /garden dashboard" : ""}${nt}`);
};

H["profile"] = async (c) => {
  const name = c.rest.join(" ").trim();
  let g = c.g, coins = coinsOf(c), bank = Number(c.u.bank) || 0, isD = c.isDev;
  if (name) {
    const t = await findGardener(c.db, c.usersData, name);
    if (!t) { await c.send("Profile", "❌", `Gardener "${name}" not found.`); return; }
    g = t.g; coins = Number(t.data.balance) || 0; bank = Number(t.data.bank) || 0; isD = isDevUser(t.uid);
  }
  await c.send("Garden Profile", "🌻",
    `${nameLine(g)}${isD ? " ⚡" : ""}\n${g.bio ? `"${g.bio}"\n` : ""}\n🎖️ Level ${g.level}${g.prestige ? ` | 🌟 Prestige ${g.prestige}` : ""}\n💰 Sheckles: ${fmt(g.balance)}\n🍯 Honey: ${fmt(g.honey)}\n💵 Coins: ${fmt(coins)} | 🏦 Bank: ${fmt(bank)}\n\n🌾 Plots: ${g.crops.length}/${plotCap(g)}\n🐾 Pets: ${g.pets.length}\n📖 Crops found: ${Object.keys(g.dex.crops).length}/${Object.keys(SEEDS).length}\n🏡 Score: ${fmt(gardenScore(g))}`);
};

H["status"] = async (c) => {
  const g = c.g;
  const w = weatherAt(c.now);
  const lines = g.crops.map((cr, i) => {
    const left = cr.plantedAt + cr.growthTime - c.now;
    return `${i + 1}. ${cr.seedName}${cr.regrows ? " ♻️" : ""} — ${left <= 0 ? "✅ Ready" : `${dur(left)} left`}`;
  });
  await c.send("Garden Status", "🌱", `${nameLine(g)}\n💰 ${fmt(g.balance)} Sheckles | 🍯 ${fmt(g.honey)}\n${WEATHERS[w].icon} Weather: ${w}${abuseActive(c.now) ? "\n⚡ ADMIN ABUSE ACTIVE" : ""}\n\n🌾 Plots: ${g.crops.length}/${plotCap(g)}\n${lines.join("\n") || "No crops planted. Use /garden plant <seed>."}\n\n🎒 Fruit: ${g.inventory.produce.length}/${backpackCap(g)}`);
};

H["balance"] = async (c) => {
  await c.send("Balance", "💰", `Sheckles: ${fmt(c.g.balance)}\nHoney: ${fmt(c.g.honey)}\n\nWallet: 💸 ${fmt(coinsOf(c))} coins\nBank: 🏦 ${fmt(Number(c.u.bank) || 0)} coins\n\nUse /garden cashout to turn Sheckles into coins.`);
};

H["stats"] = async (c) => {
  const g = c.g, k = g.counters;
  await c.send("Garden Stats", "📊", `Planted: ${fmt(k.plants || 0)}\nHarvested: ${fmt(k.harvests || 0)}\nSold earnings: ${fmt(k.soldEarned || 0)} Sheckles\nBought items: ${fmt(k.buys || 0)}\nEggs hatched: ${fmt(k.hatched || 0)}\nChores done: ${fmt(k.chores || 0)}\nMini games: ${fmt(k.games || 0)}\nCashed out: ${fmt(k.cashedCoins || 0)} coins\nFriends: ${g.friends.length}\nSell multiplier: x${sellMult(g, c.now).toFixed(2)}`);
};

H["rename"] = async (c) => {
  const nn = c.rest.join(" ").trim();
  if (nn.length < C.NAME_MIN || nn.length > C.NAME_MAX) { await c.send("Rename", "⚠️", `Usage: /garden rename <new name> (${C.NAME_MIN}-${C.NAME_MAX} characters)`); return; }
  if (await findGardener(c.db, c.usersData, nn)) { await c.send("Rename", "❌", "That name is already taken."); return; }
  if (!(await afford(c, C.RENAME_COST))) return;
  charge(c, C.RENAME_COST);
  const old = c.g.name;
  c.g.name = nn;
  await c.save();
  await c.send("Rename", "✅", `Renamed: ${old} → ${nn}${c.isDev ? "" : `\nCost: ${fmt(C.RENAME_COST)} Sheckles`}`);
};

H["bio"] = async (c) => {
  const text = c.rest.join(" ").trim();
  if (!text || text.length > C.BIO_MAX) { await c.send("Bio", "⚠️", `Usage: /garden bio <text> (max ${C.BIO_MAX} characters)`); return; }
  c.g.bio = text;
  await c.save();
  await c.send("Bio", "✅", `Bio updated:\n"${text}"`);
};

H["daily"] = async (c) => {
  const g = c.g;
  const gap = c.now - g.lastDaily;
  if (!c.isDev && gap < 86400000) { await c.send("Daily Reward", "⏳", `Already claimed. Come back in ${dur(86400000 - gap)}.`); return; }
  g.streak = gap < 172800000 && g.lastDaily ? g.streak + 1 : 1;
  g.lastDaily = c.now;
  const bonus = Math.min(g.streak, C.DAILY.streakCap) * C.DAILY.streakCoins;
  const coins = C.DAILY.coins + bonus;
  addCoins(c, coins);
  g.balance += C.DAILY.sheckles; g.honey += C.DAILY.honey;
  const seed = pick(Object.keys(SEEDS).filter(n => !SEEDS[n].event && rarityIdx(SEEDS[n].rarity) <= 2));
  addInv(g, "seeds", seed, 3);
  const nt = await c.save();
  await c.send("Daily Reward", "🎁", `Daily claimed!\n\n💵 +${fmt(coins)} coins\n💰 +${fmt(C.DAILY.sheckles)} Sheckles\n🍯 +${C.DAILY.honey} honey\n🌱 +3x ${seed} seeds\n🔥 Streak: ${g.streak} day(s)\n\n💸 Wallet: ${fmt(coinsOf(c))} coins${nt}`);
};

H["weekly"] = async (c) => {
  const g = c.g;
  const gap = c.now - g.lastWeekly;
  if (!c.isDev && gap < 604800000) { await c.send("Weekly Reward", "⏳", `Already claimed. Come back in ${dur(604800000 - gap)}.`); return; }
  g.lastWeekly = c.now;
  addCoins(c, C.WEEKLY.coins);
  g.balance += C.WEEKLY.sheckles; g.honey += C.WEEKLY.honey;
  const nt = await c.save();
  await c.send("Weekly Reward", "🎁", `Weekly claimed!\n\n💵 +${fmt(C.WEEKLY.coins)} coins\n💰 +${fmt(C.WEEKLY.sheckles)} Sheckles\n🍯 +${C.WEEKLY.honey} honey${nt}`);
};

H["level"] = async (c) => {
  const g = c.g;
  await c.send("Level", "🎖️", `Level ${g.level}\n[${bar(g.xp, xpNeed(g.level))}] ${fmt(g.xp)}/${fmt(xpNeed(g.level))} XP\nSell bonus: +${Math.round(Math.min(C.LEVEL_SELL_BONUS_CAP, g.level * C.LEVEL_SELL_BONUS) * 100)}%`);
};

H["rank"] = async (c) => {
  updateRank(c.g);
  const higher = await c.col(COL_USERS).find({ "data.garden.rank.sheckles": { $gt: c.g.rank.sheckles } }).limit(5000).toArray();
  await c.send("Rank", "🏅", `Your Sheckles: ${fmt(c.g.rank.sheckles)}\nRank: #${higher.length + 1}`);
};

H["title.list"] = async (c) => {
  const g = c.g;
  const all = [...TITLE_LIST.map((t: any) => t.id), ...(g.titles.includes("dev_abuser") ? ["dev_abuser"] : [])];
  const lines = all.map(id => {
    const t = TITLE_LIST.find((x: any) => x.id === id);
    const has = g.titles.includes(id);
    return `${has ? "✅" : "🔒"} ${titleLabel(id)} (${id})${has || !t ? "" : ` — ${fmt(Math.min(metric(g, t.metric), t.min))}/${fmt(t.min)}`}`;
  });
  await c.send("Titles", "🎖️", `Active: ${g.activeTitle ? titleLabel(g.activeTitle) : "None"}\n\n${lines.join("\n")}\n\nUse /garden title set <id>`);
};

H["title.set"] = async (c) => {
  const id = (c.rest[0] || "").toLowerCase();
  if (!c.g.titles.includes(id)) { await c.send("Titles", "🔒", "Invalid ID or title not unlocked. Use /garden title list."); return; }
  c.g.activeTitle = id;
  await c.save();
  await c.send("Titles", "✅", `Equipped: ${titleLabel(id)}`);
};

H["reset"] = async (c) => {
  if ((c.rest[0] || "").toLowerCase() !== "confirm") { await c.send("Reset", "⚠️", "This wipes your garden and cannot be undone.\nType /garden reset confirm to proceed."); return; }
  const name = c.g.name;
  Object.assign(c.g, newGarden());
  c.g.name = name;
  if (c.isDev) applyDevBuff(c.g);
  await c.save();
  await c.send("Reset", "✅", "Your garden has been reset. Bot coins were not touched.");
};

H["cashout"] = async (c) => {
  const g = c.g;
  let amt = parseAmount(c.rest[0], Math.floor(g.balance));
  if (isNaN(amt) || amt < 1) { await c.send("Cashout", "⚠️", "Usage: /garden cashout <amount/all>"); return; }
  if (!c.isDev) amt = Math.min(amt, Math.floor(g.balance));
  if (amt < C.CASHOUT_MIN) { await c.send("Cashout", "⚠️", `Minimum cashout is ${fmt(C.CASHOUT_MIN)} Sheckles.`); return; }
  const today = todayStr();
  if (g.cashout.day !== today) g.cashout = { day: today, coins: 0 };
  const left = C.CASHOUT_DAILY_CAP - g.cashout.coins;
  if (!c.isDev && left <= 0) { await c.send("Cashout", "🛑", `Daily cashout limit reached (${fmt(C.CASHOUT_DAILY_CAP)} coins). Resets at 00:00 UTC.`); return; }
  let coins = Math.floor(amt * C.COINS_PER_SHECKLE);
  if (!c.isDev && coins > left) { coins = left; amt = Math.ceil(coins / C.COINS_PER_SHECKLE); }
  if (coins < 1) { await c.send("Cashout", "⚠️", "That amount is too small."); return; }
  if (!c.isDev) g.balance -= amt;
  addCoins(c, coins);
  g.cashout.coins += coins;
  bump(g, "cashouts"); bump(g, "cashedCoins", coins);
  const nt = await c.save();
  await c.send("Cashout", "💵", `Cashed out ${fmt(amt)} Sheckles\n💵 +${fmt(coins)} coins\n\n💸 Wallet: ${fmt(coinsOf(c))} coins\n💰 Sheckles: ${fmt(g.balance)}\nDaily limit left: ${fmt(Math.max(0, C.CASHOUT_DAILY_CAP - g.cashout.coins))} coins${nt}`);
};

H["invest"] = async (c) => {
  const amt = parseAmount(c.rest[0], Math.floor(coinsOf(c)));
  if (isNaN(amt) || amt < 1) { await c.send("Invest", "⚠️", "Usage: /garden invest <coins>"); return; }
  if (amt > coinsOf(c)) { await c.send("Invest", "❌", `You only have ${fmt(coinsOf(c))} coins.`); return; }
  c.u.balance = coinsOf(c) - amt;
  const got = amt * C.COINS_PER_INVEST;
  c.g.balance += got;
  const nt = await c.save();
  await c.send("Invest", "📈", `Invested ${fmt(amt)} coins\n💰 +${fmt(got)} Sheckles\n\n💸 Wallet: ${fmt(coinsOf(c))} coins${nt}`);
};

H["rates"] = async (c) => {
  const today = todayStr();
  const used = c.g.cashout.day === today ? c.g.cashout.coins : 0;
  await c.send("Exchange Rates", "💱", `Cashout: 1 Sheckle = ${C.COINS_PER_SHECKLE} coin\nInvest: 1 coin = ${C.COINS_PER_INVEST} Sheckles\nMinimum cashout: ${fmt(C.CASHOUT_MIN)} Sheckles\nDaily cashout limit: ${fmt(C.CASHOUT_DAILY_CAP)} coins\nUsed today: ${fmt(used)} coins`);
};

H["earnings"] = async (c) => {
  const k = c.g.counters;
  await c.send("Earnings", "📈", `Sold fruit: ${fmt(k.soldEarned || 0)} Sheckles\nPet income: ${fmt(k.petIncome || 0)} Sheckles\nCashed out: ${fmt(k.cashedCoins || 0)} coins (${fmt(k.cashouts || 0)}x)\nMarket sales: ${fmt(k.marketEarned || 0)} Sheckles\nGames won: ${fmt(k.gameWins || 0)}\n\nCurrent value of your fruit: ${fmt(c.g.inventory.produce.reduce((a, f) => a + fruitSell(c.g, f, c.now), 0))} Sheckles`);
};

H["garden"] = async (c) => {
  const g = c.g;
  const cap = plotCap(g);
  const cells: string[] = [];
  for (let i = 0; i < cap; i++) {
    const cr = g.crops[i];
    cells.push(!cr ? "🟫" : cr.plantedAt + cr.growthTime <= c.now ? "✅" : "🌱");
  }
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(""));
  const decor = Object.values(g.decor).reduce((a, b) => a + b, 0);
  await c.send("Your Garden", "🏡", `${rows.join("\n")}\n\n🟫 empty  🌱 growing  ✅ ready\nPlots: ${g.crops.length}/${cap}\nDecor placed: ${decor} | Score: ${fmt(gardenScore(g))}\nSprinklers: ${activeSprinklers(g, c.now, c.now + 1).length} active`);
};

H["plots"] = async (c) => {
  const g = c.g;
  const cap = plotCap(g);
  const cost = Math.floor(C.EXPAND_BASE * Math.pow(C.EXPAND_GROWTH, g.expansions));
  await c.send("Plots", "🌾", `Used: ${g.crops.length}/${cap}\nFree: ${cap - g.crops.length}\nMax plots: ${C.MAX_PLOTS}\n${cap >= C.MAX_PLOTS ? "Fully expanded." : `Next expansion: +${C.PLOTS_PER_EXPAND} plots for ${fmt(cost)} Sheckles`}`);
};

H["growing"] = async (c) => {
  const lines = c.g.crops.filter(x => x.plantedAt + x.growthTime > c.now).map((cr, i) => `${i + 1}. ${cr.seedName} — ${dur(cr.plantedAt + cr.growthTime - c.now)} left`);
  await c.send("Growing", "🌱", lines.join("\n") || "Nothing is growing right now.");
};

H["ready"] = async (c) => {
  const lines = c.g.crops.map((cr, i) => ({ cr, i })).filter(x => x.cr.plantedAt + x.cr.growthTime <= c.now).map(x => `${x.i + 1}. ${x.cr.seedName}`);
  await c.send("Ready to Harvest", "✅", lines.length ? `${lines.join("\n")}\n\nUse /garden harvest` : "No crops are ready yet.");
};

H["timers"] = async (c) => {
  const rows = c.g.crops.map(cr => ({ cr, at: cr.plantedAt + cr.growthTime })).sort((a, b) => a.at - b.at).slice(0, 15);
  await c.send("Timers", "⏰", rows.map(x => `${x.cr.seedName} — ${x.at <= c.now ? "Ready" : dur(x.at - c.now)}`).join("\n") || "No crops planted.");
};

async function plantMany(c: Ctx, seedName: string, qty: number, batchLimit: boolean): Promise<void> {
  const g = c.g;
  const have = g.inventory.seeds[seedName] || 0;
  if (have < 1) { await c.send("Plant", "❌", `You have no ${seedName} seeds. Use /garden stock.`); return; }
  const free = plotCap(g) - g.crops.length;
  if (free < 1) { await c.send("Plant", "🛑", "No free plots. Harvest, shovel or /garden expand."); return; }
  const batch = batchLimit ? 5 + gearPassive(g, "batch") : 9999;
  const n = Math.min(qty, have, free, batch);
  const seed = SEEDS[seedName];
  for (let i = 0; i < n; i++) g.crops.push({ seedName, plantedAt: c.now, growthTime: growthTimeFor(g, seedName, c.now, c.isDev), regrows: !!seed.regrows });
  takeInv(g, "seeds", seedName, n);
  bump(g, "plants", n);
  const ups = addXp(g, n * 2, c.now);
  const nt = await c.save();
  const w = weatherAt(c.now);
  await c.send("Planted", "🌱", `Planted ${n}x ${seedName}${seed.regrows ? " ♻️" : ""}\n⏰ Ready in ${dur(g.crops[g.crops.length - 1].growthTime)}\n${WEATHERS[w].icon} Weather: ${w}\nPlots: ${g.crops.length}/${plotCap(g)}${n < qty ? `\n(Limited by ${n === have ? "seeds" : n === free ? "free plots" : "batch size"})` : ""}${lvlLine(ups, g)}${nt}`);
}

H["plant"] = async (c) => {
  const t = [...c.rest];
  let qty = 1;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const name = matchName(SEEDS, t.join(" "));
  if (!name) { await c.send("Plant", "⚠️", "Usage: /garden plant <seed> [qty]\nUse /garden inventory seeds to see your seeds."); return; }
  await plantMany(c, name, qty, true);
};

H["plant.all"] = async (c) => {
  const name = matchName(SEEDS, c.rest.join(" "));
  if (!name) { await c.send("Plant", "⚠️", "Usage: /garden plant all <seed>"); return; }
  await plantMany(c, name, 9999, false);
};

H["plant.random"] = async (c) => {
  const g = c.g;
  const owned = Object.keys(g.inventory.seeds).filter(n => SEEDS[n]);
  if (!owned.length) { await c.send("Plant", "❌", "You have no seeds."); return; }
  let free = plotCap(g) - g.crops.length;
  const limit = 5 + gearPassive(g, "batch");
  const counts: Record<string, number> = {};
  for (let i = 0; i < limit && free > 0; i++) {
    const avail = Object.keys(g.inventory.seeds).filter(n => SEEDS[n] && g.inventory.seeds[n] > 0);
    if (!avail.length) break;
    const n = pick(avail);
    g.crops.push({ seedName: n, plantedAt: c.now, growthTime: growthTimeFor(g, n, c.now, c.isDev), regrows: !!SEEDS[n].regrows });
    takeInv(g, "seeds", n, 1);
    counts[n] = (counts[n] || 0) + 1; free--;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) { await c.send("Plant", "🛑", "No free plots or no seeds."); return; }
  bump(g, "plants", total);
  addXp(g, total * 2, c.now);
  const nt = await c.save();
  await c.send("Planted", "🌱", `Planted ${total} random seeds:\n${Object.entries(counts).map(([n, q]) => `• ${q}x ${n}`).join("\n")}${nt}`);
};

function doHarvest(c: Ctx, only?: string): { fruits: Fruit[]; plots: number; full: boolean; ups: number } {
  const g = c.g, t = c.now;
  const out: Fruit[] = [];
  const keep: CropEntry[] = [];
  const cap = backpackCap(g);
  let full = false, plots = 0, xp = 0;
  for (const crop of g.crops) {
    const readyAt = crop.plantedAt + crop.growthTime;
    const seed = SEEDS[crop.seedName];
    if (!seed || readyAt > t || (only && crop.seedName !== only)) { keep.push(crop); continue; }
    const n = rnd(seed.fruits[0], seed.fruits[1]);
    if (g.inventory.produce.length + out.length + n > cap) { full = true; keep.push(crop); continue; }
    for (let i = 0; i < n; i++) { const f = rollFruit(g, crop.seedName, crop, readyAt, t); out.push(f); xp += C.RARITY_XP[seed.rarity]; }
    plots++;
    if (seed.regrows) { crop.plantedAt = t; crop.growthTime = growthTimeFor(g, crop.seedName, t, c.isDev); delete crop.weightBoost; delete crop.forced; keep.push(crop); }
  }
  g.crops = keep;
  for (const f of out) { g.inventory.produce.push(f); discoverFruit(g, f); }
  bump(g, "harvests", out.length);
  const ups = addXp(g, xp, t);
  return { fruits: out, plots, full, ups };
}

function harvestSummary(fruits: Fruit[]): string {
  const m: Record<string, { n: number; w: number; mut: number }> = {};
  for (const f of fruits) { const e = (m[f.crop] = m[f.crop] || { n: 0, w: 0, mut: 0 }); e.n++; e.w += f.weight; if (f.mutations.length || f.variant !== "Normal") e.mut++; }
  return Object.entries(m).map(([n, e]) => `• ${e.n}x ${n} (${e.w.toFixed(2)}kg)${e.mut ? ` ✨${e.mut} mutated` : ""}`).join("\n");
}

function bestFruitLine(fruits: Fruit[]): string {
  if (!fruits.length) return "";
  const b = [...fruits].sort((a, x) => x.value - a.value)[0];
  const tags = [b.variant !== "Normal" ? b.variant : "", ...b.mutations].filter(Boolean).join(", ");
  return `\n🏆 Best: ${b.crop} ${b.weight}kg${tags ? ` [${tags}]` : ""} — ${fmt(b.value)}`;
}

async function harvestFlow(c: Ctx, only: string | undefined, sell: boolean): Promise<void> {
  const r = doHarvest(c, only);
  if (!r.fruits.length) { await c.send("Harvest", "🌾", r.full ? "Your backpack is full! Sell fruit or /garden backpack upgrade." : "Nothing is ready to harvest yet.\nUse /garden timers."); return; }
  let extra = "";
  if (sell) {
    const total = r.fruits.reduce((a, f) => a + fruitSell(c.g, f, c.now), 0);
    const ids = new Set(r.fruits);
    c.g.inventory.produce = c.g.inventory.produce.filter(f => !ids.has(f));
    c.g.balance += total;
    bump(c.g, "soldEarned", total);
    extra = `\n💰 Sold for ${fmt(total)} Sheckles`;
  }
  const nt = await c.save();
  await c.send("Harvest", "🌾", `Harvested ${r.fruits.length} fruit from ${r.plots} plant(s):\n${harvestSummary(r.fruits)}${bestFruitLine(r.fruits)}${extra}${r.full ? "\n⚠️ Backpack full, some crops were left." : ""}\n🎒 Fruit: ${c.g.inventory.produce.length}/${backpackCap(c.g)}${lvlLine(r.ups, c.g)}${nt}`);
}

H["harvest"] = async (c) => { await harvestFlow(c, undefined, false); };
H["harvest.sell"] = async (c) => { await harvestFlow(c, undefined, true); };
H["harvest.crop"] = async (c) => {
  const name = matchName(SEEDS, c.rest.join(" "));
  if (!name) { await c.send("Harvest", "⚠️", "Usage: /garden harvest crop <seed>"); return; }
  await harvestFlow(c, name, false);
};

function plotIndex(c: Ctx, tok: string | undefined): number {
  const n = parseInt(tok || "");
  return isNaN(n) || n < 1 || n > c.g.crops.length ? -1 : n - 1;
}

function useCan(c: Ctx, crop: CropEntry): boolean {
  const left = crop.plantedAt + crop.growthTime - c.now;
  if (left <= 0) return false;
  crop.plantedAt -= Math.floor(left * C.WATERING_CAN_SPEEDUP);
  return true;
}

H["water"] = async (c) => {
  const i = plotIndex(c, c.rest[0]);
  if (i < 0) { await c.send("Water", "⚠️", "Usage: /garden water <plot #>"); return; }
  if (!takeInv(c.g, "gear", "Watering Can", 1)) { await c.send("Water", "❌", "You need a Watering Can. Use /garden buy gear Watering Can."); return; }
  const cr = c.g.crops[i];
  if (!useCan(c, cr)) { addInv(c.g, "gear", "Watering Can", 1); await c.send("Water", "✅", "That crop is already ready."); return; }
  await c.save();
  await c.send("Water", "💧", `Watered ${cr.seedName}. ${dur(cr.plantedAt + cr.growthTime - c.now)} left.`);
};

H["water.all"] = async (c) => {
  let n = 0;
  for (const cr of c.g.crops) {
    if (cr.plantedAt + cr.growthTime <= c.now) continue;
    if (!takeInv(c.g, "gear", "Watering Can", 1)) break;
    useCan(c, cr); n++;
  }
  if (!n) { await c.send("Water", "⚠️", "Nothing to water, or you have no Watering Cans."); return; }
  await c.save();
  await c.send("Water", "💧", `Watered ${n} crop(s) using ${n} Watering Can(s).`);
};

H["fertilize"] = async (c) => {
  const i = plotIndex(c, c.rest[0]);
  const fn = matchName(Object.fromEntries(Object.entries(GEARS).filter(([, d]) => d.type === "fertilizer")), c.rest.slice(1).join(" "));
  if (i < 0 || !fn) { await c.send("Fertilize", "⚠️", "Usage: /garden fertilize <plot #> <fertilizer>"); return; }
  if (!takeInv(c.g, "gear", fn, 1)) { await c.send("Fertilize", "❌", `You do not own ${fn}.`); return; }
  const cr = c.g.crops[i];
  cr.weightBoost = Math.min(3, (cr.weightBoost || 0) + GEARS[fn].effect.weight);
  await c.save();
  await c.send("Fertilize", "🧪", `Used ${fn} on ${cr.seedName}.\nFruit weight bonus: +${Math.round(cr.weightBoost * 100)}%`);
};

H["shovel"] = async (c) => {
  const i = plotIndex(c, c.rest[0]);
  if (i < 0) { await c.send("Shovel", "⚠️", "Usage: /garden shovel <plot #>"); return; }
  const cr = c.g.crops.splice(i, 1)[0];
  await c.save();
  await c.send("Shovel", "⛏️", `Removed ${cr.seedName} from plot ${i + 1}.`);
};

H["shovel.all"] = async (c) => {
  const name = matchName(SEEDS, c.rest.join(" "));
  if (!name) { await c.send("Shovel", "⚠️", "Usage: /garden shovel all <seed>"); return; }
  const before = c.g.crops.length;
  c.g.crops = c.g.crops.filter(x => x.seedName !== name);
  await c.save();
  await c.send("Shovel", "⛏️", `Removed ${before - c.g.crops.length}x ${name}.`);
};

H["expand"] = async (c) => {
  const g = c.g;
  if (plotCap(g) >= C.MAX_PLOTS) { await c.send("Expand", "🌟", "Your garden is fully expanded."); return; }
  const cost = Math.floor(C.EXPAND_BASE * Math.pow(C.EXPAND_GROWTH, g.expansions));
  if (!(await afford(c, cost))) return;
  charge(c, cost);
  g.expansions += 1;
  const nt = await c.save();
  await c.send("Expand", "🌾", `Garden expanded! +${C.PLOTS_PER_EXPAND} plots.\nPlots: ${g.crops.length}/${plotCap(g)}\nCost: ${fmt(cost)} Sheckles${nt}`);
};

function stockLines(kind: string, c: Ctx): string[] {
  const rows = stockRows(kind, c.now, c.isDev);
  const cat = catalogOf(kind);
  return rows.map(r => {
    const rem = remaining(c.g, r, c.isDev);
    return `${icon(cat[r.name].rarity)} ${r.name} x${rem} — ${fmt(cat[r.name].price)}`;
  });
}

function restockIn(kind: string, t: number): string {
  const len = C.RESTOCK[kind] * 1000;
  return dur((Math.floor(t / len) + 1) * len - t);
}

H["stock"] = async (c) => {
  const parts: string[] = [];
  for (const k of KINDS) parts.push(`${k.toUpperCase()} (restock ${restockIn(k, c.now)})\n${stockLines(k, c).join("\n") || "Empty"}`);
  const sp = specialRows(c.now, false);
  if (sp.length) parts.push(`EVENT (${weatherAt(c.now)})\n${sp.map(r => `${icon(catalogOf(r.kind)[r.name].rarity)} ${r.name} x${remaining(c.g, r, c.isDev)} — ${fmt(catalogOf(r.kind)[r.name].price)}`).join("\n")}`);
  await c.send("Shop Stock", "🛒", `${abuseActive(c.now) ? "⚡ ADMIN ABUSE: everything is in stock!\n\n" : ""}${parts.join("\n\n")}`);
};

for (const kind of KINDS) {
  H[`stock.${kind}`] = async (c) => { await c.send(`${kind[0].toUpperCase() + kind.slice(1)} Shop`, "🛒", `Restock in ${restockIn(kind, c.now)}\n\n${stockLines(kind, c).join("\n") || "Out of stock"}\n\nBuy: /garden buy ${KIND_LABEL[kind]} <item> <qty>`); };
}

H["stock.special"] = async (c) => {
  const sp = specialRows(c.now, c.isDev);
  await c.send("Event Shop", "🌙", `Weather: ${weatherAt(c.now)}\n\n${sp.length ? sp.map(r => `${icon(catalogOf(r.kind)[r.name].rarity)} ${r.name} (${KIND_LABEL[r.kind]}) x${remaining(c.g, r, c.isDev)} — ${fmt(catalogOf(r.kind)[r.name].price)}\n   Event: ${catalogOf(r.kind)[r.name].event}`).join("\n") : "No event items right now. Try again during Night, Blood Moon or Bee Swarm."}`);
};

H["restock"] = async (c) => {
  await c.send("Restock Timers", "⏰", `🌱 Seeds: ${restockIn("seeds", c.now)}\n🔧 Gear: ${restockIn("gear", c.now)}\n🥚 Eggs: ${restockIn("eggs", c.now)}\n🏡 Cosmetics: ${restockIn("cosmetics", c.now)}`);
};

function findRow(c: Ctx, kind: string, name: string): StockRow | null {
  const it = catalogOf(kind)[name];
  if (it.event) return specialRows(c.now, c.isDev).find(r => r.kind === kind && r.name === name) || null;
  return stockRows(kind, c.now, c.isDev).find(r => r.name === name) || null;
}

async function doBuy(c: Ctx, kindHint: string | null, tokens: string[], max: boolean): Promise<void> {
  const t = [...tokens];
  let qty = 1;
  if (!max && t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const q = t.join(" ");
  let hit: { kind: string; name: string } | null = null;
  if (kindHint) { const n = matchName(catalogOf(kindHint), q); if (n) hit = { kind: kindHint, name: n }; }
  else hit = findKind(q);
  if (!hit) { await c.send("Shop", "⚠️", "Item not found. Usage: /garden buy <seed/gear/egg/cosmetic> <item> <qty>\nSee /garden stock."); return; }
  const it = catalogOf(hit.kind)[hit.name];
  const row = findRow(c, hit.kind, hit.name);
  const rem = row ? remaining(c.g, row, c.isDev) : 0;
  if (!row || rem < 1) { await c.send("Shop", "📦", `${hit.name} is out of stock.\nRestock in ${it.event ? "when the event returns" : restockIn(hit.kind, c.now)}.`); return; }
  if (max) qty = c.isDev ? rem : Math.min(rem, Math.floor(c.g.balance / Math.max(1, it.price)));
  if (qty < 1) { await c.send("Shop", "❌", `You cannot afford ${hit.name} (${fmt(it.price)}).`); return; }
  if (qty > rem) qty = rem;
  const total = it.price * qty;
  if (!(await afford(c, total))) return;
  charge(c, total);
  if (!c.isDev) c.g.bought[row.key] = (c.g.bought[row.key] || 0) + qty;
  addInv(c.g, hit.kind, hit.name, qty);
  bump(c.g, "buys", qty);
  const nt = await c.save();
  await c.send("Purchase", "🛒", `Bought ${qty}x ${hit.name}\n💰 Cost: ${fmt(total)} Sheckles\n💰 Balance: ${fmt(c.g.balance)}\n📦 Stock left: ${rem - qty}${nt}`);
}

H["buy"] = async (c) => { await doBuy(c, null, c.rest, false); };
H["buy.seed"] = async (c) => { await doBuy(c, "seeds", c.rest, false); };
H["buy.gear"] = async (c) => { await doBuy(c, "gear", c.rest, false); };
H["buy.egg"] = async (c) => { await doBuy(c, "eggs", c.rest, false); };
H["buy.cosmetic"] = async (c) => { await doBuy(c, "cosmetics", c.rest, false); };
H["buy.max"] = async (c) => { await doBuy(c, null, c.rest, true); };

H["price"] = async (c) => {
  const hit = findKind(c.rest.join(" "));
  if (!hit) { await c.send("Price", "⚠️", "Usage: /garden price <item>"); return; }
  const it = catalogOf(hit.kind)[hit.name];
  const extra = hit.kind === "seeds" ? `\nGrows in ${dur(it.growthTime * 1000)} | base value ${fmt(it.value)}${it.regrows ? " | regrows" : ""}` : hit.kind === "eggs" ? `\nHatches in ${dur(it.hatchTime * 1000)}` : "";
  await c.send("Price", "🏷️", `${icon(it.rarity || "Common")} ${hit.name} (${KIND_LABEL[hit.kind]})\nPrice: ${fmt(it.price)} Sheckles${extra}`);
};

H["shop"] = async (c) => {
  await c.send("Shop", "🛒", `Restocks:\n🌱 Seeds ${restockIn("seeds", c.now)}\n🔧 Gear ${restockIn("gear", c.now)}\n🥚 Eggs ${restockIn("eggs", c.now)}\n🏡 Cosmetics ${restockIn("cosmetics", c.now)}\n\n/garden stock | stock seeds | stock gear | stock eggs | stock cosmetics | stock special\n/garden buy <type> <item> <qty>\n\n💰 You have ${fmt(c.g.balance)} Sheckles`);
};

function parseIndexes(tokens: string[], len: number): number[] {
  const out = new Set<number>();
  for (const tk of tokens.join(" ").split(/[\s,]+/)) {
    if (!tk) continue;
    const m = tk.match(/^(\d+)-(\d+)$/);
    if (m) { for (let i = parseInt(m[1]); i <= Math.min(len, parseInt(m[2])); i++) if (i >= 1) out.add(i - 1); }
    else { const n = parseInt(tk); if (!isNaN(n) && n >= 1 && n <= len) out.add(n - 1); }
  }
  return Array.from(out).sort((a, b) => a - b);
}

async function sellFruits(c: Ctx, list: Fruit[], title: string): Promise<void> {
  if (!list.length) { await c.send(title, "⚠️", "No fruit to sell. Favorites are protected."); return; }
  const g = c.g;
  const total = list.reduce((a, f) => a + fruitSell(g, f, c.now), 0);
  const set = new Set(list);
  g.inventory.produce = g.inventory.produce.filter(f => !set.has(f));
  g.balance += total;
  bump(g, "soldEarned", total); bump(g, "sold", list.length);
  const ups = addXp(g, Math.ceil(list.length / 2), c.now);
  const nt = await c.save();
  await c.send(title, "💰", `Sold ${list.length} fruit for ${fmt(total)} Sheckles\n${harvestSummary(list)}${bestFruitLine(list)}\n\n💰 Balance: ${fmt(g.balance)}\nSell multiplier: x${sellMult(g, c.now).toFixed(2)}${lvlLine(ups, g)}${nt}`);
}

const isMutated = (f: Fruit): boolean => f.mutations.length > 0 || f.variant !== "Normal";

H["sell"] = async (c) => {
  const idx = parseIndexes(c.rest, c.g.inventory.produce.length);
  if (!idx.length) { await c.send("Sell", "⚠️", "Usage: /garden sell <fruit #> (e.g. 1 3 5 or 2-6)\nSee /garden inventory produce."); return; }
  await sellFruits(c, idx.map(i => c.g.inventory.produce[i]).filter(f => !f.fav), "Sell");
};
H["sell.all"] = async (c) => { await sellFruits(c, c.g.inventory.produce.filter(f => !f.fav), "Sell All"); };
H["sell.crop"] = async (c) => {
  const name = matchName(SEEDS, c.rest.join(" "));
  if (!name) { await c.send("Sell", "⚠️", "Usage: /garden sell crop <seed>"); return; }
  await sellFruits(c, c.g.inventory.produce.filter(f => f.crop === name && !f.fav), `Sell ${name}`);
};
H["sell.mutated"] = async (c) => { await sellFruits(c, c.g.inventory.produce.filter(f => isMutated(f) && !f.fav), "Sell Mutated"); };
H["sell.value"] = async (c) => {
  const p = c.g.inventory.produce;
  const all = p.reduce((a, f) => a + fruitSell(c.g, f, c.now), 0);
  const unfav = p.filter(f => !f.fav).reduce((a, f) => a + fruitSell(c.g, f, c.now), 0);
  const mut = p.filter(f => isMutated(f) && !f.fav).reduce((a, f) => a + fruitSell(c.g, f, c.now), 0);
  await c.send("Fruit Value", "💰", `Fruit: ${p.length}\nTotal value: ${fmt(all)}\nSellable (no favorites): ${fmt(unfav)}\nMutated only: ${fmt(mut)}\nMultiplier: x${sellMult(c.g, c.now).toFixed(2)}`);
};

H["item.favorite"] = async (c) => {
  const idx = parseIndexes(c.rest, c.g.inventory.produce.length);
  if (!idx.length) { await c.send("Favorite", "⚠️", "Usage: /garden item favorite <fruit #>"); return; }
  idx.forEach(i => (c.g.inventory.produce[i].fav = true));
  await c.save();
  await c.send("Favorite", "⭐", `Protected ${idx.length} fruit from selling.`);
};
H["item.unfavorite"] = async (c) => {
  const idx = parseIndexes(c.rest, c.g.inventory.produce.length);
  if (!idx.length) { await c.send("Favorite", "⚠️", "Usage: /garden item unfavorite <fruit #>"); return; }
  idx.forEach(i => (c.g.inventory.produce[i].fav = false));
  await c.save();
  await c.send("Favorite", "✅", `Unprotected ${idx.length} fruit.`);
};
H["item.favorites"] = async (c) => {
  const rows = c.g.inventory.produce.map((f, i) => ({ f, i })).filter(x => x.f.fav).map(x => fruitLine(x.f, x.i, c.g, c.now));
  await c.send("Favorites", "⭐", rows.join("\n") || "No favorite fruit.");
};

function invLines(g: Garden, kind: string): string {
  const cat = catalogOf(kind);
  return Object.entries((g.inventory as any)[kind] as Record<string, number>).filter(([n, q]) => q > 0 && cat[n]).map(([n, q]) => `${icon(cat[n].rarity || "Common")} ${n} x${fmt(q)}`).join("\n");
}

H["inventory"] = async (c) => {
  const g = c.g;
  const cnt = (k: string) => Object.values((g.inventory as any)[k] as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  await c.send("Inventory", "🎒", `🌱 Seeds: ${fmt(cnt("seeds"))}\n🔧 Gear: ${fmt(cnt("gear"))}\n🥚 Eggs: ${fmt(cnt("eggs"))}\n🏡 Cosmetics: ${fmt(cnt("cosmetics"))}\n🍎 Fruit: ${g.inventory.produce.length}/${backpackCap(g)}\n🐾 Pets: ${g.pets.length}\n\n/garden inventory seeds | gear | eggs | cosmetics | produce | pets`);
};
for (const kind of KINDS) H[`inventory.${kind}`] = async (c) => { await c.send(`${kind[0].toUpperCase() + kind.slice(1)}`, "🎒", invLines(c.g, kind) || `You have no ${kind}.`); };
H["inventory.produce"] = async (c) => {
  const p = pageOf(c.g.inventory.produce.map((f, i) => ({ f, i })), parseInt(c.rest[0]) || 1, C.PAGE_SIZE);
  await c.send("Fruit", "🍎", `Page ${p.page}/${p.pages} | ${c.g.inventory.produce.length}/${backpackCap(c.g)}\n\n${p.items.map(x => fruitLine(x.f, x.i, c.g, c.now)).join("\n") || "No fruit. Harvest some crops!"}`);
};

function petLine(p: PetEntry, g: Garden): string {
  return `[${p.id}] ${icon(p.rarity)} ${p.nick || p.name} Lv.${p.level}${p.fav ? " ⭐" : ""}${g.equippedPets.includes(p.id) ? " ✅" : ""}`;
}

H["inventory.pets"] = async (c) => {
  const sorted = [...c.g.pets].sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || b.level - a.level);
  await c.send("Pets", "🐾", sorted.slice(0, 30).map(p => petLine(p, c.g)).join("\n") || "You have no pets. Hatch an egg!");
};

H["backpack"] = async (c) => {
  const g = c.g;
  const cap = backpackCap(g);
  const cost = Math.floor(C.BACKPACK_UPGRADE_BASE * Math.pow(C.BACKPACK_UPGRADE_GROWTH, g.backpackLevel));
  await c.send("Backpack", "🎒", `Fruit: ${g.inventory.produce.length}/${cap}\n[${bar(g.inventory.produce.length, cap)}]\n${cap >= C.BACKPACK_MAX ? "Max capacity." : `Next upgrade: +${C.BACKPACK_STEP} space for ${fmt(cost)} Sheckles`}`);
};

H["backpack.upgrade"] = async (c) => {
  const g = c.g;
  if (backpackCap(g) >= C.BACKPACK_MAX) { await c.send("Backpack", "🌟", "Your backpack is at max capacity."); return; }
  const cost = Math.floor(C.BACKPACK_UPGRADE_BASE * Math.pow(C.BACKPACK_UPGRADE_GROWTH, g.backpackLevel));
  if (!(await afford(c, cost))) return;
  charge(c, cost);
  g.backpackLevel += 1;
  await c.save();
  await c.send("Backpack", "🎒", `Upgraded! Capacity: ${backpackCap(g)}\nCost: ${fmt(cost)} Sheckles`);
};

H["gear.list"] = async (c) => {
  const lines = Object.entries(GEARS).map(([n, d]) => `${icon(d.rarity)} ${n} [${d.type}] — ${fmt(d.price)}${(c.g.inventory.gear[n] || 0) > 0 ? ` (own ${c.g.inventory.gear[n]})` : ""}`);
  await c.send("Gear", "🔧", lines.join("\n"));
};

H["gear.info"] = async (c) => {
  const n = matchName(GEARS, c.rest.join(" "));
  if (!n) { await c.send("Gear", "⚠️", "Usage: /garden gear info <gear>"); return; }
  const d = GEARS[n];
  await c.send(n, "🔧", `${icon(d.rarity)} ${d.rarity} | ${d.type}\nPrice: ${fmt(d.price)} Sheckles\n${d.desc}\nOwned: ${c.g.inventory.gear[n] || 0}`);
};

async function placeSprinkler(c: Ctx, name: string): Promise<void> {
  const g = c.g;
  const d = GEARS[name];
  g.sprinklers = g.sprinklers.filter(s => s.until > c.now);
  if (g.sprinklers.length >= 5) { await c.send("Sprinkler", "🛑", "You can only have 5 active sprinklers."); return; }
  if (!takeInv(g, "gear", name, 1)) { await c.send("Sprinkler", "❌", `You do not own ${name}.`); return; }
  g.sprinklers.push({ type: name, placedAt: c.now, until: c.now + d.effect.duration * 1000 });
  await c.save();
  await c.send("Sprinkler", "💦", `Placed ${name}!\n⏰ Lasts ${dur(d.effect.duration * 1000)}\n⚡ Growth +${Math.round(d.effect.growth * 100)}% | Mutation +${Math.round(d.effect.mutation * 100)}% | Size +${Math.round(d.effect.size * 100)}%`);
}

H["sprinkler.place"] = async (c) => {
  const n = matchName(Object.fromEntries(Object.entries(GEARS).filter(([, d]) => d.type === "sprinkler")), c.rest.join(" "));
  if (!n) { await c.send("Sprinkler", "⚠️", "Usage: /garden sprinkler place <sprinkler>\nSprinklers: Basic, Advanced, Godly, Master."); return; }
  await placeSprinkler(c, n);
};

H["sprinkler.list"] = async (c) => {
  const act = c.g.sprinklers.filter(s => s.until > c.now);
  await c.send("Sprinklers", "💦", act.map((s, i) => `${i + 1}. ${s.type} — ${dur(s.until - c.now)} left`).join("\n") || "No active sprinklers.");
};

H["sprinkler.remove"] = async (c) => {
  const act = c.g.sprinklers.filter(s => s.until > c.now);
  const i = parseInt(c.rest[0]) - 1;
  if (isNaN(i) || i < 0 || i >= act.length) { await c.send("Sprinkler", "⚠️", "Usage: /garden sprinkler remove <#>"); return; }
  c.g.sprinklers = c.g.sprinklers.filter(s => s !== act[i]);
  await c.save();
  await c.send("Sprinkler", "✅", `Removed ${act[i].type}.`);
};

H["spray"] = async (c) => {
  const t = [...c.rest];
  const idx = parseInt(t.pop() || "") - 1;
  const sn = matchName(Object.fromEntries(Object.entries(GEARS).filter(([, d]) => d.type === "spray")), t.join(" "));
  const f = c.g.inventory.produce[idx];
  if (!sn || !f) { await c.send("Spray", "⚠️", "Usage: /garden spray <spray> <fruit #>\nSprays: Choc Spray, Pollen Spray, Heat Spray."); return; }
  const m = GEARS[sn].effect.mutation;
  if (f.mutations.includes(m)) { await c.send("Spray", "🛑", `That fruit is already ${m}.`); return; }
  if (f.mutations.length >= C.MAX_MUTATIONS) { await c.send("Spray", "🛑", "That fruit has too many mutations."); return; }
  if (!takeInv(c.g, "gear", sn, 1)) { await c.send("Spray", "❌", `You do not own ${sn}.`); return; }
  f.mutations.push(m);
  f.value = fruitBase(f.crop, f.weight, f.mutations, f.variant);
  c.g.dex.mutations[m] = true;
  await c.save();
  await c.send("Spray", "🧴", `Your ${f.crop} is now ${m}!\nNew value: ${fmt(fruitSell(c.g, f, c.now))} Sheckles`);
};

H["recall"] = async (c) => {
  if ((c.g.inventory.gear["Recall Wrench"] || 0) < 1) { await c.send("Recall", "❌", "You need a Recall Wrench."); return; }
  const n = c.g.equippedPets.length;
  c.g.equippedPets = [];
  await c.save();
  await c.send("Recall", "🔧", `Recalled ${n} pet(s) to your backpack.`);
};

H["gear.use"] = async (c) => {
  const t = [...c.rest];
  const n = matchName(GEARS, t.join(" ")) || matchName(GEARS, t.slice(0, -1).join(" "));
  if (!n) { await c.send("Gear", "⚠️", "Usage: /garden gear use <gear> [plot #]"); return; }
  const d = GEARS[n];
  if (d.type === "sprinkler") { await placeSprinkler(c, n); return; }
  if (n === "Recall Wrench") { await H["recall"](c); return; }
  if (n === "Watering Can") { await H["water"]({ ...c, rest: [t[t.length - 1]] }); return; }
  const how: Record<string, string> = { fertilizer: "/garden fertilize <plot #> <fertilizer>", treat: "/garden pet feed <pet id> <treat>", spray: "/garden spray <spray> <fruit #>", passive: "It works automatically while you own it." };
  await c.send("Gear", "🔧", `${n}: ${how[d.type] || d.desc}`);
};

function rollPet(eggName: string): string {
  const e = EGGS[eggName];
  return weighted(Object.entries(e.pets) as [string, number][], x => x[1])[0];
}

function hatchTimeFor(c: Ctx, egg: string): number {
  let t = EGGS[egg].hatchTime * 1000;
  if (abuseActive(c.now)) t *= AB.hatchMult;
  if (c.isDev) t *= 0.02;
  return Math.max(1000, Math.floor(t));
}

H["egg.place"] = async (c) => {
  const t = [...c.rest];
  let qty = 1;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const n = matchName(EGGS, t.join(" "));
  if (!n) { await c.send("Egg", "⚠️", "Usage: /garden egg place <egg> [qty]"); return; }
  const g = c.g;
  const free = g.eggSlots - g.placedEggs.length;
  if (free < 1) { await c.send("Egg", "🛑", `All ${g.eggSlots} egg slots are in use. Hatch some first.`); return; }
  const k = Math.min(qty, free, g.inventory.eggs[n] || 0);
  if (k < 1) { await c.send("Egg", "❌", `You do not own ${n}.`); return; }
  takeInv(g, "eggs", n, k);
  for (let i = 0; i < k; i++) g.placedEggs.push({ egg: n, placedAt: c.now, hatchTime: hatchTimeFor(c, n) });
  await c.save();
  await c.send("Egg", "🥚", `Placed ${k}x ${n}\n⏰ Hatches in ${dur(hatchTimeFor(c, n))}\nSlots: ${g.placedEggs.length}/${g.eggSlots}`);
};

H["egg.list"] = async (c) => {
  const lines = c.g.placedEggs.map((e, i) => `${i + 1}. ${e.egg} — ${e.placedAt + e.hatchTime <= c.now ? "✅ Ready" : dur(e.placedAt + e.hatchTime - c.now)}`);
  await c.send("Eggs", "🥚", `${lines.join("\n") || "No eggs are hatching."}\n\nSlots: ${c.g.placedEggs.length}/${c.g.eggSlots}`);
};

function hatchOne(c: Ctx, e: EggEntry): PetEntry {
  const name = rollPet(e.egg);
  const p: PetEntry = { id: genId() + c.g.pets.length, name, rarity: PETS[name].rarity, level: 1, xp: 0, weight: Math.round((0.5 + Math.random()) * 100) / 100 };
  c.g.pets.push(p);
  c.g.dex.pets[name] = true;
  bump(c.g, "hatched");
  return p;
}

async function hatchFlow(c: Ctx, which: number[]): Promise<void> {
  const g = c.g;
  const ready = which.filter(i => g.placedEggs[i] && g.placedEggs[i].placedAt + g.placedEggs[i].hatchTime <= c.now);
  if (!ready.length) { await c.send("Hatch", "⏳", "No eggs are ready yet. Use /garden egg list."); return; }
  const got: PetEntry[] = [];
  for (const i of ready) got.push(hatchOne(c, g.placedEggs[i]));
  const set = new Set(ready);
  g.placedEggs = g.placedEggs.filter((_, i) => !set.has(i));
  const ups = addXp(g, got.length * 25, c.now);
  const nt = await c.save();
  await c.send("Hatched!", "🐣", `${got.map(p => `${icon(p.rarity)} ${p.name} [${p.rarity}] (id ${p.id})\n   ${PETS[p.name].desc}`).join("\n")}${lvlLine(ups, g)}${nt}`);
}

H["egg.hatch"] = async (c) => {
  const i = parseInt(c.rest[0]) - 1;
  if (isNaN(i) || i < 0) { await c.send("Hatch", "⚠️", "Usage: /garden egg hatch <#>"); return; }
  await hatchFlow(c, [i]);
};
H["egg.hatchall"] = async (c) => { await hatchFlow(c, c.g.placedEggs.map((_, i) => i)); };

H["egg.info"] = async (c) => {
  const n = matchName(EGGS, c.rest.join(" "));
  if (!n) { await c.send("Egg", "⚠️", "Usage: /garden egg info <egg>"); return; }
  const e = EGGS[n];
  const total = (Object.values(e.pets) as number[]).reduce((a, b) => a + b, 0);
  await c.send(n, "🥚", `${icon(e.rarity)} ${e.rarity} | ${fmt(e.price)} Sheckles\nHatch time: ${dur(e.hatchTime * 1000)}${e.event ? `\nEvent: ${e.event}` : ""}\n\n${(Object.entries(e.pets) as [string, number][]).map(([p, w]) => `${icon(PETS[p].rarity)} ${p} — ${((w / total) * 100).toFixed(1)}%\n   ${PETS[p].desc}`).join("\n")}`);
};

H["egg.speedup"] = async (c) => {
  const i = parseInt(c.rest[0]) - 1;
  const e = c.g.placedEggs[i];
  if (!e) { await c.send("Egg", "⚠️", "Usage: /garden egg speedup <#>"); return; }
  const left = e.placedAt + e.hatchTime - c.now;
  if (left <= 0) { await c.send("Egg", "✅", "That egg is already ready."); return; }
  const cost = Math.ceil(left / 60000);
  if (!(await afford(c, 0, cost))) return;
  charge(c, 0, cost);
  e.placedAt -= left;
  await c.save();
  await c.send("Egg", "🍯", `Used ${cost} honey. Your ${e.egg} is ready to hatch!`);
};

function findPet(g: Garden, q: string): PetEntry | null {
  const t = (q || "").trim().toLowerCase();
  if (!t) return null;
  return g.pets.find(p => p.id.toLowerCase() === t) || g.pets.find(p => (p.nick || p.name).toLowerCase() === t) || null;
}

function petNeed(l: number): number { return Math.floor(C.PET.XP_BASE * Math.pow(l, C.PET.XP_EXP)); }

function addPetXp(p: PetEntry, n: number): number {
  let ups = 0;
  p.xp += n;
  while (p.level < C.PET.MAX_LEVEL && p.xp >= petNeed(p.level)) { p.xp -= petNeed(p.level); p.level++; ups++; }
  if (p.level >= C.PET.MAX_LEVEL) p.xp = 0;
  return ups;
}

H["pet.list"] = async (c) => {
  const sorted = [...c.g.pets].sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || b.level - a.level);
  const p = pageOf(sorted, parseInt(c.rest[0]) || 1, C.PAGE_SIZE);
  await c.send("Pets", "🐾", `Page ${p.page}/${p.pages} | Slots ${c.g.equippedPets.length}/${c.g.petSlots}\n\n${p.items.map(x => petLine(x, c.g)).join("\n") || "No pets yet. Hatch an egg!"}`);
};

H["pet.info"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p) { await c.send("Pet", "❌", "Pet not found. Use /garden pet list."); return; }
  const a = petAbility(p);
  await c.send(p.nick || p.name, "🐾", `${icon(p.rarity)} ${p.name} [${p.rarity}]\nLevel ${p.level}/${C.PET.MAX_LEVEL}\n${p.level >= C.PET.MAX_LEVEL ? "[MAX]" : `[${bar(p.xp, petNeed(p.level))}] ${p.xp}/${petNeed(p.level)} XP`}\nWeight: ${p.weight}kg\nAbility: ${a.kind === "income" ? `${fmt(a.value)} Sheckles/hour` : `+${(a.value * 100).toFixed(1)}% ${a.kind}`}\nIncome: ${fmt(petIncome(p))}/hour\nEquipped: ${c.g.equippedPets.includes(p.id) ? "yes" : "no"}`);
};

function petIncome(p: PetEntry): number {
  const mult = C.PET.RARITY_MULT[p.rarity] || 1;
  let v = C.PET.INCOME_BASE * 0.1 * mult * (1 + p.level * C.PET.INCOME_LEVEL_SCALE);
  const a = PETS[p.name]?.ability;
  if (a && a.kind === "income") v += petAbility(p).value;
  return Math.floor(v);
}

H["pet.equip"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p) { await c.send("Pet", "❌", "Pet not found. Use /garden pet list."); return; }
  if (c.g.equippedPets.includes(p.id)) { await c.send("Pet", "🛑", "That pet is already equipped."); return; }
  if (c.g.equippedPets.length >= c.g.petSlots) { await c.send("Pet", "🛑", `All ${c.g.petSlots} pet slots are used. Unequip one or /garden pet expand.`); return; }
  c.g.equippedPets.push(p.id);
  await c.save();
  await c.send("Pet", "✅", `Equipped ${p.nick || p.name}.\nAbility: ${PETS[p.name].desc}`);
};

H["pet.unequip"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p || !c.g.equippedPets.includes(p.id)) { await c.send("Pet", "⚠️", "That pet is not equipped."); return; }
  c.g.equippedPets = c.g.equippedPets.filter(x => x !== p.id);
  await c.save();
  await c.send("Pet", "✅", `Unequipped ${p.nick || p.name}.`);
};

H["pet.feed"] = async (c) => {
  const p = findPet(c.g, c.rest[0] || "");
  const tn = matchName(Object.fromEntries(Object.entries(GEARS).filter(([, d]) => d.type === "treat")), c.rest.slice(1).join(" "));
  if (!p || !tn) { await c.send("Pet", "⚠️", "Usage: /garden pet feed <pet id> <treat>"); return; }
  if (p.level >= C.PET.MAX_LEVEL) { await c.send("Pet", "🌟", "That pet is at max level."); return; }
  if (!takeInv(c.g, "gear", tn, 1)) { await c.send("Pet", "❌", `You do not own ${tn}.`); return; }
  const ups = addPetXp(p, GEARS[tn].effect.xp);
  bump(c.g, "feeds");
  const nt = await c.save();
  await c.send("Pet", "🍖", `Fed ${p.nick || p.name} a ${tn}!\n+${GEARS[tn].effect.xp} XP${ups ? `\n🎉 Level up! Now Lv.${p.level}` : ""}${nt}`);
};

H["pet.rename"] = async (c) => {
  const p = findPet(c.g, c.rest[0] || "");
  const nn = c.rest.slice(1).join(" ").trim();
  if (!p || !nn || nn.length > C.PET.NAME_MAX) { await c.send("Pet", "⚠️", `Usage: /garden pet rename <pet id> <name> (max ${C.PET.NAME_MAX} characters)`); return; }
  p.nick = nn;
  await c.save();
  await c.send("Pet", "✅", `Renamed to ${nn}.`);
};

H["pet.favorite"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p) { await c.send("Pet", "❌", "Pet not found."); return; }
  p.fav = true;
  await c.save();
  await c.send("Pet", "⭐", `${p.nick || p.name} is now protected.`);
};
H["pet.unfavorite"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p) { await c.send("Pet", "❌", "Pet not found."); return; }
  p.fav = false;
  await c.save();
  await c.send("Pet", "✅", `${p.nick || p.name} is no longer protected.`);
};

H["pet.sell"] = async (c) => {
  const p = findPet(c.g, c.rest.join(" "));
  if (!p) { await c.send("Pet", "❌", "Pet not found."); return; }
  if (p.fav || c.g.equippedPets.includes(p.id)) { await c.send("Pet", "🛑", "Unequip and unfavorite that pet first."); return; }
  const v = Math.floor(C.PET.SELL_BASE * (C.PET.RARITY_MULT[p.rarity] || 1) * (1 + p.level * C.PET.SELL_LEVEL_SCALE));
  c.g.pets = c.g.pets.filter(x => x !== p);
  c.g.balance += v;
  await c.save();
  await c.send("Pet", "💰", `Sold ${p.nick || p.name} for ${fmt(v)} Sheckles.`);
};

H["pet.collect"] = async (c) => {
  const g = c.g;
  const eq = equippedPets(g);
  if (!eq.length) { await c.send("Pet Income", "⚠️", "Equip pets first: /garden pet equip <id>"); return; }
  if (await c.onCd("petCollect", C.PET.COLLECT_COOLDOWN)) return;
  const last = g.counters.petCollectAt || c.now - 3600000;
  const hours = Math.min(C.PET.COLLECT_CAP_HOURS, Math.max(0.05, (c.now - last) / 3600000));
  const perHour = eq.reduce((a, p) => a + petIncome(p), 0);
  const earn = Math.floor(perHour * hours);
  g.balance += earn;
  g.counters.petCollectAt = c.now;
  bump(g, "petIncome", earn); bump(g, "petCollects");
  for (const p of eq) addPetXp(p, 20);
  const nt = await c.save();
  await c.send("Pet Income", "🐾", `Your pets worked for ${hours.toFixed(2)}h\n💰 +${fmt(earn)} Sheckles (${fmt(perHour)}/hour)\nEach pet gained 20 XP${nt}`);
};

H["pet.dex"] = async (c) => {
  const names = Object.keys(PETS);
  await c.send("Pet Collection", "📖", `Found ${Object.keys(c.g.dex.pets).length}/${names.length}\n\n${names.map(n => `${c.g.dex.pets[n] ? "✅" : "🔒"} ${n}`).join("\n")}`);
};

H["pet.slots"] = async (c) => {
  const g = c.g;
  const next = C.PET_SLOT_COSTS[g.petSlots - C.PET_SLOTS_BASE];
  await c.send("Pet Slots", "🐾", `Equipped: ${g.equippedPets.length}/${g.petSlots}\nMax slots: ${C.PET_SLOTS_MAX}\n${g.petSlots >= C.PET_SLOTS_MAX ? "All slots unlocked." : `Next slot: ${fmt(next)} Sheckles`}\n\nEgg slots: ${g.placedEggs.length}/${g.eggSlots}`);
};

H["pet.expand"] = async (c) => {
  const g = c.g;
  if (g.petSlots >= C.PET_SLOTS_MAX) { await c.send("Pet Slots", "🌟", "All pet slots are unlocked."); return; }
  const cost = C.PET_SLOT_COSTS[g.petSlots - C.PET_SLOTS_BASE];
  if (!(await afford(c, cost))) return;
  charge(c, cost);
  g.petSlots += 1;
  if (g.eggSlots < C.EGG_SLOTS_MAX) g.eggSlots += 1;
  await c.save();
  await c.send("Pet Slots", "🐾", `Unlocked a pet slot! Now ${g.petSlots} (egg slots ${g.eggSlots}).\nCost: ${fmt(cost)} Sheckles`);
};

function weatherBlock(name: string, t: number): string {
  const w = WEATHERS[name];
  const muts = w.mutations.length ? w.mutations.map((m: any) => `${m.name} ${Math.round(m.chance * 100)}%`).join(", ") : "none";
  return `${w.icon} ${name} [${w.rarity}]\n${w.desc}\n${w.effect}\nMutations: ${muts}`;
}

H["weather"] = async (c) => {
  const name = weatherAt(c.now);
  await c.send("Weather", WEATHERS[name].icon, `${weatherBlock(name, c.now)}\n\n⏰ Ends in ${dur(weatherEndsAt(c.now) - c.now)}${abuseActive(c.now) ? `\n\n⚡ ADMIN ABUSE: ${dur(WORLD.abuseUntil - c.now)} left` : ""}`);
};

H["weather.forecast"] = async (c) => {
  const step = C.WEATHER_SLOT * 1000;
  const rows: string[] = [];
  for (let i = 1; i <= C.WEATHER_FORECAST; i++) {
    const t = (Math.floor(c.now / step) + i) * step;
    const n = weatherAt(t);
    rows.push(`${WEATHERS[n].icon} ${n} — in ${dur(t - c.now)}`);
  }
  await c.send("Forecast", "🔮", `Now: ${WEATHERS[weatherAt(c.now)].icon} ${weatherAt(c.now)}\n\n${rows.join("\n")}`);
};

H["weather.list"] = async (c) => {
  const total = Object.values(WEATHERS).reduce((a: number, w: any) => a + w.weight, 0);
  await c.send("Weather Types", "🌦️", Object.entries(WEATHERS).map(([n, w]: any) => `${w.icon} ${n} — ${((w.weight / total) * 100).toFixed(1)}%`).join("\n"));
};

H["weather.info"] = async (c) => {
  const n = matchName(WEATHERS, c.rest.join(" "));
  if (!n) { await c.send("Weather", "⚠️", "Usage: /garden weather info <name>"); return; }
  await c.send(n, WEATHERS[n].icon, weatherBlock(n, c.now));
};

H["weather.next"] = async (c) => {
  const n = matchName(WEATHERS, c.rest.join(" "));
  if (!n) { await c.send("Weather", "⚠️", "Usage: /garden weather next <name>"); return; }
  const step = C.WEATHER_SLOT * 1000;
  for (let i = 0; i < 2000; i++) {
    const t = (Math.floor(c.now / step) + i) * step;
    if (t < c.now && i === 0) { if (weatherAt(c.now) === n) { await c.send("Weather", WEATHERS[n].icon, `${n} is happening right now!`); return; } continue; }
    if (weatherAt(t) === n) { await c.send("Weather", WEATHERS[n].icon, `${n} arrives in about ${dur(t - c.now)}.`); return; }
  }
  await c.send("Weather", "🔮", `${n} is not coming in the near future.`);
};

H["weather.history"] = async (c) => {
  const step = C.WEATHER_SLOT * 1000;
  const rows: string[] = [];
  for (let i = 0; i < C.WEATHER_HISTORY; i++) {
    const t = (Math.floor(c.now / step) - i) * step;
    const n = weatherAt(Math.min(t, c.now));
    rows.push(`${WEATHERS[n].icon} ${n} — ${i === 0 ? "now" : dur(c.now - t) + " ago"}`);
  }
  await c.send("Weather History", "🕰️", rows.join("\n"));
};

H["abuse.status"] = async (c) => {
  if (abuseActive(c.now)) {
    await c.send("Admin Abuse", "⚡", `ADMIN ABUSE IS ACTIVE!\n⏰ ${dur(WORLD.abuseUntil - c.now)} left\n\n• Crops grow ${Math.round(1 / AB.growthMult)}x faster\n• Eggs hatch ${Math.round(1 / AB.hatchMult)}x faster\n• Mutation chance +${Math.round(AB.mutationBonus * 100)}%\n• Sell value x${AB.sellMult}\n• XP x${AB.xpMult}\n• Everything is in stock\n• Wild weather every ${AB.weatherRotateSecs}s`);
    return;
  }
  await c.send("Admin Abuse", "💤", "Admin Abuse is not active right now.");
};

H["mutation.list"] = async (c) => {
  await c.send("Mutations", "🧬", Object.entries(MUTATIONS).sort((a: any, b: any) => b[1].mult - a[1].mult).map(([n, m]: any) => `${n} x${m.mult} (${m.source})`).join("\n"));
};

H["mutation.info"] = async (c) => {
  const n = matchName(MUTATIONS, c.rest.join(" "));
  if (!n) { await c.send("Mutation", "⚠️", "Usage: /garden mutation info <name>"); return; }
  const m = MUTATIONS[n];
  const from = Object.entries(WEATHERS).filter(([, w]: any) => w.mutations.some((x: any) => x.name === n)).map(([wn]) => wn);
  await c.send(n, "🧬", `x${m.mult} value multiplier\n${m.desc}\nSource: ${m.source}${from.length ? `\nWeather: ${from.join(", ")}` : ""}\nFound: ${c.g.dex.mutations[n] ? "yes" : "no"}`);
};

H["mutation.collection"] = async (c) => {
  const names = Object.keys(MUTATIONS);
  await c.send("Mutation Collection", "🧬", `Found ${Object.keys(c.g.dex.mutations).length}/${names.length}\n\n${names.map(n => `${c.g.dex.mutations[n] ? "✅" : "🔒"} ${n}`).join("\n")}`);
};

H["mutation.chance"] = async (c) => {
  const g = c.g;
  const b = mutationBonus(g, c.now);
  const w = WEATHERS[weatherAt(c.now)];
  const rows = w.mutations.map((m: any) => `${m.name}: ${Math.min(100, Math.round(Math.min(C.MUTATION_CHANCE_CAP, m.chance * (1 + b)) * 100))}%`);
  await c.send("Mutation Chance", "🧬", `Bonus: +${Math.round(b * 100)}%\n• Pets: +${Math.round(petBonuses(g).mutation * 100)}%\n• Prestige: +${Math.round(g.perm.mutation * 100)}%\n• Gear: +${Math.round(gearPassive(g, "mutation") * 100)}%${abuseActive(c.now) ? `\n• Admin Abuse: +${Math.round(AB.mutationBonus * 100)}%` : ""}\n\nCurrent weather (${weatherAt(c.now)}):\n${rows.join("\n") || "No mutations in this weather."}`);
};

H["variant.list"] = async (c) => {
  await c.send("Variants", "🌈", `Normal x1\nGold x${MUTATIONS.Gold.mult} — ${C.VARIANT.Gold * 100}% base chance\nRainbow x${MUTATIONS.Rainbow.mult} — ${C.VARIANT.Rainbow * 100}% base chance\n\nBonuses from pets, gear and Admin Abuse increase these chances.`);
};

function cropLine(n: string): string { const s = SEEDS[n]; return `${icon(s.rarity)} ${n} — ${fmt(s.price)} | ${dur(s.growthTime * 1000)}${s.regrows ? " ♻️" : ""}`; }

H["crop.list"] = async (c) => {
  const r = c.rest[0] ? RARITY.find(x => x.toLowerCase() === c.rest[0].toLowerCase()) : null;
  const names = Object.keys(SEEDS).filter(n => !r || SEEDS[n].rarity === r);
  await c.send("Crops", "🌾", names.map(cropLine).join("\n") || "No crops of that rarity.");
};

H["crop.info"] = async (c) => {
  const n = matchName(SEEDS, c.rest.join(" "));
  if (!n) { await c.send("Crop", "⚠️", "Usage: /garden crop info <crop>"); return; }
  const s = SEEDS[n];
  await c.send(n, "🌱", `${icon(s.rarity)} ${s.rarity}${s.event ? ` | Event: ${s.event}` : ""}\nSeed price: ${fmt(s.price)}\nGrow time: ${dur(s.growthTime * 1000)}\nBase value: ${fmt(s.value)}\nBase weight: ${s.baseWeight}kg\nFruit per harvest: ${s.fruits[0]}${s.fruits[1] > s.fruits[0] ? `-${s.fruits[1]}` : ""}\n${s.regrows ? "♻️ Regrows after harvest" : "Single harvest"}\nDiscovered: ${c.g.dex.crops[n] ? "yes" : "no"}`);
};

H["crop.search"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase();
  if (!q) { await c.send("Crop", "⚠️", "Usage: /garden crop search <keyword>"); return; }
  const hits = Object.keys(SEEDS).filter(n => n.toLowerCase().includes(q) || SEEDS[n].rarity.toLowerCase().includes(q));
  await c.send("Crop Search", "🔎", hits.map(cropLine).join("\n") || `No crops found for "${q}".`);
};

H["crop.rarity"] = async (c) => {
  await c.send("Crops by Rarity", "🌈", RARITY.map(r => `${icon(r)} ${r}: ${Object.keys(SEEDS).filter(n => SEEDS[n].rarity === r).join(", ") || "none"}`).join("\n\n"));
};

H["crop.compare"] = async (c) => {
  const parts = c.rest.join(" ").split(/\s*(?:\/|\||,|\bvs\b)\s*/i);
  const a = matchName(SEEDS, parts[0]), b = matchName(SEEDS, parts[1] || "");
  if (!a || !b) { await c.send("Compare", "⚠️", "Usage: /garden crop compare <cropA> / <cropB>"); return; }
  const x = SEEDS[a], y = SEEDS[b];
  const row = (l: string, p: any, q: any) => `${l}: ${fmt(p)} vs ${fmt(q)}`;
  await c.send("Compare", "⚖️", `${a} [${x.rarity}] vs ${b} [${y.rarity}]\n\n${row("Price", x.price, y.price)}\n${row("Value", x.value, y.value)}\nGrow: ${dur(x.growthTime * 1000)} vs ${dur(y.growthTime * 1000)}\nRegrows: ${x.regrows ? "yes" : "no"} vs ${y.regrows ? "yes" : "no"}\nProfit/hour: ${fmt(profitHour(a))} vs ${fmt(profitHour(b))}`);
};

function profitHour(n: string): number {
  const s = SEEDS[n];
  const avg = (s.fruits[0] + s.fruits[1]) / 2;
  const perCycle = s.value * avg;
  return Math.floor(((perCycle - (s.regrows ? 0 : s.price)) / s.growthTime) * 3600);
}

H["crop.calc"] = async (c) => {
  const t = [...c.rest];
  const wi = t.findIndex(x => /^\d+(\.\d+)?$/.test(x));
  const cn = wi > 0 ? matchName(SEEDS, t.slice(0, wi).join(" ")) : null;
  if (!cn) { await c.send("Calculator", "🧮", "Usage: /garden crop calc <crop> <weight> [mutations]\nExample: /garden crop calc Carrot 1.5 Wet Shocked"); return; }
  const weight = parseFloat(t[wi]);
  const muts: string[] = [];
  let variant = "Normal";
  for (const x of t.slice(wi + 1).join(" ").split(/[\s,]+/).filter(Boolean)) {
    const m = matchName(MUTATIONS, x);
    if (!m) continue;
    if (m === "Gold" || m === "Rainbow") variant = m; else if (!muts.includes(m)) muts.push(m);
  }
  const base = fruitBase(cn, weight, muts, variant);
  await c.send("Calculator", "🧮", `${cn} ${weight}kg${variant !== "Normal" ? ` ${variant}` : ""}${muts.length ? ` [${muts.join(", ")}]` : ""}\nBase value: ${fmt(base)}\nYour sell value: ${fmt(Math.floor(base * sellMult(c.g, c.now)))}`);
};

H["crop.top"] = async (c) => {
  const top = Object.keys(SEEDS).sort((a, b) => SEEDS[b].value - SEEDS[a].value).slice(0, 10);
  await c.send("Top Crops", "🏆", top.map((n, i) => `${i + 1}. ${n} — base value ${fmt(SEEDS[n].value)}`).join("\n"));
};

H["crop.dex"] = async (c) => {
  const names = Object.keys(SEEDS);
  await c.send("Crop Collection", "📖", `Found ${Object.keys(c.g.dex.crops).length}/${names.length}\n\n${names.map(n => `${c.g.dex.crops[n] ? "✅" : "🔒"} ${n}`).join("\n")}`);
};

H["crop.profit"] = async (c) => {
  const n = matchName(SEEDS, c.rest.join(" "));
  if (!n) { await c.send("Crop", "⚠️", "Usage: /garden crop profit <crop>"); return; }
  const s = SEEDS[n];
  await c.send("Profit", "📈", `${n}\nSeed cost: ${fmt(s.price)}\nAverage yield value: ${fmt(Math.floor(s.value * ((s.fruits[0] + s.fruits[1]) / 2)))}\nEstimated profit: ${fmt(profitHour(n))} Sheckles/hour (before mutations)`);
};

function questLines(c: Ctx): string {
  const g = c.g;
  return Object.entries(g.quests.list).map(([id, q]) => {
    const d = questDone(g, q);
    const st = q.claimed ? "✅ Claimed" : d >= q.goal ? "🎁 Ready" : `${fmt(d)}/${fmt(q.goal)}`;
    return `• ${q.desc} [${id}]\n  ${st} — ${fmt(q.sheckles)} 💰 | ${fmt(q.coins)} 💵${q.honey ? ` | ${q.honey} 🍯` : ""}`;
  }).join("\n");
}

H["quest"] = async (c) => { ensureQuests(c.g); await c.save(); await c.send("Daily Quests", "📜", `${questLines(c)}\n\nClaim with /garden quest claim <id>`); };
H["quest.list"] = async (c) => {
  await c.send("Quest Pool", "📜", QUEST_LIST.map((q: any) => `• ${q.desc} — ${fmt(q.sheckles)} 💰 | ${fmt(q.coins)} 💵`).join("\n") + `\n\n${C.QUESTS_PER_DAY} random quests are assigned each day.`);
};

function claimQuest(c: Ctx, id: string): string | null {
  const q = c.g.quests.list[id];
  if (!q || q.claimed || questDone(c.g, q) < q.goal) return null;
  q.claimed = true;
  c.g.balance += q.sheckles; c.g.honey += q.honey;
  addCoins(c, q.coins);
  addXp(c.g, q.xp, c.now);
  return `${q.desc}: +${fmt(q.sheckles)} 💰 | +${fmt(q.coins)} 💵${q.honey ? ` | +${q.honey} 🍯` : ""}`;
}

H["quest.claim"] = async (c) => {
  ensureQuests(c.g);
  const r = claimQuest(c, c.rest[0] || "");
  if (!r) { await c.send("Quest", "⚠️", "That quest is not ready, already claimed, or does not exist.\nUse /garden quest to see IDs."); return; }
  const nt = await c.save();
  await c.send("Quest Claimed", "🎁", `${r}${nt}`);
};

H["quest.claimall"] = async (c) => {
  ensureQuests(c.g);
  const out: string[] = [];
  for (const id of Object.keys(c.g.quests.list)) { const r = claimQuest(c, id); if (r) out.push(r); }
  if (!out.length) { await c.send("Quest", "⚠️", "No completed quests to claim."); return; }
  const nt = await c.save();
  await c.send("Quests Claimed", "🎁", `${out.join("\n")}${nt}`);
};

H["quest.reroll"] = async (c) => {
  ensureQuests(c.g);
  if (Object.values(c.g.quests.list).some(q => q.claimed)) { await c.send("Quest Reroll", "🛑", "You cannot reroll after claiming a quest today."); return; }
  if (!(await afford(c, 0, C.QUEST_REROLL_HONEY))) return;
  charge(c, 0, C.QUEST_REROLL_HONEY);
  rollQuests(c.g, c.g.quests.date);
  await c.save();
  await c.send("Quest Reroll", "🔄", `New quests assigned!\n\n${questLines(c)}${c.isDev ? "" : `\n\nCost: ${C.QUEST_REROLL_HONEY} honey`}`);
};

function achState(g: Garden, a: any): string {
  const v = metric(g, a.metric);
  if (g.achievements[a.id]) return "✅ Claimed";
  return v >= a.min ? "🎁 Ready" : `🔒 ${fmt(Math.min(v, a.min))}/${fmt(a.min)}`;
}

H["achievements"] = async (c) => {
  await c.send("Achievements", "🏅", ACH_LIST.map((a: any) => `${a.name} — ${a.desc}\n   ${achState(c.g, a)} | ${fmt(a.sheckles)} 💰 + ${fmt(a.coins)} 💵 (${a.id})`).join("\n"));
};

H["achievements.claim"] = async (c) => {
  const only = c.rest[0];
  const out: string[] = [];
  for (const a of ACH_LIST) {
    if (only && a.id !== only) continue;
    if (c.g.achievements[a.id] || metric(c.g, a.metric) < a.min) continue;
    c.g.achievements[a.id] = true;
    c.g.balance += a.sheckles; c.g.honey += a.honey || 0;
    addCoins(c, a.coins);
    out.push(`${a.name}: +${fmt(a.sheckles)} 💰 | +${fmt(a.coins)} 💵${a.honey ? ` | +${a.honey} 🍯` : ""}`);
  }
  if (!out.length) { await c.send("Achievements", "⚠️", "Nothing to claim right now."); return; }
  const nt = await c.save();
  await c.send("Achievements Claimed", "🏅", `${out.join("\n")}${nt}`);
};

H["achievements.progress"] = async (c) => {
  await c.send("Achievement Progress", "📈", ACH_LIST.map((a: any) => `${a.name}\n[${bar(Math.min(metric(c.g, a.metric), a.min), a.min)}] ${fmt(Math.min(metric(c.g, a.metric), a.min))}/${fmt(a.min)}`).join("\n"));
};

H["streak"] = async (c) => {
  const g = c.g;
  const alive = c.now - g.lastDaily < 172800000;
  await c.send("Daily Streak", "🔥", `Streak: ${alive ? g.streak : 0} day(s)\nBonus: +${fmt(Math.min(g.streak, C.DAILY.streakCap) * C.DAILY.streakCoins)} coins on your next daily\nCap: ${C.DAILY.streakCap} days`);
};

H["prestige.info"] = async (c) => {
  const g = c.g;
  await c.send("Prestige", "🌟", `Prestige: ${g.prestige}/${C.PRESTIGE.MAX}\nPoints: ${g.prestigePoints}\n\nRequires level ${C.PRESTIGE.LEVEL_REQ} (you are ${g.level}).\nEach prestige: +${Math.round(C.PRESTIGE.BONUS * 100)}% sell value and +${fmt(C.PRESTIGE.COIN_REWARD)} coins.\nResets: level, XP, Sheckles, crops, fruit, seeds and sprinklers.\nKept: pets, gear, decor, honey, hive, titles, perks.`);
};

H["prestige"] = async (c) => {
  const g = c.g;
  if (c.isDev) { await c.send("Prestige", "⚡", "The developer account is already at max prestige."); return; }
  if (g.prestige >= C.PRESTIGE.MAX) { await c.send("Prestige", "🌟", "You are at the maximum prestige."); return; }
  if (g.level < C.PRESTIGE.LEVEL_REQ) { await c.send("Prestige", "🔒", `Requires level ${C.PRESTIGE.LEVEL_REQ}. You are level ${g.level}.`); return; }
  const pts = 1 + Math.floor(g.level / 50);
  g.prestige += 1; g.prestigePoints += pts;
  g.level = 1; g.xp = 0; g.balance = C.START_SHECKLES; g.crops = []; g.sprinklers = [];
  g.inventory.produce = []; g.inventory.seeds = { Carrot: 3 };
  addCoins(c, C.PRESTIGE.COIN_REWARD);
  const nt = await c.save();
  await c.send("Prestige", "🌟", `You are reborn! Prestige ${g.prestige}\n+${pts} Prestige Point(s)\n💵 +${fmt(C.PRESTIGE.COIN_REWARD)} coins\nSell value now x${(1 + g.prestige * C.PRESTIGE.BONUS).toFixed(2)}${nt}`);
};

H["prestige.shop"] = async (c) => {
  const g = c.g;
  const id = (c.rest[0] || "").toUpperCase();
  if (!id) { await c.send("Prestige Shop", "🌟", `Points: ${g.prestigePoints}\n\n${C.PRESTIGE_SHOP.map((x: any) => `${x.id} ${x.name} — ${x.cost} pt`).join("\n")}\n\nBuy with /garden prestige shop <ID>`); return; }
  const it = C.PRESTIGE_SHOP.find((x: any) => x.id === id);
  if (!it) { await c.send("Prestige Shop", "⚠️", "Invalid item ID."); return; }
  if (g.prestigePoints < it.cost) { await c.send("Prestige Shop", "❌", `Not enough points. Need ${it.cost}, have ${g.prestigePoints}.`); return; }
  if (it.perm) {
    const cur = (g.perm as any)[it.perm] || 0;
    if (cur >= it.cap) { await c.send("Prestige Shop", "🌟", "That perk is maxed out."); return; }
    (g.perm as any)[it.perm] = Math.min(it.cap, Math.round((cur + it.value) * 1000) / 1000);
  }
  g.prestigePoints -= it.cost;
  if (it.honey) g.honey += it.honey;
  if (it.sheckles) g.balance += it.sheckles;
  const nt = await c.save();
  await c.send("Prestige Shop", "✅", `Purchased: ${it.name}${nt}`);
};

H["hive"] = async (c) => {
  const g = c.g;
  await c.send("Hive", "🐝", `Level ${g.hive.level}/${C.HIVE.MAX_LEVEL}\nProduction: ${fmt(hivePerHour(g))} honey/hour\nStored: ${fmt(hiveStored(g, c.now))}/${fmt(hivePerHour(g) * C.HIVE.CAP_HOURS)}\n🍯 Honey: ${fmt(g.honey)}\n\nCollect: /garden hive collect`);
};

H["hive.info"] = async (c) => {
  const g = c.g;
  const bees = equippedPets(g).filter(p => p.name.includes("Bee")).length;
  await c.send("Hive Details", "🐝", `Base: ${C.HIVE.BASE} x level^${C.HIVE.EXP}\nBee pets equipped: ${bees} (+${Math.round(bees * C.HIVE.BEE_BONUS * 100)}%)\nPet honey bonus: +${Math.round(petBonuses(g).honey * 100)}%\nStorage: ${C.HIVE.CAP_HOURS} hours of production\nHoney sells for ${C.HIVE.HONEY_SELL} Sheckles each.`);
};

H["hive.collect"] = async (c) => {
  const g = c.g;
  const n = hiveStored(g, c.now);
  if (n < 1) { await c.send("Hive", "🐝", "Your hive has no honey yet."); return; }
  g.honey += n;
  g.hive.lastCollect = c.now;
  const nt = await c.save();
  await c.send("Hive", "🍯", `Collected ${fmt(n)} honey!\n🍯 Total: ${fmt(g.honey)}${nt}`);
};

H["hive.upgrade"] = async (c) => {
  const g = c.g;
  if (g.hive.level >= C.HIVE.MAX_LEVEL) { await c.send("Hive", "🌟", "Your hive is at max level."); return; }
  const cost = Math.floor(C.HIVE.UPGRADE_BASE * Math.pow(C.HIVE.UPGRADE_GROWTH, g.hive.level - 1));
  if (!(await afford(c, cost))) return;
  g.honey += hiveStored(g, c.now);
  g.hive.lastCollect = c.now;
  charge(c, cost);
  g.hive.level += 1;
  const nt = await c.save();
  await c.send("Hive", "🐝", `Hive upgraded to level ${g.hive.level}!\nProduction: ${fmt(hivePerHour(g))} honey/hour\nCost: ${fmt(cost)} Sheckles${nt}`);
};

H["honey"] = async (c) => { await c.send("Honey", "🍯", `🍯 ${fmt(c.g.honey)} honey\nHive stored: ${fmt(hiveStored(c.g, c.now))}\nSell rate: ${C.HIVE.HONEY_SELL} Sheckles each\n\n/garden honey shop | honey buy | honey sell`); };

H["honey.shop"] = async (c) => {
  await c.send("Honey Shop", "🍯", `You have ${fmt(c.g.honey)} honey\n\n${HONEY_LIST.map((h: any) => `${h.id} ${h.name} (${h.kind}) — ${fmt(h.price)} 🍯`).join("\n")}\n\nBuy with /garden honey buy <ID> <qty>`);
};

H["honey.buy"] = async (c) => {
  const it = HONEY_LIST.find((h: any) => h.id === (c.rest[0] || "").toUpperCase());
  const qty = parseQty(c.rest[1]);
  if (!it) { await c.send("Honey Shop", "⚠️", "Invalid ID. Use /garden honey shop."); return; }
  const kind = it.kind === "seed" ? "seeds" : it.kind === "egg" ? "eggs" : it.kind === "gear" ? "gear" : "cosmetics";
  const total = it.price * qty;
  if (!(await afford(c, 0, total))) return;
  charge(c, 0, total);
  addInv(c.g, kind, it.name, qty);
  const nt = await c.save();
  await c.send("Honey Shop", "✅", `Bought ${qty}x ${it.name} for ${fmt(total)} 🍯${nt}`);
};

H["honey.sell"] = async (c) => {
  const amt = parseAmount(c.rest[0], c.g.honey);
  if (isNaN(amt) || amt < 1) { await c.send("Honey", "⚠️", "Usage: /garden honey sell <amount/all>"); return; }
  if (!c.isDev && amt > c.g.honey) { await c.send("Honey", "❌", `You only have ${fmt(c.g.honey)} honey.`); return; }
  const got = amt * C.HIVE.HONEY_SELL;
  charge(c, 0, amt);
  c.g.balance += got;
  await c.save();
  await c.send("Honey", "💰", `Sold ${fmt(amt)} honey for ${fmt(got)} Sheckles.`);
};

H["pollinate"] = async (c) => {
  const g = c.g;
  if (!(await afford(c, 0, C.HIVE.POLLINATE_COST))) return;
  const targets = g.crops.filter(x => x.plantedAt + x.growthTime > c.now && !(x.forced || []).includes("Pollinated"));
  if (!targets.length) { await c.send("Pollinate", "🐝", "No growing crops need pollinating."); return; }
  if (await c.onCd("pollinate", C.HIVE.POLLINATE_COOLDOWN)) return;
  charge(c, 0, C.HIVE.POLLINATE_COST);
  const n = Math.min(C.HIVE.POLLINATE_COUNT, targets.length);
  for (const cr of [...targets].sort(() => Math.random() - 0.5).slice(0, n)) cr.forced = [...(cr.forced || []), "Pollinated"];
  await c.save();
  await c.send("Pollinate", "🐝", `The bees pollinated ${n} crop(s)! Their fruit will be Pollinated.\nCost: ${C.HIVE.POLLINATE_COST} honey`);
};

H["bee.list"] = async (c) => {
  const bees = equippedPets(c.g).filter(p => p.name.includes("Bee"));
  await c.send("Bees", "🐝", bees.map(p => petLine(p, c.g)).join("\n") || "No bee pets equipped. Hatch a Bee Egg during Bee Swarm!");
};

function decorSlots(g: Garden): number { return Math.min(C.DECOR.SLOT_CAP, C.DECOR.BASE_SLOTS + g.level * C.DECOR.SLOTS_PER_LEVEL); }
function decorCount(g: Garden): number { return Object.values(g.decor).reduce((a, b) => a + b, 0); }
function decorOnly(): Record<string, any> { return Object.fromEntries(Object.entries(COSMETICS).filter(([, d]) => d.type === "decor")); }
function crateOnly(): Record<string, any> { return Object.fromEntries(Object.entries(COSMETICS).filter(([, d]) => d.type === "crate")); }

H["decor.place"] = async (c) => {
  const t = [...c.rest];
  let qty = 1;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const n = matchName(decorOnly(), t.join(" "));
  if (!n) { await c.send("Decor", "⚠️", "Usage: /garden decor place <decor> [qty]"); return; }
  const g = c.g;
  const k = Math.min(qty, g.inventory.cosmetics[n] || 0, decorSlots(g) - decorCount(g));
  if (k < 1) { await c.send("Decor", "❌", (g.inventory.cosmetics[n] || 0) < 1 ? `You do not own ${n}.` : "No decor slots left."); return; }
  takeInv(g, "cosmetics", n, k);
  g.decor[n] = (g.decor[n] || 0) + k;
  const nt = await c.save();
  await c.send("Decor", "🏡", `Placed ${k}x ${n}\nScore: ${fmt(gardenScore(g))}\nSlots: ${decorCount(g)}/${decorSlots(g)}${nt}`);
};

H["decor.remove"] = async (c) => {
  const t = [...c.rest];
  let qty = 1;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const n = matchName(g_decorNames(c.g), t.join(" "));
  if (!n) { await c.send("Decor", "⚠️", "Usage: /garden decor remove <decor> [qty]"); return; }
  const k = Math.min(qty, c.g.decor[n]);
  c.g.decor[n] -= k;
  if (c.g.decor[n] <= 0) delete c.g.decor[n];
  addInv(c.g, "cosmetics", n, k);
  await c.save();
  await c.send("Decor", "✅", `Removed ${k}x ${n}.`);
};

function g_decorNames(g: Garden): Record<string, any> { return Object.fromEntries(Object.keys(g.decor).map(k => [k, 1])); }

H["decor.list"] = async (c) => {
  const rows = Object.entries(c.g.decor).map(([n, q]) => `${n} x${q} (+${(COSMETICS[n]?.score || 0) * q})`);
  await c.send("Placed Decor", "🏡", `${rows.join("\n") || "No decor placed."}\n\nSlots: ${decorCount(c.g)}/${decorSlots(c.g)}`);
};

H["decor.clear"] = async (c) => {
  let n = 0;
  for (const [k, q] of Object.entries(c.g.decor)) { addInv(c.g, "cosmetics", k, q); n += q; }
  c.g.decor = {};
  await c.save();
  await c.send("Decor", "✅", `Removed ${n} decor item(s) back to your inventory.`);
};

H["crate.open"] = async (c) => {
  const t = [...c.rest];
  let qty = 1;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) qty = parseInt(t.pop() as string);
  const n = matchName(crateOnly(), t.join(" "));
  if (!n) { await c.send("Crate", "⚠️", "Usage: /garden crate open <crate> [qty]"); return; }
  const k = Math.min(qty, c.g.inventory.cosmetics[n] || 0, 25);
  if (k < 1) { await c.send("Crate", "❌", `You do not own ${n}.`); return; }
  takeInv(c.g, "cosmetics", n, k);
  const got: Record<string, number> = {};
  for (let i = 0; i < k; i++) {
    const item = weighted(Object.entries(COSMETICS[n].contents) as [string, number][], x => x[1])[0];
    got[item] = (got[item] || 0) + 1;
    addInv(c.g, "cosmetics", item, 1);
  }
  bump(c.g, "crates", k);
  const nt = await c.save();
  await c.send(n, "📦", `Opened ${k} crate(s):\n${Object.entries(got).map(([i, q]) => `• ${q}x ${i} (score ${COSMETICS[i].score})`).join("\n")}${nt}`);
};

H["crate.list"] = async (c) => {
  await c.send("Crates", "📦", Object.entries(crateOnly()).map(([n, d]: any) => {
    const total = (Object.values(d.contents) as number[]).reduce((a, b) => a + b, 0);
    return `${n} — ${fmt(d.price)}\n${(Object.entries(d.contents) as [string, number][]).map(([i, w]) => `   ${i} ${((w / total) * 100).toFixed(0)}%`).join("\n")}`;
  }).join("\n\n"));
};

H["garden.score"] = async (c) => {
  const g = c.g;
  const decor = Object.entries(g.decor).reduce((a, [n, q]) => a + (COSMETICS[n]?.score || 0) * q, 0);
  await c.send("Garden Score", "🏡", `Total: ${fmt(gardenScore(g))}\n\n🏡 Decor: ${fmt(decor)}\n🐾 Pets: ${fmt(g.pets.reduce((a, p) => a + rarityIdx(p.rarity) + 1, 0))}\n📖 Crop collection: ${fmt(Object.keys(g.dex.crops).length * 2)}\n🌟 Prestige: ${fmt(g.prestige * 20)}`);
};

async function other(c: Ctx, name: string): Promise<{ uid: string; data: any; g: Garden } | null> {
  const t = await findGardener(c.db, c.usersData, name);
  if (!t) await c.send("Not Found", "❌", `Gardener "${name}" not found. Use _ for spaces in names.`);
  return t;
}

H["friend.add"] = async (c) => {
  const t = await other(c, c.rest.join(" "));
  if (!t) return;
  if (t.uid === c.sid) { await c.send("Friends", "🛑", "You cannot add yourself."); return; }
  if (c.g.friends.includes(t.uid)) { await c.send("Friends", "🛑", "You are already friends."); return; }
  if (c.g.friendRequests.includes(t.uid)) {
    c.g.friendRequests = c.g.friendRequests.filter(x => x !== t.uid);
    c.g.friends.push(t.uid); t.g.friends.push(c.sid);
    await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
    await c.save();
    await c.send("Friends", "🤝", `You and ${t.g.name} are now friends!`); return;
  }
  if (t.g.friendRequests.includes(c.sid)) { await c.send("Friends", "⏳", "You already sent a request."); return; }
  if (c.g.friends.length >= C.FRIENDS_MAX) { await c.send("Friends", "🛑", "Your friends list is full."); return; }
  t.g.friendRequests.push(c.sid);
  await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
  await c.send("Friends", "📨", `Friend request sent to ${t.g.name}.\nThey can accept with /garden friend accept ${c.g.name}`);
};

H["friend.accept"] = async (c) => {
  const t = await other(c, c.rest.join(" "));
  if (!t) return;
  if (!c.g.friendRequests.includes(t.uid)) { await c.send("Friends", "⚠️", `${t.g.name} has not sent you a request.`); return; }
  c.g.friendRequests = c.g.friendRequests.filter(x => x !== t.uid);
  if (!c.g.friends.includes(t.uid)) c.g.friends.push(t.uid);
  if (!t.g.friends.includes(c.sid)) t.g.friends.push(c.sid);
  await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
  await c.save();
  await c.send("Friends", "🤝", `You and ${t.g.name} are now friends!\nSell bonus: +${Math.round(friendBonus(c.g) * 100)}%`);
};

H["friend.remove"] = async (c) => {
  const t = await other(c, c.rest.join(" "));
  if (!t) return;
  c.g.friends = c.g.friends.filter(x => x !== t.uid);
  t.g.friends = t.g.friends.filter(x => x !== c.sid);
  await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
  await c.save();
  await c.send("Friends", "✅", `Removed ${t.g.name} from your friends.`);
};

H["friend.list"] = async (c) => {
  const names: string[] = [];
  for (const id of c.g.friends.slice(0, 50)) { const u = await loadUser(c.db, c.usersData, id); if (u.g.name) names.push(`🤝 ${u.g.name} (Lv.${u.g.level})`); }
  const reqs: string[] = [];
  for (const id of c.g.friendRequests.slice(0, 20)) { const u = await loadUser(c.db, c.usersData, id); if (u.g.name) reqs.push(`📨 ${u.g.name}`); }
  await c.send("Friends", "🤝", `${names.join("\n") || "No friends yet."}\n\nSell bonus: +${Math.round(friendBonus(c.g) * 100)}%${reqs.length ? `\n\nRequests:\n${reqs.join("\n")}` : ""}`);
};

H["visit"] = async (c) => {
  const t = await other(c, c.rest.join(" "));
  if (!t) return;
  bump(c.g, "visits");
  const g = t.g;
  const crops = g.crops.reduce((m: Record<string, number>, x) => { m[x.seedName] = (m[x.seedName] || 0) + 1; return m; }, {});
  const eq = equippedPets(g).map(p => `${icon(p.rarity)} ${p.nick || p.name} Lv.${p.level}`);
  await c.save();
  await c.send(`${g.name}'s Garden`, "🏡", `${nameLine(g)}${isDevUser(t.uid) ? " ⚡" : ""}\nLevel ${g.level}${g.prestige ? ` | Prestige ${g.prestige}` : ""} | Score ${fmt(gardenScore(g))}\n\n🌾 Crops (${g.crops.length}/${plotCap(g)}):\n${Object.entries(crops).map(([n, q]) => `• ${q}x ${n}`).join("\n") || "Empty"}\n\n🐾 Pets:\n${eq.join("\n") || "None equipped"}\n\n🏡 Decor: ${decorCount(g)} placed\n${WEATHERS[weatherAt(c.now)].icon} Weather: ${weatherAt(c.now)}`);
};

H["pay"] = async (c) => {
  const amt = parseAmount(c.rest[c.rest.length - 1], Math.floor(c.g.balance));
  const name = c.rest.slice(0, -1).join(" ");
  if (!name || isNaN(amt) || amt < C.PAY.MIN) { await c.send("Pay", "⚠️", "Usage: /garden pay <name> <amount>"); return; }
  const t = await other(c, name);
  if (!t) return;
  if (t.uid === c.sid) { await c.send("Pay", "🛑", "You cannot pay yourself."); return; }
  if (!(await afford(c, amt))) return;
  charge(c, amt);
  t.g.balance += Math.floor(amt * (1 - C.PAY.FEE));
  await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
  await c.save();
  await c.send("Pay", "💸", `Sent ${fmt(amt)} Sheckles to ${t.g.name}.`);
};

H["gift"] = async (c) => {
  const t = [...c.rest];
  const name = t.shift() || "";
  const kind = kindFromWord(t.shift() || "");
  const qty = parseQty(t.shift());
  const item = kind ? matchName(catalogOf(kind), t.join(" ")) : null;
  if (!name || !kind || !item) { await c.send("Gift", "⚠️", "Usage: /garden gift <name> <seed/gear/egg/cosmetic> <qty> <item>\nUse _ for spaces in names."); return; }
  const target = await other(c, name);
  if (!target) return;
  if (target.uid === c.sid) { await c.send("Gift", "🛑", "You cannot gift yourself."); return; }
  if (!takeInv(c.g, kind, item, qty)) { await c.send("Gift", "❌", `You do not have ${qty}x ${item}.`); return; }
  addInv(target.g, kind, item, qty);
  await saveUser(c.db, c.usersData, target.uid, target.data, target.g);
  await c.save();
  await c.send("Gift", "🎁", `Gifted ${qty}x ${item} to ${target.g.name}.`);
};

async function topBoard(c: Ctx, title: string, field: string, label: (v: number) => string): Promise<void> {
  const rows = await c.col(COL_USERS).find({ "data.garden.name": { $exists: true } }).sort({ [`data.garden.rank.${field}`]: -1 }).limit(C.LEADERBOARD_SIZE * 2).toArray();
  const list = rows.filter((r: any) => r.data && r.data.garden && r.data.garden.name).slice(0, C.LEADERBOARD_SIZE);
  await c.send(title, "🏅", list.length ? list.map((r: any, i: number) => `${i + 1}. ${r.data.garden.name}${isDevUser(r.userId) ? " ⚡" : ""} — ${label((r.data.garden.rank || {})[field] || 0)}`).join("\n") : "No gardeners yet.");
}

H["leaderboard"] = async (c) => { await topBoard(c, "Richest Gardeners", "sheckles", v => `${fmt(v)} 💰`); };
H["leaderboard.sheckles"] = H["leaderboard"];
H["leaderboard.level"] = async (c) => { await topBoard(c, "Highest Level", "level", v => `Lv.${fmt(v)}`); };
H["leaderboard.harvests"] = async (c) => { await topBoard(c, "Most Harvests", "harvests", v => `${fmt(v)} fruit`); };
H["leaderboard.pets"] = async (c) => { await topBoard(c, "Most Pets", "pets", v => `${fmt(v)} pets`); };
H["leaderboard.collection"] = async (c) => { await topBoard(c, "Crop Collection", "collection", v => `${fmt(v)} crops`); };
H["leaderboard.prestige"] = async (c) => { await topBoard(c, "Highest Prestige", "prestige", v => `Prestige ${fmt(v)}`); };
H["leaderboard.score"] = async (c) => { await topBoard(c, "Best Gardens", "score", v => `${fmt(v)} score`); };

function listingLine(l: any): string {
  return `[${l.id}] ${l.qty}x ${l.label}${l.target ? " 🔒" : ""} — ${fmt(l.price)} 💰 by ${l.sellerName}`;
}

interface Offer { kind: string; name: string; qty: number; label: string; petData?: PetEntry }

function takeForSale(c: Ctx, kindWord: string, qty: number, nameTokens: string[]): Offer | string {
  const g = c.g;
  if (["pet", "pets"].includes(kindWord.toLowerCase())) {
    const p = findPet(g, nameTokens.join(" "));
    if (!p) return "Pet not found. Use the pet id from /garden pet list.";
    if (p.fav || g.equippedPets.includes(p.id)) return "Unequip and unfavorite that pet first.";
    g.pets = g.pets.filter(x => x !== p);
    return { kind: "pet", name: p.name, qty: 1, label: `${icon(p.rarity)} ${p.nick || p.name} Lv.${p.level}`, petData: p };
  }
  const kind = kindFromWord(kindWord);
  if (!kind) return "Type must be seed, gear, egg, cosmetic or pet.";
  const name = matchName(catalogOf(kind), nameTokens.join(" "));
  if (!name) return "Item not found.";
  if (!takeInv(g, kind, name, qty)) return `You do not have ${qty}x ${name}.`;
  return { kind, name, qty, label: name };
}

function giveOffer(g: Garden, l: any): void {
  if (l.kind === "pet" && l.petData) { g.pets.push({ ...l.petData, id: genId() + g.pets.length }); g.dex.pets[l.petData.name] = true; }
  else addInv(g, l.kind, l.name, l.qty);
}

H["market.list"] = async (c) => {
  const q: any = { status: "active", target: null };
  const rows = await c.col(COL_MARKET).find(q).sort({ created: -1 }).limit(15).toArray();
  const w = (c.rest[0] || "").toLowerCase();
  const list = w ? rows.filter((r: any) => r.kind === (kindFromWord(w) || w) || r.kind === w) : rows;
  await c.send("Market", "🏪", list.length ? list.map(listingLine).join("\n") + "\n\nBuy with /garden market buy <id>" : "No active listings.");
};

H["market.mine"] = async (c) => {
  const rows = await c.col(COL_MARKET).find({ seller: c.sid, status: "active" }).sort({ created: -1 }).limit(20).toArray();
  await c.send("My Listings", "🏪", rows.length ? rows.map(listingLine).join("\n") : "You have no active listings.");
};

H["market.sell"] = async (c) => {
  const [kw, qs, ps, ...nm] = c.rest;
  const qty = parseQty(qs), price = parseAmount(ps, 0);
  if (!kw || isNaN(price) || price < C.MARKET.MIN_PRICE || !nm.length) { await c.send("Market", "⚠️", "Usage: /garden market sell <seed/gear/egg/cosmetic/pet> <qty> <total price> <item>\nExample: /garden market sell seed 3 5000 Dragon Fruit"); return; }
  const mine = await c.col(COL_MARKET).find({ seller: c.sid, status: "active" }).limit(50).toArray();
  if (mine.length >= C.MARKET.MAX_LISTINGS) { await c.send("Market", "🛑", `You can have at most ${C.MARKET.MAX_LISTINGS} active listings.`); return; }
  const off = takeForSale(c, kw, qty, nm);
  if (typeof off === "string") { await c.send("Market", "❌", off); return; }
  const id = genId();
  await c.col(COL_MARKET).insertOne({ id, seller: c.sid, sellerName: c.g.name, ...off, price, status: "active", target: null, created: c.now });
  await c.save();
  await c.send("Market", "✅", `Listed ${off.qty}x ${off.label} for ${fmt(price)} 💰\nListing ID: ${id}\nFee on sale: ${Math.round(C.MARKET.FEE * 100)}%`);
};

async function settleListing(c: Ctx, l: any): Promise<void> {
  await c.col(COL_MARKET).updateOne({ id: l.id }, { $set: { status: "sold", buyer: c.sid } });
  giveOffer(c.g, l);
  const seller = await loadUser(c.db, c.usersData, l.seller);
  const got = Math.floor(l.price * (1 - C.MARKET.FEE));
  seller.g.balance += got;
  bump(seller.g, "marketEarned", got);
  await saveUser(c.db, c.usersData, l.seller, seller.data, seller.g);
}

H["market.buy"] = async (c) => {
  const l = await c.col(COL_MARKET).findOne({ id: c.rest[0] || "", status: "active" });
  if (!l || (l.target && l.target !== c.sid)) { await c.send("Market", "❌", "Listing not found or already sold."); return; }
  if (l.seller === c.sid) { await c.send("Market", "🛑", "You cannot buy your own listing. Use /garden market cancel."); return; }
  if (!(await afford(c, l.price))) return;
  charge(c, l.price);
  await settleListing(c, l);
  const nt = await c.save();
  await c.send("Market", "✅", `Bought ${l.qty}x ${l.label} for ${fmt(l.price)} 💰${nt}`);
};

H["market.cancel"] = async (c) => {
  const l = await c.col(COL_MARKET).findOne({ id: c.rest[0] || "", status: "active" });
  if (!l || l.seller !== c.sid) { await c.send("Market", "❌", "You have no active listing with that ID."); return; }
  await c.col(COL_MARKET).updateOne({ id: l.id }, { $set: { status: "cancelled" } });
  giveOffer(c.g, l);
  await c.save();
  await c.send("Market", "✅", `Listing ${l.id} cancelled. Items returned.`);
};

H["trade.offer"] = async (c) => {
  const [name, ps, qs, kw, ...nm] = c.rest;
  const price = parseAmount(ps, 0), qty = parseQty(qs);
  if (!name || isNaN(price) || price < 0 || !kw || !nm.length) { await c.send("Trade", "⚠️", "Usage: /garden trade offer <name> <price> <qty> <type> <item>\nExample: /garden trade offer Sam 5000 1 seed Dragon Fruit\nUse _ for spaces in names."); return; }
  const t = await other(c, name);
  if (!t) return;
  if (t.uid === c.sid) { await c.send("Trade", "🛑", "You cannot trade with yourself."); return; }
  const off = takeForSale(c, kw, qty, nm);
  if (typeof off === "string") { await c.send("Trade", "❌", off); return; }
  const id = genId();
  await c.col(COL_MARKET).insertOne({ id, seller: c.sid, sellerName: c.g.name, ...off, price, status: "active", target: t.uid, created: c.now });
  await c.save();
  await c.send("Trade", "🤝", `Offer sent to ${t.g.name}:\n${off.qty}x ${off.label} for ${fmt(price)} 💰\nOffer ID: ${id}\nThey can use /garden trade accept ${id}`);
};

H["trade.list"] = async (c) => {
  const rows = await c.col(COL_MARKET).find({ status: "active", target: c.sid }).sort({ created: -1 }).limit(15).toArray();
  await c.send("Trades For You", "🤝", rows.length ? rows.map(listingLine).join("\n") + "\n\n/garden trade accept <id> | trade decline <id>" : "No trade offers for you.");
};

H["trade.accept"] = async (c) => {
  const l = await c.col(COL_MARKET).findOne({ id: c.rest[0] || "", status: "active", target: c.sid });
  if (!l) { await c.send("Trade", "❌", "No trade offer with that ID for you."); return; }
  if (!(await afford(c, l.price))) return;
  charge(c, l.price);
  await settleListing(c, l);
  const nt = await c.save();
  await c.send("Trade", "✅", `Trade complete! You got ${l.qty}x ${l.label} for ${fmt(l.price)} 💰${nt}`);
};

H["trade.decline"] = async (c) => {
  const l = await c.col(COL_MARKET).findOne({ id: c.rest[0] || "", status: "active", target: c.sid });
  if (!l) { await c.send("Trade", "❌", "No trade offer with that ID for you."); return; }
  await c.col(COL_MARKET).updateOne({ id: l.id }, { $set: { status: "declined" } });
  const seller = await loadUser(c.db, c.usersData, l.seller);
  giveOffer(seller.g, l);
  await saveUser(c.db, c.usersData, l.seller, seller.data, seller.g);
  await c.send("Trade", "✅", "Offer declined. The items were returned to the seller.");
};

async function getBet(c: Ctx, tok: string | undefined): Promise<number> {
  const bet = parseAmount(tok, Math.min(Math.floor(c.g.balance), C.GAMBLE_MAX_BET));
  if (isNaN(bet) || bet < 1) { await c.send("Games", "⚠️", `Usage: /garden ${c.key.replace(".", " ")} <amount>`); return NaN; }
  if (bet > C.GAMBLE_MAX_BET) { await c.send("Games", "🛑", `Max bet is ${fmt(C.GAMBLE_MAX_BET)} Sheckles.`); return NaN; }
  if (!c.isDev && bet > c.g.balance) { await c.send("Games", "❌", `You only have ${fmt(c.g.balance)} Sheckles.`); return NaN; }
  return bet;
}

async function finishGame(c: Ctx, title: string, sym: string, bet: number, payout: number, body: string): Promise<void> {
  c.g.balance += payout - bet;
  bump(c.g, "games");
  if (payout > bet) bump(c.g, "gameWins");
  const nt = await c.save();
  const net = payout - bet;
  await c.send(title, sym, `${body}\n\n${net > 0 ? `🏆 Won ${fmt(net)} 💰` : net === 0 ? "🔹 Break even" : `💸 Lost ${fmt(-net)} 💰`}\nBalance: ${fmt(c.g.balance)}${nt}`);
}

H["coinflip"] = async (c) => {
  const side = (c.rest[1] || "").toLowerCase();
  if (!["heads", "tails"].includes(side)) { await c.send("Coinflip", "⚠️", "Usage: /garden coinflip <amount> <heads/tails>"); return; }
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const res = Math.random() < 0.5 ? "heads" : "tails";
  await finishGame(c, "Coinflip", "🪙", bet, res === side ? bet * 2 : 0, `The coin lands on ${res.toUpperCase()}.`);
};

H["dice"] = async (c) => {
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const me = rnd(1, 6) + rnd(1, 6), house = rnd(1, 6) + rnd(1, 6);
  await finishGame(c, "Dice", "🎲", bet, me > house ? bet * 2 : me === house ? bet : 0, `You rolled ${me}. The house rolled ${house}.`);
};

H["slots"] = async (c) => {
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const sy: string[] = C.SLOTS.SYMBOLS;
  const r = [pick(sy), pick(sy), pick(sy)];
  let mult = 0;
  if (r[0] === r[1] && r[1] === r[2]) mult = C.SLOTS.THREE[r[0]];
  else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) mult = C.SLOTS.TWO;
  await finishGame(c, "Slots", "🎰", bet, Math.floor(bet * mult), `[ ${r.join(" | ")} ]`);
};

H["wheel"] = async (c) => {
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const seg = weighted<any>(C.WHEEL, x => x.weight);
  await finishGame(c, "Wheel", "🎡", bet, Math.floor(bet * seg.mult), `The wheel stops on ${seg.label} (x${seg.mult}).`);
};

H["scratch"] = async (c) => {
  if (!(await afford(c, C.SCRATCH.COST))) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  charge(c, C.SCRATCH.COST);
  const p = weighted<any>(C.SCRATCH.PRIZES, x => x.weight);
  c.g.balance += p.sheckles; c.g.honey += p.honey;
  bump(c.g, "games");
  const nt = await c.save();
  await c.send("Scratch Ticket", "🎟️", `You scratch your ticket...\n\n🎁 ${p.label}${p.sheckles || p.honey ? `\n+${fmt(p.sheckles)} 💰${p.honey ? ` | +${p.honey} 🍯` : ""}` : ""}\nTicket: ${fmt(C.SCRATCH.COST)} Sheckles${nt}`);
};

for (const ch of CHORE_LIST) {
  H[ch.key] = async (c) => {
    if (await c.onCd(ch.key, ch.cd)) return;
    const g = c.g;
    const scale = 1 + g.level * 0.02 + g.prestige * 0.25;
    const sh = Math.floor(rnd(ch.sheckles[0], ch.sheckles[1]) * scale);
    g.balance += sh;
    let extra = "";
    if (Math.random() < ch.honeyChance) { const h = rnd(1, 3); g.honey += h; extra += `\n🍯 +${h} honey`; }
    if (Math.random() < ch.dropChance) {
      const pool = Object.keys(SEEDS).filter(n => !SEEDS[n].event && rarityIdx(SEEDS[n].rarity) <= Math.min(3, Math.floor(g.level / 15) + 1));
      const s = pick(pool);
      addInv(g, "seeds", s, 1);
      extra += `\n🌱 Found a ${s} seed!`;
    }
    bump(g, "chores");
    const ups = addXp(g, ch.xp, c.now);
    const nt = await c.save();
    await c.send(ch.label, "🧹", `${ch.text}\n\n💰 +${fmt(sh)} Sheckles\n✨ +${ch.xp} XP${extra}${lvlLine(ups, g)}${nt}`);
  };
}

function splitTail(rest: string[], n: number): { name: string; tail: string[] } {
  return { name: rest.slice(0, Math.max(0, rest.length - n)).join(" ").trim(), tail: rest.slice(-n) };
}

async function adminTarget(c: Ctx, name: string): Promise<{ uid: string; data: any; g: Garden } | null> {
  const t = await findGardener(c.db, c.usersData, name);
  if (!t) await c.send("Admin", "❌", `Gardener "${name}" not found.`);
  return t;
}

async function saveTarget(c: Ctx, t: { uid: string; data: any; g: Garden }): Promise<void> {
  updateRank(t.g);
  await saveUser(c.db, c.usersData, t.uid, t.data, t.g);
}

async function adminNumber(c: Ctx, field: "balance" | "honey" | "xp", label: string): Promise<void> {
  const { name, tail } = splitTail(c.rest, 1);
  const amt = parseInt(tail[0]);
  if (!name || isNaN(amt)) { await c.send("Admin", "⚠️", `Usage: /garden admin give${label} <name> <amount>`); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  if (field === "xp") addXp(t.g, amt, c.now); else (t.g as any)[field] += amt;
  await saveTarget(c, t);
  await c.send("Admin", "✅", `Gave ${fmt(amt)} ${label} to ${t.g.name}.`);
}
H["admin.givesheckles"] = async (c) => { await adminNumber(c, "balance", "sheckles"); };
H["admin.givehoney"] = async (c) => { await adminNumber(c, "honey", "honey"); };
H["admin.givexp"] = async (c) => { await adminNumber(c, "xp", "xp"); };

async function adminItem(c: Ctx, kind: string): Promise<void> {
  const { name, tail } = splitTail(c.rest, 1);
  const parts = name.split(" ");
  const who = parts.shift() || "";
  const item = matchName(catalogOf(kind), parts.join(" "));
  const qty = parseInt(tail[0]);
  if (!who || !item || isNaN(qty)) { await c.send("Admin", "⚠️", `Usage: /garden admin give${KIND_LABEL[kind]} <name> <item> <qty>\nUse _ for spaces in the name.`); return; }
  const t = await adminTarget(c, who);
  if (!t) return;
  addInv(t.g, kind, item, qty);
  await saveTarget(c, t);
  await c.send("Admin", "✅", `Gave ${qty}x ${item} to ${t.g.name}.`);
}
H["admin.giveseed"] = async (c) => { await adminItem(c, "seeds"); };
H["admin.givegear"] = async (c) => { await adminItem(c, "gear"); };
H["admin.giveegg"] = async (c) => { await adminItem(c, "eggs"); };

H["admin.givepet"] = async (c) => {
  const who = c.rest[0] || "";
  const pn = matchName(PETS, c.rest.slice(1).join(" "));
  if (!who || !pn) { await c.send("Admin", "⚠️", "Usage: /garden admin givepet <name> <pet>\nUse _ for spaces in the name."); return; }
  const t = await adminTarget(c, who);
  if (!t) return;
  t.g.pets.push({ id: genId() + t.g.pets.length, name: pn, rarity: PETS[pn].rarity, level: 1, xp: 0, weight: 1 });
  t.g.dex.pets[pn] = true;
  await saveTarget(c, t);
  await c.send("Admin", "✅", `Gave a ${pn} to ${t.g.name}.`);
};

H["admin.setlevel"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 1);
  const lv = parseInt(tail[0]);
  if (!name || isNaN(lv) || lv < 1) { await c.send("Admin", "⚠️", "Usage: /garden admin setlevel <name> <level>"); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  t.g.level = lv; t.g.xp = 0;
  await saveTarget(c, t);
  await c.send("Admin", "✅", `${t.g.name} is now level ${lv}.`);
};

async function adminFlag(c: Ctx, banned: boolean): Promise<void> {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  t.g.disabled = banned;
  await saveTarget(c, t);
  await c.send("Admin", "✅", `${t.g.name} has been ${banned ? "banned" : "unbanned"}.`);
}
H["admin.ban"] = async (c) => { await adminFlag(c, true); };
H["admin.unban"] = async (c) => { await adminFlag(c, false); };

H["admin.wipe"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  if (isDevUser(t.uid)) { await c.send("Admin", "🛑", "The developer garden cannot be wiped."); return; }
  const fresh = newGarden();
  fresh.name = null;
  await saveUser(c.db, c.usersData, t.uid, t.data, fresh);
  await c.send("Admin", "✅", `${t.g.name} was wiped and must register again.`);
};

H["admin.inspect"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  const g = t.g;
  await c.send("Inspect", "🔍", `${g.name} (${t.uid})\nLevel ${g.level} | Prestige ${g.prestige}\n💰 ${fmt(g.balance)} | 🍯 ${fmt(g.honey)}\n💵 ${fmt(Number(t.data.balance) || 0)} coins | 🏦 ${fmt(Number(t.data.bank) || 0)}\nCrops ${g.crops.length}/${plotCap(g)} | Fruit ${g.inventory.produce.length} | Pets ${g.pets.length}\nHarvests ${fmt(g.counters.harvests || 0)} | Banned: ${g.disabled ? "yes" : "no"}`);
};

H["admin.resetcd"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  t.g.cd = {};
  await saveTarget(c, t);
  await c.send("Admin", "✅", `Cooldowns cleared for ${t.g.name}.`);
};

H["admin.setweather"] = async (c) => {
  const t = [...c.rest];
  let mins = 5;
  if (t.length > 1 && /^\d+$/.test(t[t.length - 1])) mins = Math.min(60, Math.max(1, parseInt(t.pop() as string)));
  const n = matchName(WEATHERS, t.join(" "));
  if (!n) { await c.send("Admin", "⚠️", `Usage: /garden admin setweather <weather> [minutes]\nWeathers: ${Object.keys(WEATHERS).join(", ")}`); return; }
  WORLD.weatherOverride = { name: n, from: c.now, until: c.now + mins * 60000 };
  await saveWorld(c.db);
  await c.send("Admin", WEATHERS[n].icon, `Weather forced to ${n} for ${mins} minute(s).`);
};

H["admin.restock"] = async (c) => {
  WORLD.stockSalt += 1;
  await saveWorld(c.db);
  await c.send("Admin", "🔄", "The shop stock has been rerolled for everyone.");
};

H["dev.buff"] = async (c) => {
  applyDevBuff(c.g);
  await c.save();
  await c.send("Developer", "⚡", `Developer buff reapplied.\n💰 ${fmt(c.g.balance)} Sheckles | 🍯 ${fmt(c.g.honey)} | Level ${c.g.level}`);
};

H["dev.unlock"] = async (c) => {
  applyDevBuff(c.g);
  await c.save();
  await c.send("Developer", "🔓", `Everything unlocked:\n• ${Object.keys(SEEDS).length} seeds, ${Object.keys(GEARS).length} gear, ${Object.keys(EGGS).length} eggs, ${Object.keys(COSMETICS).length} cosmetics (x${DV.itemQty})\n• ${Object.keys(PETS).length} pets\n• Full crop, pet and mutation collections\n• Max plots, backpack, slots and hive\n• Stock always full for you`);
};

async function announceAbuseEnd(api: any, db: any, tid: string, until: number): Promise<void> {
  setTimeout(async () => {
    await loadWorld(db);
    if (WORLD.abuseUntil <= Date.now()) api.sendMessage(styled("Admin Abuse", "💤", "Admin Abuse has ended. Back to normal!"), tid);
  }, Math.max(0, until - Date.now()) + 1500);
}

async function startAbuse(api: any, db: any, tid: string, minutes: number): Promise<void> {
  const now = Date.now();
  WORLD.abuseFrom = now;
  WORLD.abuseUntil = now + minutes * 60000;
  await saveWorld(db);
  await api.sendMessage(styled("⚡ ADMIN ABUSE ⚡", "⚡", `ADMIN ABUSE IS NOW ON for ${minutes} minute(s)!\n\n• Crops grow ${Math.round(1 / AB.growthMult)}x faster\n• Eggs hatch ${Math.round(1 / AB.hatchMult)}x faster\n• Mutation chance +${Math.round(AB.mutationBonus * 100)}%\n• Sell value x${AB.sellMult}\n• XP x${AB.xpMult}\n• Everything is in stock\n• Wild weather every ${AB.weatherRotateSecs}s\n\nGo plant, harvest and sell NOW!`), tid);
  await announceAbuseEnd(api, db, tid, WORLD.abuseUntil);
}

async function stopAbuse(api: any, db: any, tid: string): Promise<void> {
  WORLD.abuseFrom = 0; WORLD.abuseUntil = 0;
  await saveWorld(db);
  await api.sendMessage(styled("Admin Abuse", "💤", "Admin Abuse has been turned off."), tid);
}

async function askDuration(c: Ctx): Promise<void> {
  const opts = (AB.durations as number[]).map(m => `${m} - ${m} minute${m > 1 ? "s" : ""}`).join("\n");
  const info: any = await new Promise(resolve => {
    c.api.sendMessage(styled("Admin Abuse", "⚡", `Choose how long Admin Abuse lasts.\nReply to this message with a number:\n\n${opts}`), c.tid, (e: any, i: any) => resolve(i), c.mid);
  });
  const id = info?.messageID;
  if (!id) return;
  let done = false;
  global.registerEnkiduListener(id, async ({ api, event }: any) => {
    if (done || !isAuthorized(event.senderID.toString(), isDevUser(event.senderID.toString()))) return;
    const n = parseInt((event.body || "").trim());
    if (isNaN(n) || !(AB.durations as number[]).includes(n)) {
      await api.sendMessage(styled("Admin Abuse", "⚠️", `Reply with a number from ${AB.durations[0]} to ${AB.durations[AB.durations.length - 1]}.`), event.threadID, event.messageID);
      return;
    }
    done = true;
    global.replyListeners.delete(id);
    await startAbuse(api, c.db, event.threadID, n);
  });
  setTimeout(() => { if (!done) { done = true; global.replyListeners.delete(id); } }, 120000);
}

H["dashboard"] = async (c) => {
  const active = abuseActive(c.now);
  const p = AB.dashboardPhrases;
  const info: any = await new Promise(resolve => {
    c.api.sendMessage(styled("Admin Dashboard", "🛠️", `Welcome, ${c.g.name}.\n\nAdmin Abuse: ${active ? `ON (${dur(WORLD.abuseUntil - c.now)} left)` : "OFF"}\n\nReply to this message with:\n• ${p.on}\n• ${p.off}\n• ${p.status}\n\nAfter "${p.on}" I will ask for the duration (1 to 5 minutes).`), c.tid, (e: any, i: any) => resolve(i), c.mid);
  });
  const id = info?.messageID;
  if (!id) return;
  global.registerEnkiduListener(id, async ({ api, event }: any) => {
    const sid = event.senderID.toString();
    if (!isAuthorized(sid, isDevUser(sid))) return;
    const body = (event.body || "").trim().toLowerCase();
    await loadWorld(c.db);
    if (body.includes(p.on)) { await askDuration({ ...c, api, tid: event.threadID, mid: event.messageID }); return; }
    if (body.includes(p.off)) { await stopAbuse(api, c.db, event.threadID); return; }
    if (body === p.status) {
      const now = Date.now();
      await api.sendMessage(styled("Admin Dashboard", "🛠️", abuseActive(now) ? `Admin Abuse is ON. ${dur(WORLD.abuseUntil - now)} left.` : "Admin Abuse is OFF."), event.threadID, event.messageID);
    }
  });
  setTimeout(() => global.replyListeners.delete(id), 600000);
};

H["abuse.on"] = async (c) => {
  const n = parseInt(c.rest[0] || "");
  if (isNaN(n)) { await askDuration(c); return; }
  if (!(AB.durations as number[]).includes(n)) { await c.send("Admin Abuse", "⚠️", `Choose ${AB.durations[0]} to ${AB.durations[AB.durations.length - 1]} minutes.`); return; }
  await startAbuse(c.api, c.db, c.tid, n);
};

H["abuse.off"] = async (c) => { await stopAbuse(c.api, c.db, c.tid); };

const CATEGORY_ORDER: string[] = Array.from(new Set(Object.values(REG).map(v => v.category)));
const disp = (k: string): string => k.replace(".", " ");

H["help"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase().trim();
  if (!q) {
    const lines = CATEGORY_ORDER.map(cat => `${cat} (${Object.values(REG).filter(v => v.category === cat && (v.access === "all" || c.isDev)).length})`).join("\n");
    await c.send("Garden Commands", "🌻", `${Object.keys(REG).length} subcommands.\n\n${lines}\n\n/garden help <category>\n/garden commands\n/garden search <keyword>`);
    return;
  }
  const cat = CATEGORY_ORDER.find(x => x.toLowerCase().includes(q));
  if (!cat) { await c.send("Help", "⚠️", "Category not found. Use /garden help."); return; }
  const rows = Object.entries(REG).filter(([, v]) => v.category === cat).map(([k, v]) => `/garden ${disp(k)}${v.usage ? " " + v.usage : ""}\n   ${v.desc}${v.access !== "all" ? ` (${v.access})` : ""}`);
  await c.send(cat, "📖", rows.join("\n"));
};

H["commands"] = async (c) => {
  const keys = Object.keys(REG);
  const p = pageOf(keys, parseInt(c.rest[0]) || 1, C.PAGE_SIZE * 2);
  await c.send("All Subcommands", "📋", `Page ${p.page}/${p.pages}\n\n${p.items.map(disp).join(", ")}\n\n/garden commands <page>`);
};

H["search"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase().trim();
  if (!q) { await c.send("Search", "⚠️", "Usage: /garden search <keyword>"); return; }
  const hits = Object.entries(REG).filter(([k, v]) => k.includes(q) || v.desc.toLowerCase().includes(q)).slice(0, 20);
  await c.send("Search", "🔎", hits.length ? hits.map(([k, v]) => `/garden ${disp(k)}${v.usage ? " " + v.usage : ""} — ${v.desc}`).join("\n") : `Nothing found for "${q}".`);
};

H["about"] = async (c) => {
  await c.send("About Garden", "🌻", `A Grow a Garden style farming game.\n\n📜 ${Object.keys(REG).length} subcommands\n🌱 ${Object.keys(SEEDS).length} crops | 🔧 ${Object.keys(GEARS).length} gear | 🥚 ${Object.keys(EGGS).length} eggs\n🐾 ${Object.keys(PETS).length} pets | 🧬 ${Object.keys(MUTATIONS).length} mutations | 🌦️ ${Object.keys(WEATHERS).length} weathers\n\nEarn real bot coins with /garden cashout.\nVersion ${C.VERSION}`);
};

H["ping"] = async (c) => {
  const t0 = Date.now();
  await c.col(COL_USERS).findOne({ userId: c.sid });
  await c.send("Ping", "🏓", `Pong! Database round trip: ${Date.now() - t0}ms`);
};

H["version"] = async (c) => { await c.send("Version", "🏷️", `Garden command v${C.VERSION}`); };
H["tips"] = async (c) => { await c.send("Tip", "💡", pick<string>(C.TIPS)); };

const gardenCommand = {
  name: "garden",
  aliases: ["g", "gag"],
  description: "Grow A Garden: plant seeds, hatch pets, ride the weather, sell fruit and cash out real bot coins",
  usage: "#garden register <name> | #garden help | #garden stock | #garden plant <seed> | #garden harvest | #garden cashout",
  config: {
    name: "garden",
    author: "Aljur Pogoy",
    aliases: ["g", "gag"],
    description: "Grow A Garden: plant seeds, hatch pets, ride the weather, sell fruit and cash out real bot coins",
    usage: "#garden register <name> | #garden help | #garden stock | #garden plant <seed> | #garden harvest | #garden cashout",
    version: "3.0.0",
    category: "Games 🎮",
  },

  async run(ctx: any) {
    const { api, event, args, db, usersData } = ctx;
    if (!db) { await api.sendMessage("Database not available.", event.threadID, event.messageID); return; }
    const { threadID, messageID, senderID } = event;
    const sid = senderID.toString();
    const isDev = isDevUser(sid);
    const now = Date.now();
    const { key, rest } = resolveKey(args || []);

    await loadWorld(db);
    const user = await loadUser(db, usersData, sid);
    const g = user.g;
    if (isDev && g.name) applyDevBuff(g);

    const c: Ctx = {
      api, event, db, usersData, u: user.data, g, isDev, sid, tid: threadID, mid: messageID, key, rest, now,
      send: async (h, sym, b) => { await api.sendMessage(styled(h, sym, b), threadID, messageID); },
      save: async () => {
        pruneBought(g, now);
        updateRank(g);
        const nt = titleLine(grantTitles(g));
        await saveUser(db, usersData, sid, c.u, g);
        return nt;
      },
      onCd: async (k, secs) => {
        if (isDev) return false;
        const until = g.cd[k] || 0;
        if (until > now) { await api.sendMessage(styled("Cooldown", "⏳", `Wait ${dur(until - now)} before using this again.`), threadID, messageID); return true; }
        g.cd[k] = now + secs * 1000;
        return false;
      },
      col: (n: string) => db.db(n),
    };

    if (!key) {
      const a0 = (args && args[0] ? args[0] : "").toLowerCase();
      const group = a0 ? Object.keys(REG).filter(k => k.startsWith(a0 + ".")) : [];
      if (group.length) { await c.send(`Garden: ${a0}`, "📖", group.map(k => `/garden ${disp(k)}${REG[k].usage ? " " + REG[k].usage : ""}\n   ${REG[k].desc}`).join("\n")); return; }
      await H["help"]({ ...c, rest: [] });
      return;
    }

    if (g.disabled && !isDev) { await c.send("Garden", "🚫", "You are banned from the garden."); return; }
    const meta = REG[key];
    if (meta.access === "dev" && !isDev) { await c.send("Developer", "❌", "Developer only."); return; }
    if (meta.access === "admin" && !isAuthorized(sid, isDev)) { await c.send("Admin", "❌", "Access denied."); return; }
    if (!g.name && !NO_REG_KEYS.includes(key) && !INFO_PREFIXES.some(p => key.startsWith(p))) {
      await c.send("Garden", "⚠️", "You need a garden first!\nUsage: /garden register <name>");
      return;
    }

    const fn = H[key];
    if (!fn) { await c.send("Garden", "⚠️", "That subcommand is not available."); return; }
    try { await fn(c); }
    catch (err: any) { await c.send("Garden", "⚠️", `Something went wrong: ${err?.message || "unknown error"}`); }
  },
};

module.exports = gardenCommand;
module.exports.default = gardenCommand;
