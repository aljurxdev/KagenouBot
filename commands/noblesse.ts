/* Hell nah, 
this game
command wasn't mine but my 
classmate friend did this. I only do data json */

import AuroraBetaStyler from "@aurora/styler";
import CHARACTERS from "@noblesse/characters";
import CLANS from "@noblesse/clans";
import WEAPONS from "@noblesse/weapons";
import POTIONS from "@noblesse/potions";
import MATERIALS from "@noblesse/materials";
import SKILLS from "@noblesse/skills";
import SHOP from "@noblesse/shop";
import ENEMIES from "@noblesse/enemies";
import LOCATIONS from "@noblesse/locations";
import STORY from "@noblesse/story";
import QUESTS from "@noblesse/quests";
import TITLES from "@noblesse/titles";
import ACHIEVEMENTS from "@noblesse/achievements";
import SOUL_WEAPONS from "@noblesse/soulweapons";
import RECIPES from "@noblesse/recipes";
import ACTIONS from "@noblesse/actions";
import LORE from "@noblesse/lore";
import TRIVIA from "@noblesse/trivia";
import REGISTRY from "@noblesse/subcommands";
import DEV from "@noblesse/dev";
import CONSTANTS from "@noblesse/constants";

const C: any = CONSTANTS;
const D: any = DEV;
const REG: Record<string, { category: string; usage: string; desc: string; access: string }> = REGISTRY as any;
const CHAR_LIST = CHARACTERS as any[];
const CHAR_MAP: Record<string, any> = Object.fromEntries(CHAR_LIST.map((c: any) => [c.id, c]));
const CLAN_LIST = CLANS as any[];
const CLAN_MAP: Record<string, any> = Object.fromEntries(CLAN_LIST.map((c: any) => [c.id, c]));
const WEAPON_MAP: Record<string, any> = WEAPONS as any;
const POTION_MAP: Record<string, any> = POTIONS as any;
const MATERIAL_MAP: Record<string, any> = MATERIALS as any;
const SKILL_MAP: Record<string, any> = SKILLS as any;
const SHOP_MAP: Record<string, any> = SHOP as any;
const ENEMY_LIST = ENEMIES as any[];
const LOCATION_LIST = LOCATIONS as any[];
const STORY_LIST = STORY as any[];
const QUEST_LIST = QUESTS as any[];
const TITLE_LIST = TITLES as any[];
const ACH_LIST = ACHIEVEMENTS as any[];
const SOUL_LIST = SOUL_WEAPONS as any[];
const RECIPE_LIST = RECIPES as any[];
const ACT: any = ACTIONS;
const LORE_DATA: any = LORE;
const TRIVIA_DATA: any = TRIVIA;

const DEV_UID: string = C.DEV_UID;
const RARITY_ORDER: string[] = C.RARITY_ORDER;
const STAT_KEYS = ["atk", "def", "mana", "luck"];
const COL_PLAYERS = "noblesse_players";
const COL_HOUSES = "noblesse_houses";
const COL_MARKET = "noblesse_market";
const COL_WORLD = "noblesse_world";
const NO_REG_KEYS = ["register", "help", "commands", "search", "about", "ping", "version", "tips"];

interface Stats { atk: number; def: number; mana: number; luck: number }

interface QuestEntry { metric: string; goal: number; base: number; coins: number; exp: number; gems: number; desc: string; claimed: boolean }

interface Profile {
  userID: string;
  name?: string;
  bio?: string;
  mainChar?: string;
  chars: Record<string, { stars: number; fav: boolean }>;
  clan?: string;
  level: number;
  exp: number;
  prestige: number;
  prestigePoints: number;
  trained: Stats;
  stats: Stats;
  power: number;
  coins: number;
  gems: number;
  pity: number;
  charge: number;
  stance: string;
  bond: { level: number; exp: number };
  inv: { weapons: Record<string, { level: number; qty: number }>; potions: Record<string, number>; materials: Record<string, number> };
  equipped: { weapon?: string };
  skills: string[];
  equippedSkills: string[];
  quests: { date: string; list: Record<string, QuestEntry> };
  story: number;
  cd: Record<string, number>;
  counters: Record<string, number>;
  lastDaily: number;
  lastWeekly: number;
  streak: number;
  titles: string[];
  activeTitle?: string;
  achievements: Record<string, boolean>;
  house?: string;
  soul?: { id: string; level: number; stars: number; bound: boolean };
  buff?: { pct: number; until: number };
  devForm?: string;
  disabled?: boolean;
  created: number;
}

interface Ctx {
  api: any;
  event: any;
  db: any;
  s: Profile;
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

const raidLobbies = new Map<string, { participants: string[]; initiator: string; expiresAt: number }>();
const tourneyLobbies = new Map<string, { participants: string[]; initiator: string; expiresAt: number }>();
const surges = new Map<string, { expiresAt: number; claimedBy: string | null }>();

const H: Record<string, Handler> = {};

const nowSec = (): number => Math.floor(Date.now() / 1000);
const rnd = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
const fmt = (n: number): string => Number(n || 0).toLocaleString("en-US");
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function bar(v: number, max: number, n = 10): string {
  const f = Math.max(0, Math.min(n, Math.floor((v / Math.max(1, max)) * n)));
  return "█".repeat(f) + "░".repeat(n - f);
}
function weighted<T extends { weight: number }>(arr: T[]): T {
  const total = arr.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= x.weight; if (r <= 0) return x; }
  return arr[arr.length - 1];
}
function isDevUser(id: string): boolean { return id === DEV_UID; }
function calcLevel(exp: number): number { return Math.max(1, Math.floor(exp / C.EXP_PER_LEVEL) + 1); }
function rarityIdx(r: string): number { return RARITY_ORDER.indexOf(r); }
function icon(r: string): string { return C.RARITY_ICON[r] || "⚪"; }

function styled(header: string, symbol: string, body: string): string {
  return AuroraBetaStyler.styleOutput({
    headerText: header, headerSymbol: symbol, headerStyle: "bold",
    bodyText: body, bodyStyle: "bold",
    footerText: "Developed by: **Aljur pogoy**",
  });
}

function isAuthorized(senderID: string, isDev: boolean): boolean {
  const sid = senderID.toString();
  return isDev
    || (global.config.admins && global.config.admins.map(String).includes(sid))
    || (global.config.developers && global.config.developers.map(String).includes(sid))
    || (global.config.vips && global.config.vips.map(String).includes(sid));
}

function emptyStats(): Stats { return { atk: 0, def: 0, mana: 0, luck: 0 }; }

function newProfile(userID: string): Profile {
  return {
    userID, name: undefined, bio: "", mainChar: undefined, chars: {}, clan: undefined,
    level: 1, exp: 0, prestige: 0, prestigePoints: 0, trained: emptyStats(), stats: emptyStats(), power: 0,
    coins: 0, gems: 0, pity: 0, charge: 0, stance: "balanced", bond: { level: 0, exp: 0 },
    inv: { weapons: {}, potions: {}, materials: {} }, equipped: {}, skills: [], equippedSkills: [],
    quests: { date: "", list: {} }, story: 0, cd: {}, counters: {}, lastDaily: 0, lastWeekly: 0, streak: 0,
    titles: [], activeTitle: undefined, achievements: {}, house: undefined, soul: undefined, buff: undefined,
    devForm: undefined, disabled: false, created: nowSec(),
  };
}

function normalize(raw: any, userID: string): Profile {
  const base = newProfile(userID);
  const p: any = { ...base, ...(raw || {}) };
  p.trained = { ...base.trained, ...(p.trained || {}) };
  p.stats = { ...base.stats, ...(p.stats || {}) };
  p.bond = { ...base.bond, ...(p.bond || {}) };
  p.inv = { weapons: {}, potions: {}, materials: {}, ...(p.inv || {}) };
  p.equipped = p.equipped || {};
  p.quests = p.quests && p.quests.list ? p.quests : { date: "", list: {} };
  p.cd = p.cd || {};
  p.counters = p.counters || {};
  p.chars = p.chars || {};
  p.skills = p.skills || [];
  p.equippedSkills = p.equippedSkills || [];
  p.titles = p.titles || [];
  p.achievements = p.achievements || {};
  return p as Profile;
}

async function getProfile(db: any, userID: string): Promise<Profile> {
  const raw = await db.db(COL_PLAYERS).findOne({ userID });
  return normalize(raw, userID);
}

async function saveProfile(db: any, p: Profile): Promise<void> {
  const { _id, ...data } = p as any;
  await db.db(COL_PLAYERS).updateOne({ userID: p.userID }, { $set: data }, { upsert: true });
}

async function findByName(db: any, name: string): Promise<Profile | null> {
  if (!name) return null;
  const raw = await db.db(COL_PLAYERS).findOne({ name });
  return raw && raw.name ? normalize(raw, raw.userID) : null;
}

function devForm(s: Profile): any {
  return D.forms.find((f: any) => f.id === (s.devForm || D.defaultForm)) || D.forms[D.forms.length - 1];
}

function devStats(s: Profile): Stats {
  const v = Math.floor(C.DEV_STATS * devForm(s).mult);
  return { atk: v, def: v, mana: v, luck: v };
}

function applyDevBuff(s: Profile): void {
  s.mainChar = D.characterId;
  s.clan = D.clanId;
  for (const ch of CHAR_LIST) s.chars[ch.id] = { stars: C.STAR_MAX, fav: s.chars[ch.id]?.fav || false };
  s.level = D.level; s.exp = D.exp; s.prestige = D.prestige;
  s.coins = D.coins; s.gems = D.gems; s.charge = 100;
  s.bond = { level: C.BOND_MAX_LEVEL, exp: 0 };
  s.story = STORY_LIST.length;
  s.skills = Object.keys(SKILL_MAP);
  if (!s.equippedSkills.length) s.equippedSkills = Object.keys(SKILL_MAP).slice(-C.MAX_EQUIPPED_SKILLS);
  s.titles = TITLE_LIST.map((t: any) => t.id);
  for (const id of Object.keys(WEAPON_MAP)) s.inv.weapons[id] = { level: C.WEAPON_MAX_UPGRADE, qty: 1 };
  s.equipped.weapon = Object.keys(WEAPON_MAP).slice(-1)[0];
  for (const id of Object.keys(POTION_MAP)) s.inv.potions[id] = D.potions;
  for (const k of Object.keys(MATERIAL_MAP)) s.inv.materials[k] = D.materials;
  s.soul = { id: SOUL_LIST[SOUL_LIST.length - 1].id, level: C.SOUL.MAX_LEVEL, stars: C.SOUL.MAX_STARS, bound: true };
  s.devForm = s.devForm || D.defaultForm;
  s.counters.wins = Math.max(s.counters.wins || 0, 99999);
  s.counters.bossKills = Math.max(s.counters.bossKills || 0, 9999);
  s.counters.duelWins = Math.max(s.counters.duelWins || 0, 9999);
  s.stats = devStats(s);
}

function skillPct(s: Profile): Stats {
  const out = emptyStats();
  for (const id of s.equippedSkills) {
    const sk = SKILL_MAP[id];
    if (!sk || !s.skills.includes(id)) continue;
    for (const k of STAT_KEYS) (out as any)[k] += sk.bonus[k] || 0;
  }
  return out;
}

function weaponBonus(s: Profile): { atk: number; def: number } {
  const id = s.equipped.weapon;
  const w = id ? WEAPON_MAP[id] : null;
  const owned = id ? s.inv.weapons[id] : null;
  if (!w || !owned) return { atk: 0, def: 0 };
  const m = 1 + C.WEAPON_UPGRADE_BONUS * (owned.level || 0);
  return { atk: w.atk * m, def: w.def * m };
}

function soulBonus(s: Profile): Stats {
  const out = emptyStats();
  if (!s.soul || !s.soul.bound) return out;
  const base = SOUL_LIST.find((x: any) => x.id === s.soul!.id);
  if (!base) return out;
  const m = (1 + C.SOUL.STAT_PER_LEVEL * (s.soul.level - 1)) * (1 + C.SOUL.STAR_MULT * s.soul.stars);
  for (const k of STAT_KEYS) (out as any)[k] = base[k] * m;
  return out;
}

function recalc(s: Profile): Stats {
  if (isDevUser(s.userID)) { s.stats = devStats(s); return s.stats; }
  const ch = CHAR_MAP[s.mainChar || ""];
  if (!ch) { s.stats = emptyStats(); return s.stats; }
  const cm = CLAN_MAP[s.clan || ""]?.mult || { atk: 1, def: 1, mana: 1, luck: 1 };
  const stars = s.chars[s.mainChar as string]?.stars || 1;
  const starMul = 1 + (stars - 1) * C.STAR_BONUS;
  const bondMul = 1 + s.bond.level * C.BOND_STAT_PER_LEVEL;
  const presMul = 1 + s.prestige * C.PRESTIGE_BONUS;
  const lvlMul = 1 + s.level * C.LEVEL_STAT_BONUS;
  const pct = skillPct(s);
  const wb = weaponBonus(s);
  const sb = soulBonus(s);
  const out: any = {};
  for (const k of STAT_KEYS) {
    let base = ch[k] * cm[k] * starMul + ((s.trained as any)[k] || 0) + (sb as any)[k];
    if (k === "atk") base += wb.atk;
    if (k === "def") base += wb.def;
    out[k] = Math.max(0, Math.floor(base * bondMul * presMul * lvlMul * (1 + (pct as any)[k])));
  }
  s.stats = out;
  return out;
}

function power(s: Profile, useStance = true): number {
  const st = s.stats;
  const sm = useStance ? (C.STANCES[s.stance || "balanced"] || C.STANCES.balanced) : { atk: 1, def: 1 };
  let p = st.atk * sm.atk + st.def * sm.def * 0.6 + st.mana * 0.5 + st.luck * 0.3;
  if (s.buff && s.buff.until > nowSec()) p *= 1 + s.buff.pct;
  return p;
}

function metric(s: Profile, k: string): number {
  switch (k) {
    case "level": return s.level;
    case "prestige": return s.prestige;
    case "collection": return Object.keys(s.chars).length;
    case "streak": return s.streak;
    case "story": return s.story;
    case "house": return s.house ? 1 : 0;
    case "xxsr": return CHAR_MAP[s.mainChar || ""]?.rarity === "XXSR" ? 1 : 0;
    case "soul": return s.soul ? s.soul.level : 0;
    case "bond": return s.bond.level;
    case "coins": return s.coins;
    case "skills": return s.skills.length;
    default: return s.counters[k] || 0;
  }
}

function grantTitles(s: Profile): string[] {
  const out: string[] = [];
  for (const t of TITLE_LIST) {
    if (!s.titles.includes(t.id) && metric(s, t.metric) >= t.min) { s.titles.push(t.id); out.push(t.id); }
  }
  return out;
}

function titleLine(ids: string[]): string {
  if (!ids.length) return "";
  return "\n\n🎖️ New Title(s) Unlocked: " + ids.map(id => TITLE_LIST.find((t: any) => t.id === id)?.label || id).join(", ");
}

function bump(s: Profile, key: string, n = 1): void { s.counters[key] = (s.counters[key] || 0) + n; }

function gain(s: Profile, r: { coins?: number; gems?: number; exp?: number }): void {
  s.coins += Math.floor(r.coins || 0);
  s.gems += Math.floor(r.gems || 0);
  if (r.exp) { s.exp += Math.floor(r.exp); s.level = calcLevel(s.exp); }
}

function ensureQuests(s: Profile): void {
  const today = new Date().toISOString().slice(0, 10);
  if (s.quests.date === today && Object.keys(s.quests.list).length) return;
  rollQuests(s, today);
}

function rollQuests(s: Profile, today: string): void {
  s.quests = { date: today, list: {} };
  const shuffled = [...QUEST_LIST].sort(() => Math.random() - 0.5).slice(0, C.QUESTS_PER_DAY);
  for (const q of shuffled) {
    s.quests.list[q.id] = { metric: q.metric, goal: q.goal, base: metric(s, q.metric), coins: q.coins, exp: q.exp, gems: q.gems || 0, desc: q.desc, claimed: false };
  }
}

function questDone(s: Profile, q: QuestEntry): number { return Math.max(0, Math.min(q.goal, metric(s, q.metric) - q.base)); }

function findChar(q: string): any {
  const t = (q || "").toLowerCase().trim();
  if (!t) return null;
  return CHAR_LIST.find((c: any) => c.id === t) || CHAR_LIST.find((c: any) => c.name.toLowerCase() === t) || CHAR_LIST.find((c: any) => c.name.toLowerCase().includes(t));
}

function findOwnedChar(s: Profile, q: string): any {
  const ch = findChar(q);
  return ch && s.chars[ch.id] ? ch : null;
}

function resolveItem(tok: string): { type: string; ref: string } | null {
  if (!tok) return null;
  const up = tok.toUpperCase();
  if (SHOP_MAP[up]) return { type: SHOP_MAP[up].type, ref: SHOP_MAP[up].ref };
  if (WEAPON_MAP[up]) return { type: "weapon", ref: up };
  if (POTION_MAP[up]) return { type: "potion", ref: up };
  const low = tok.toLowerCase();
  if (MATERIAL_MAP[low]) return { type: "material", ref: low };
  const m = Object.keys(MATERIAL_MAP).find(k => MATERIAL_MAP[k].name.toLowerCase() === low.replace(/_/g, " "));
  return m ? { type: "material", ref: m } : null;
}

function itemName(type: string, ref: string): string {
  if (type === "weapon") return WEAPON_MAP[ref]?.name || ref;
  if (type === "potion") return POTION_MAP[ref]?.name || ref;
  return MATERIAL_MAP[ref]?.name || ref;
}

function itemQty(s: Profile, type: string, ref: string): number {
  if (type === "weapon") return s.inv.weapons[ref]?.qty || 0;
  if (type === "potion") return s.inv.potions[ref] || 0;
  return s.inv.materials[ref] || 0;
}

function addItem(s: Profile, type: string, ref: string, qty: number, level = 0): void {
  if (type === "weapon") {
    const cur = s.inv.weapons[ref];
    if (cur) cur.qty += qty; else s.inv.weapons[ref] = { level, qty };
  } else if (type === "potion") s.inv.potions[ref] = (s.inv.potions[ref] || 0) + qty;
  else s.inv.materials[ref] = (s.inv.materials[ref] || 0) + qty;
}

function takeItem(s: Profile, type: string, ref: string, qty: number): boolean {
  if (itemQty(s, type, ref) < qty) return false;
  if (type === "weapon") {
    s.inv.weapons[ref].qty -= qty;
    if (s.inv.weapons[ref].qty <= 0) { delete s.inv.weapons[ref]; if (s.equipped.weapon === ref) s.equipped.weapon = undefined; }
  } else if (type === "potion") {
    s.inv.potions[ref] -= qty;
    if (s.inv.potions[ref] <= 0) delete s.inv.potions[ref];
  } else {
    s.inv.materials[ref] -= qty;
    if (s.inv.materials[ref] <= 0) delete s.inv.materials[ref];
  }
  return true;
}

function matsText(m: Record<string, number>): string {
  return Object.entries(m).map(([k, v]) => `${v}x ${MATERIAL_MAP[k]?.name || k}`).join(", ");
}

function hasMats(s: Profile, m: Record<string, number>): boolean {
  return Object.entries(m).every(([k, v]) => (s.inv.materials[k] || 0) >= v);
}

function takeMats(s: Profile, m: Record<string, number>): void {
  for (const [k, v] of Object.entries(m)) takeItem(s, "material", k, v);
}

function parseAmount(tok: string | undefined, max: number): number {
  if (!tok) return NaN;
  if (tok.toLowerCase() === "all") return max;
  return parseInt(tok.replace(/,/g, ""), 10);
}

async function spend(c: Ctx, coins: number, gems = 0): Promise<boolean> {
  if (c.isDev) return true;
  if (c.s.coins < coins || c.s.gems < gems) {
    const need = [coins ? `${fmt(coins)} 🪙` : "", gems ? `${fmt(gems)} 💎` : ""].filter(Boolean).join(" + ");
    await c.send("Insufficient Funds", "❌", `You need ${need}.\nYou have: ${fmt(c.s.coins)} 🪙 | ${fmt(c.s.gems)} 💎`);
    return false;
  }
  c.s.coins -= coins; c.s.gems -= gems;
  return true;
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

async function loadOther(c: Ctx, name: string): Promise<Profile | null> {
  const t = await findByName(c.db, name);
  if (!t) await c.send("Not Found", "❌", `Noble "${name}" not found.`);
  return t;
}

async function runFight(c: Ctx, enemy: any, o: { head: string; sym: string; rewardMult?: number; powerMult?: number; counter?: string; loseCoins?: boolean; chargeReset?: boolean }): Promise<void> {
  const s = c.s;
  const myPow = power(s) * (0.85 + Math.random() * 0.3) * (o.powerMult || 1);
  const enemyPow = (enemy.atk * 0.7 + enemy.def * 0.3) * (1 + s.level * 0.002) * (0.85 + Math.random() * 0.3);
  const win = c.isDev ? true : myPow > enemyPow;
  const m = o.rewardMult || 1;
  let coins = 0, exp = 0, gems = 0, dropText = "", lossText = "";
  if (win) {
    coins = Math.floor(enemy.coins * m); exp = Math.floor(enemy.exp * m);
    bump(s, "wins");
    if (enemy.boss) bump(s, "bossKills");
    if (o.counter) bump(s, o.counter);
    s.charge = Math.min(100, s.charge + C.CHARGE_PER_WIN);
    s.trained.atk += C.WIN_ATK_GAIN;
    const luckBonus = Math.min(0.3, s.stats.luck / (s.stats.luck + 20000));
    if (Math.random() < C.DROP_BASE + luckBonus && enemy.drop) {
      const q = enemy.boss ? rnd(2, 4) : rnd(1, 2);
      addItem(s, "material", enemy.drop, q);
      dropText = `\n🎁 Drop: ${q}x ${MATERIAL_MAP[enemy.drop]?.name || enemy.drop}`;
    }
    if (enemy.boss && Math.random() < 0.35) { gems = rnd(3, 10); }
  } else {
    exp = Math.floor(enemy.exp * 0.2);
    bump(s, "losses");
    if (o.loseCoins && !c.isDev) { const l = Math.min(s.coins, Math.floor(s.coins * 0.03)); s.coins -= l; lossText = `\n💸 Lost ${fmt(l)} 🪙 in the retreat.`; }
  }
  if (o.chargeReset && !c.isDev) s.charge = 0;
  gain(s, { coins, exp, gems });
  const nt = await c.save();
  await c.send(o.head, o.sym,
    `${win ? "✅ VICTORY" : "💀 DEFEAT"}\n\n👤 Enemy: ${enemy.name}\n⚔️ Your Power: ${fmt(Math.floor(myPow))}\n🛡️ Enemy Power: ${fmt(Math.floor(enemyPow))}\n\n${win ? `+${fmt(coins)} 🪙 | +${fmt(exp)} EXP${gems ? ` | +${gems} 💎` : ""}` : `+${fmt(exp)} EXP consolation`}${dropText}${lossText}\n⚡ Authority: ${s.charge}%${nt}`);
}

function grantStarter(s: Profile, clanId: string): any {
  const pool = CHAR_LIST.filter((x: any) => x.rarity === "R" && !x.devOnly);
  const ch = pick(pool);
  s.chars[ch.id] = { stars: 1, fav: false };
  s.mainChar = ch.id;
  s.clan = clanId;
  s.coins = C.STARTING.coins;
  s.gems = C.STARTING.gems;
  return ch;
}

function bannerChar(): any {
  const pool = CHAR_LIST.filter((x: any) => !x.devOnly && rarityIdx(x.rarity) >= 2 && x.rarity !== "XXSR");
  const week = Math.floor(Date.now() / (7 * 86400 * 1000));
  return pool[week % pool.length];
}

function rollRarity(s: Profile): string {
  s.pity += 1;
  const roll = Math.random() * 100;
  const r = C.SUMMON_RATES;
  let rar = roll < r.XXSR ? "XXSR" : roll < r.SSSR ? "SSSR" : roll < r.SSR ? "SSR" : roll < r.SR ? "SR" : "R";
  if (rarityIdx(rar) < 3 && s.pity >= C.PITY_THRESHOLD) rar = "SSSR";
  if (rarityIdx(rar) >= 3) s.pity = 0;
  return rar;
}

function pullOne(s: Profile, minRarity?: string): { ch: any; line: string } {
  let rar = rollRarity(s);
  if (minRarity && rarityIdx(rar) < rarityIdx(minRarity)) rar = minRarity;
  const pool = CHAR_LIST.filter((x: any) => x.rarity === rar && !x.devOnly);
  let ch = pick(pool);
  const b = bannerChar();
  if (b && b.rarity === rar && Math.random() < C.BANNER_RATE_UP) ch = b;
  const owned = s.chars[ch.id];
  let tag = "";
  if (!owned) { s.chars[ch.id] = { stars: 1, fav: false }; tag = "🆕 NEW"; }
  else if (owned.stars < C.STAR_MAX) { owned.stars += 1; tag = `⭐ ${owned.stars}★`; }
  else { const v = C.DUPE_COINS[rar]; s.coins += v; tag = `+${fmt(v)} 🪙`; }
  const cur = CHAR_MAP[s.mainChar || ""];
  if (!cur || rarityIdx(ch.rarity) > rarityIdx(cur.rarity)) s.mainChar = ch.id;
  bump(s, "summons");
  return { ch, line: `${icon(ch.rarity)} ${ch.name} [${ch.rarity}] ${tag}` };
}

function statLine(st: Stats): string {
  return `ATK: ${fmt(st.atk)} | DEF: ${fmt(st.def)}\nMana: ${fmt(st.mana)} | Luck: ${fmt(st.luck)}`;
}

H["register"] = async (c) => {
  const { s } = c;
  if (s.name) { await c.send("Registration", "🛑", `You are already registered as ${s.name}. Use /noblesse status.`); return; }
  const name = c.rest.join(" ").trim();
  if (name.length < C.NAME_MIN || name.length > C.NAME_MAX) {
    await c.send("Registration", "⚠️", `Please provide a valid name (${C.NAME_MIN}-${C.NAME_MAX} characters).\nUsage: /noblesse register <name>`); return;
  }
  if (await findByName(c.db, name)) { await c.send("Registration", "❌", `The name "${name}" is already taken.`); return; }
  if (c.isDev) {
    s.name = name;
    applyDevBuff(s);
    s.counters.wins = Math.max(s.counters.wins || 0, 99999);
    const nt = await c.save();
    await c.send("Registration", "👑",
      `👑 DEVELOPER ACCOUNT CREATED\n\nNoble: ${name}\nCharacter: ${D.displayName} [XXSR]\nTitle: ${D.title}\nClan: ${CLAN_MAP[D.clanId].name}\nForm: ${devForm(s).name}\n\n${statLine(s.stats)}\n\n🪙 Gold: ${fmt(s.coins)} | 💎 Crystals: ${fmt(s.gems)}\nLevel: ${fmt(s.level)} | Prestige: ${s.prestige}\n\n⚠️ All characters, skills, weapons, titles, story chapters and a bound Noblesse Soul Weapon are unlocked.${nt}`);
    return;
  }
  const clans = CLAN_LIST.filter((x: any) => !x.devOnly);
  const list = clans.map((x: any, i: number) => `${i + 1}. ${x.name} — ${x.perk}`).join("\n");
  const info: any = await new Promise(resolve => {
    c.api.sendMessage(styled("Registration", "🌙", `Welcome, ${name}!\n\nChoose your Clan by replying with its number:\n\n${list}\n\nReply with a number to continue.`), c.tid, (err: any, i: any) => resolve(i), c.mid);
  });
  const msgID = info?.messageID;
  if (!msgID) return;
  global.registerEnkiduListener(msgID, async ({ api, event }: any) => {
    if (event.senderID.toString() !== c.sid) return;
    const choice = parseInt(event.body?.trim());
    if (isNaN(choice) || choice < 1 || choice > clans.length) {
      await api.sendMessage(styled("Registration", "⚠️", "Invalid choice. Reply with a number from the list."), event.threadID, event.messageID);
      return;
    }
    global.replyListeners.delete(msgID);
    const fresh = await getProfile(c.db, c.sid);
    if (fresh.name) { await api.sendMessage(styled("Registration", "🛑", "You are already registered."), event.threadID, event.messageID); return; }
    const clan = clans[choice - 1];
    fresh.name = name;
    const ch = grantStarter(fresh, clan.id);
    recalc(fresh);
    fresh.power = Math.floor(power(fresh, false));
    const nt = titleLine(grantTitles(fresh));
    await saveProfile(c.db, fresh);
    await api.sendMessage(styled("Registration", "✅",
      `Registration complete!\n\nNoble: ${name}\nClan: ${clan.name}\nStarter: ${ch.name} [${ch.rarity}]\n\n${statLine(fresh.stats)}\n\n💎 ${C.STARTING.gems} Crystals | 🪙 ${C.STARTING.coins} Gold\n\nUse /noblesse battle to begin!\nUse /noblesse summon to roll for stronger characters.${nt}`), event.threadID, event.messageID);
  });
};

H["status"] = async (c) => {
  const s = c.s;
  const ch = CHAR_MAP[s.mainChar || ""];
  const title = s.activeTitle ? (TITLE_LIST.find((t: any) => t.id === s.activeTitle)?.label || "") : "";
  const weapon = s.equipped.weapon ? `${WEAPON_MAP[s.equipped.weapon].name} +${s.inv.weapons[s.equipped.weapon]?.level || 0}` : "None";
  const soul = s.soul ? `${SOUL_LIST.find((x: any) => x.id === s.soul!.id)?.name} Lv.${s.soul.level} ${"★".repeat(s.soul.stars)}${s.soul.bound ? " (bound)" : " (unbound)"}` : "None";
  const skills = s.equippedSkills.map(id => SKILL_MAP[id]?.name).filter(Boolean).join(", ") || "None";
  const buff = s.buff && s.buff.until > c.now ? `\n🍜 Buff: +${Math.round(s.buff.pct * 100)}% power (${s.buff.until - c.now}s)` : "";
  const next = s.story < STORY_LIST.length ? `Next: ${STORY_LIST[s.story].name}` : "All chapters cleared ✅";
  await c.send("Noble Status", "🌙",
    `${title ? title + "\n" : ""}👤 ${s.name}${c.isDev ? " 👑 [DEVELOPER]" : ""}
${ch ? `${icon(ch.rarity)} Character: ${ch.name} [${ch.rarity}] ${"★".repeat(s.chars[ch.id]?.stars || 1)}` : ""}
🩸 Clan: ${CLAN_MAP[s.clan || ""]?.name || "—"}${c.isDev ? `\n🌌 Form: ${devForm(s).name}` : ""}
🥋 Stance: ${s.stance}

${statLine(s.stats)}
💥 Power: ${fmt(Math.floor(power(s)))}

🎖️ Level: ${fmt(s.level)} | EXP: ${fmt(s.exp)}${s.prestige ? ` | 🌟 Prestige ${s.prestige}` : ""}
💛 Bond: Lv.${s.bond.level}/${C.BOND_MAX_LEVEL}
⚡ Authority: [${bar(s.charge, 100)}] ${s.charge}%${buff}

🪙 Gold: ${fmt(s.coins)}
💎 Crystals: ${fmt(s.gems)}
🏰 House: ${s.house || "None"}
📖 Story: ${next}

🗡️ Weapon: ${weapon}
👻 Soul Weapon: ${soul}
🌀 Skills: ${skills}`);
};

H["profile"] = async (c) => {
  const name = c.rest.join(" ").trim();
  if (!name) { await H["status"](c); return; }
  const t = await loadOther(c, name);
  if (!t) return;
  const ch = CHAR_MAP[t.mainChar || ""];
  const title = t.activeTitle ? (TITLE_LIST.find((x: any) => x.id === t.activeTitle)?.label || "") : "";
  await c.send("Noble Profile", "👤",
    `${title ? title + "\n" : ""}${t.name}${isDevUser(t.userID) ? " 👑" : ""}\n${t.bio ? `"${t.bio}"\n` : ""}\nCharacter: ${ch ? `${ch.name} [${ch.rarity}]` : "—"}\nClan: ${CLAN_MAP[t.clan || ""]?.name || "—"}\nLevel: ${fmt(t.level)} | Prestige: ${t.prestige}\nPower: ${fmt(t.power || 0)}\nWins: ${fmt(t.counters.wins || 0)}\nHouse: ${t.house || "None"}`);
};

H["changename"] = async (c) => {
  const nn = c.rest.join(" ").trim();
  if (nn.length < C.NAME_MIN || nn.length > C.NAME_MAX) { await c.send("Change Name", "⚠️", `Usage: /noblesse changename <new name> (${C.NAME_MIN}-${C.NAME_MAX} characters)`); return; }
  if (await findByName(c.db, nn)) { await c.send("Change Name", "❌", `The name "${nn}" is already taken.`); return; }
  if (!(await spend(c, C.CHANGENAME_COST))) return;
  const old = c.s.name;
  c.s.name = nn;
  const nt = await c.save();
  await c.send("Change Name", "✅", `Name changed: ${old} → ${nn}${c.isDev ? "" : `\nCost: ${fmt(C.CHANGENAME_COST)} 🪙`}${nt}`);
};

H["daily"] = async (c) => {
  const s = c.s;
  const gap = c.now - s.lastDaily;
  if (!c.isDev && gap < 86400) {
    const r = 86400 - gap;
    await c.send("Daily Reward", "⏳", `Already claimed. Come back in ${Math.floor(r / 3600)}h ${Math.floor((r % 3600) / 60)}m.`); return;
  }
  s.streak = gap < 172800 && s.lastDaily ? s.streak + 1 : 1;
  s.lastDaily = c.now;
  const bonus = Math.min(s.streak, C.DAILY.streakCap) * C.DAILY.streakCoins;
  gain(s, { coins: C.DAILY.coins + bonus, gems: C.DAILY.gems, exp: C.DAILY.exp });
  const nt = await c.save();
  await c.send("Daily Reward", "🎁", `Daily claimed!\n\n+${fmt(C.DAILY.coins + bonus)} 🪙 | +${C.DAILY.gems} 💎 | +${fmt(C.DAILY.exp)} EXP\n🔥 Streak: ${s.streak} day(s) (+${fmt(bonus)} 🪙 bonus)${nt}`);
};

H["weekly"] = async (c) => {
  const s = c.s;
  const gap = c.now - s.lastWeekly;
  if (!c.isDev && gap < 604800) {
    const r = 604800 - gap;
    await c.send("Weekly Reward", "⏳", `Already claimed. Come back in ${Math.floor(r / 86400)}d ${Math.floor((r % 86400) / 3600)}h.`); return;
  }
  s.lastWeekly = c.now;
  gain(s, C.WEEKLY);
  const nt = await c.save();
  await c.send("Weekly Reward", "🎁", `Weekly claimed!\n\n+${fmt(C.WEEKLY.coins)} 🪙 | +${C.WEEKLY.gems} 💎 | +${fmt(C.WEEKLY.exp)} EXP${nt}`);
};

H["balance"] = async (c) => {
  const s = c.s;
  await c.send("Balance", "💰", `🪙 Gold: ${fmt(s.coins)}\n💎 Crystals: ${fmt(s.gems)}\n🎲 Pity: ${s.pity}/${C.PITY_THRESHOLD}\n🌟 Prestige Points: ${s.prestigePoints}`);
};

H["stats"] = async (c) => {
  const s = c.s;
  const ch = CHAR_MAP[s.mainChar || ""];
  if (!ch) { await c.send("Stats", "⚠️", "No main character set."); return; }
  const cm = CLAN_MAP[s.clan || ""]?.mult || { atk: 1, def: 1, mana: 1, luck: 1 };
  const stars = s.chars[ch.id]?.stars || 1;
  const wb = weaponBonus(s), sb = soulBonus(s), pct = skillPct(s);
  const lines = STAT_KEYS.map(k => {
    const base = Math.floor(ch[k] * cm[k] * (1 + (stars - 1) * C.STAR_BONUS));
    const extra = k === "atk" ? wb.atk : k === "def" ? wb.def : 0;
    return `${k.toUpperCase()}: ${fmt((s.stats as any)[k])}\n  base ${fmt(base)} | trained ${fmt((s.trained as any)[k])} | gear ${fmt(Math.floor(extra))} | soul ${fmt(Math.floor((sb as any)[k]))} | skills +${Math.round((pct as any)[k] * 100)}%`;
  }).join("\n");
  await c.send("Stat Breakdown", "📊",
    `${lines}\n\nMultipliers:\n💛 Bond x${(1 + s.bond.level * C.BOND_STAT_PER_LEVEL).toFixed(2)}\n🌟 Prestige x${(1 + s.prestige * C.PRESTIGE_BONUS).toFixed(2)}\n🎖️ Level x${(1 + s.level * C.LEVEL_STAT_BONUS).toFixed(2)}\n⭐ Stars x${(1 + (stars - 1) * C.STAR_BONUS).toFixed(2)}\n\n💥 Power: ${fmt(Math.floor(power(s)))}`);
};

H["rank"] = async (c) => {
  const mine = Math.floor(power(c.s, false));
  const higher = await c.col(COL_PLAYERS).find({ power: { $gt: mine } }).limit(5000).toArray();
  await c.send("Power Rank", "🏅", `Your power: ${fmt(mine)}\nYour rank: #${higher.length + 1}`);
};

H["level"] = async (c) => {
  const s = c.s;
  const into = s.exp % C.EXP_PER_LEVEL;
  await c.send("Level", "🎖️", `Level ${fmt(s.level)}\nEXP: ${fmt(s.exp)}\n[${bar(into, C.EXP_PER_LEVEL)}] ${fmt(into)}/${fmt(C.EXP_PER_LEVEL)}`);
};

H["title.list"] = async (c) => {
  const s = c.s;
  const lines = TITLE_LIST.map((t: any) => {
    const has = s.titles.includes(t.id);
    return `${has ? "✅" : "🔒"} ${t.label} (${t.id})${has ? "" : ` — ${fmt(Math.min(metric(s, t.metric), t.min))}/${fmt(t.min)}`}`;
  }).join("\n");
  await c.send("Titles", "🎖️", `Active: ${s.activeTitle ? (TITLE_LIST.find((t: any) => t.id === s.activeTitle)?.label) : "None"}\n\n${lines}\n\nUse /noblesse title set <id>`);
};

H["title.set"] = async (c) => {
  const id = (c.rest[0] || "").toLowerCase();
  const t = TITLE_LIST.find((x: any) => x.id === id);
  if (!t) { await c.send("Titles", "⚠️", "Invalid title ID. Use /noblesse title list."); return; }
  if (!c.s.titles.includes(id)) { await c.send("Titles", "🔒", "You have not unlocked that title."); return; }
  c.s.activeTitle = id;
  await c.save();
  await c.send("Titles", "✅", `Equipped: ${t.label}`);
};

H["bio"] = async (c) => {
  const text = c.rest.join(" ").trim();
  if (!text) { await c.send("Bio", "⚠️", `Usage: /noblesse bio <text> (max ${C.BIO_MAX} characters)`); return; }
  if (text.length > C.BIO_MAX) { await c.send("Bio", "⚠️", `Too long. Max ${C.BIO_MAX} characters.`); return; }
  c.s.bio = text;
  await c.save();
  await c.send("Bio", "✅", `Bio updated:\n"${text}"`);
};

H["reset"] = async (c) => {
  if ((c.rest[0] || "").toLowerCase() !== "confirm") {
    await c.send("Reset", "⚠️", "This wipes your progress and cannot be undone.\nType /noblesse reset confirm to proceed."); return;
  }
  const fresh = newProfile(c.sid);
  fresh.name = c.s.name;
  grantStarter(fresh, "human");
  Object.assign(c.s, fresh);
  if (c.isDev) applyDevBuff(c.s);
  const nt = await c.save();
  await c.send("Reset", "✅", `Your account has been reset.\nStarter: ${CHAR_MAP[c.s.mainChar || ""].name}${nt}`);
};

H["summon"] = async (c) => {
  if (!(await spend(c, 0, C.SUMMON_COST_GEMS))) return;
  const r = pullOne(c.s);
  const nt = await c.save();
  await c.send("Summoning", "✨", `Summoning Circle Activated!\n\n${r.ch.rarity === "XXSR" ? "🌌 LEGENDARY PULL! 🌌\n\n" : r.ch.rarity === "SSSR" ? "⭐ ULTRA RARE PULL! ⭐\n\n" : ""}${r.line}\n"${r.ch.epithet}"\nAuthority: ${r.ch.ability}\n\n🎲 Pity: ${c.s.pity}/${C.PITY_THRESHOLD}${nt}`);
};

H["multisummon"] = async (c) => {
  if (!(await spend(c, 0, C.MULTI_SUMMON_COST_GEMS))) return;
  const lines: string[] = [];
  for (let i = 0; i < C.MULTI_SUMMON_COUNT; i++) lines.push(pullOne(c.s, i === C.MULTI_SUMMON_COUNT - 1 ? "SR" : undefined).line);
  const nt = await c.save();
  await c.send("Multi Summon", "✨", `${lines.join("\n")}\n\n🎲 Pity: ${c.s.pity}/${C.PITY_THRESHOLD}${nt}`);
};

H["pity"] = async (c) => {
  await c.send("Pity", "🎲", `Pity: ${c.s.pity}/${C.PITY_THRESHOLD}\n[${bar(c.s.pity, C.PITY_THRESHOLD)}]\nAt ${C.PITY_THRESHOLD} summons without an SSSR or better, the next pull is guaranteed SSSR+.`);
};

H["rates"] = async (c) => {
  const r = C.SUMMON_RATES;
  await c.send("Summon Rates", "📊", `🌌 XXSR: ${r.XXSR}%\n🟣 SSSR: ${(r.SSSR - r.XXSR).toFixed(1)}%\n🔵 SSR: ${(r.SSR - r.SSSR).toFixed(1)}%\n🟢 SR: ${(r.SR - r.SSR).toFixed(1)}%\n⚪ R: ${(100 - r.SR).toFixed(1)}%\n\nSingle: ${C.SUMMON_COST_GEMS} 💎 | x${C.MULTI_SUMMON_COUNT}: ${C.MULTI_SUMMON_COST_GEMS} 💎`);
};

H["banner"] = async (c) => {
  const b = bannerChar();
  await c.send("Featured Banner", "🎴", `This week's featured character:\n\n${icon(b.rarity)} ${b.name} [${b.rarity}]\n"${b.epithet}"\nAuthority: ${b.ability}\n\n${Math.round(C.BANNER_RATE_UP * 100)}% of ${b.rarity} pulls become ${b.name}.`);
};

H["collection"] = async (c) => {
  const s = c.s;
  const owned = Object.keys(s.chars).map(id => CHAR_MAP[id]).filter(Boolean).sort((a: any, b: any) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || a.name.localeCompare(b.name));
  const lines = owned.map((ch: any) => `${s.chars[ch.id].fav ? "💖" : icon(ch.rarity)} ${ch.name} [${ch.rarity}] ${"★".repeat(s.chars[ch.id].stars)}${ch.id === s.mainChar ? " 👑" : ""} (${ch.id})`);
  await c.send("Collection", "📚", `Owned: ${owned.length}/${CHAR_LIST.length}\n\n${lines.join("\n")}`);
};

H["charlist"] = async (c) => {
  const sorted = [...CHAR_LIST].filter((x: any) => !x.devOnly).sort((a: any, b: any) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || a.name.localeCompare(b.name));
  const p = pageOf(sorted, parseInt(c.rest[0]) || 1, 15);
  await c.send("Character Pool", "📖", `Page ${p.page}/${p.pages}\n\n${p.items.map((x: any) => `${icon(x.rarity)} ${x.name} [${x.rarity}] — ${x.faction} (${x.id})`).join("\n")}`);
};

H["charinfo"] = async (c) => {
  const ch = findChar(c.rest.join(" "));
  if (!ch || (ch.devOnly && !c.isDev && !c.s.chars[ch.id])) { await c.send("Character", "❌", "Character not found. Use /noblesse charlist."); return; }
  const own = c.s.chars[ch.id];
  await c.send(ch.name, icon(ch.rarity),
    `${icon(ch.rarity)} [${ch.rarity}] ${ch.faction}\n"${ch.epithet}"\n\nATK: ${fmt(ch.atk)} | DEF: ${fmt(ch.def)}\nMana: ${fmt(ch.mana)} | Luck: ${fmt(ch.luck)}\n\n⚡ ${ch.ability}\n${ch.abilityText}\nAuthority multiplier: x${C.AUTHORITY_MULT[ch.rarity]}\n\n${own ? `Owned: ${"★".repeat(own.stars)}${ch.id === c.s.mainChar ? " (main)" : ""}` : "Not owned"}`);
};

H["setmain"] = async (c) => {
  const ch = findOwnedChar(c.s, c.rest.join(" "));
  if (!ch) { await c.send("Main Character", "❌", "You do not own that character. Use /noblesse collection."); return; }
  if (c.isDev) { await c.send("Main Character", "👑", `The developer account is permanently bound to ${D.displayName}.`); return; }
  c.s.mainChar = ch.id;
  const nt = await c.save();
  await c.send("Main Character", "✅", `Main character set to ${ch.name} [${ch.rarity}].\n\n${statLine(c.s.stats)}${nt}`);
};

H["awaken"] = async (c) => {
  const ch = findOwnedChar(c.s, c.rest.join(" "));
  if (!ch) { await c.send("Awaken", "❌", "You do not own that character."); return; }
  const own = c.s.chars[ch.id];
  if (own.stars >= C.STAR_MAX) { await c.send("Awaken", "🌟", `${ch.name} is already at max stars.`); return; }
  const cost = C.AWAKEN_COST[own.stars - 1];
  if (!(await spend(c, cost.coins, cost.gems))) return;
  own.stars += 1;
  const nt = await c.save();
  await c.send("Awaken", "🌟", `${ch.name} awakened to ${"★".repeat(own.stars)}!\nCost: ${fmt(cost.coins)} 🪙 + ${fmt(cost.gems)} 💎${nt}`);
};

H["dismiss"] = async (c) => {
  const ch = findOwnedChar(c.s, c.rest.join(" "));
  if (!ch) { await c.send("Dismiss", "❌", "You do not own that character."); return; }
  if (ch.id === c.s.mainChar) { await c.send("Dismiss", "🛑", "You cannot dismiss your main character."); return; }
  if (c.s.chars[ch.id].fav) { await c.send("Dismiss", "🛑", "Unfavorite this character first."); return; }
  const v = C.DISMISS_VALUE[ch.rarity] * c.s.chars[ch.id].stars;
  delete c.s.chars[ch.id];
  c.s.coins += v;
  await c.save();
  await c.send("Dismiss", "✅", `${ch.name} was dismissed for ${fmt(v)} 🪙.`);
};

H["compare"] = async (c) => {
  const a = findChar(c.rest[0] || ""), b = findChar(c.rest[1] || "");
  if (!a || !b) { await c.send("Compare", "⚠️", "Usage: /noblesse compare <idA> <idB>\nUse character IDs from /noblesse charlist."); return; }
  const row = (k: string) => `${k.toUpperCase()}: ${fmt(a[k])} vs ${fmt(b[k])} ${a[k] > b[k] ? "◀" : a[k] < b[k] ? "▶" : "="}`;
  await c.send("Compare", "⚖️", `${a.name} [${a.rarity}] vs ${b.name} [${b.rarity}]\n\n${STAT_KEYS.map(row).join("\n")}`);
};

H["favorite"] = async (c) => {
  const ch = findOwnedChar(c.s, c.rest.join(" "));
  if (!ch) { await c.send("Favorite", "❌", "You do not own that character."); return; }
  c.s.chars[ch.id].fav = true;
  await c.save();
  await c.send("Favorite", "💖", `${ch.name} marked as favorite.`);
};

H["unfavorite"] = async (c) => {
  const ch = findOwnedChar(c.s, c.rest.join(" "));
  if (!ch) { await c.send("Favorite", "❌", "You do not own that character."); return; }
  c.s.chars[ch.id].fav = false;
  await c.save();
  await c.send("Favorite", "✅", `${ch.name} is no longer a favorite.`);
};

const MASTERY = [{ n: "Initiate", w: 0 }, { n: "Adept", w: 25 }, { n: "Veteran", w: 100 }, { n: "Elite", w: 300 }, { n: "Master", w: 800 }, { n: "Grandmaster", w: 2000 }, { n: "Legend", w: 5000 }];

function clanText(cl: any): string {
  const m = cl.mult;
  return `${cl.name} (${cl.id})\nATK x${m.atk} | DEF x${m.def} | Mana x${m.mana} | Luck x${m.luck}\n${cl.perk}\n"${cl.flavor}"`;
}

H["clan.list"] = async (c) => {
  await c.send("Clans", "🩸", CLAN_LIST.filter((x: any) => !x.devOnly).map(clanText).join("\n\n") + "\n\nUse /noblesse clan set <id>");
};

H["clan.set"] = async (c) => {
  const cl = CLAN_MAP[(c.rest[0] || "").toLowerCase()];
  if (!cl || cl.devOnly) { await c.send("Clan", "⚠️", "Invalid clan ID. Use /noblesse clan list."); return; }
  if (c.isDev) { await c.send("Clan", "👑", `The developer account is permanently in the ${CLAN_MAP[D.clanId].name} clan.`); return; }
  if (c.s.clan === cl.id) { await c.send("Clan", "🛑", "You already belong to that clan."); return; }
  if (!(await spend(c, C.CLAN_CHANGE_COST))) return;
  c.s.clan = cl.id;
  const nt = await c.save();
  await c.send("Clan", "✅", `You now belong to ${cl.name}.\n\n${statLine(c.s.stats)}\nCost: ${fmt(C.CLAN_CHANGE_COST)} 🪙${nt}`);
};

H["clan.info"] = async (c) => {
  const cl = CLAN_MAP[(c.rest[0] || c.s.clan || "").toLowerCase()];
  if (!cl) { await c.send("Clan", "⚠️", "Clan not found. Use /noblesse clan list."); return; }
  await c.send("Clan Info", "🩸", clanText(cl));
};

H["clan.mastery"] = async (c) => {
  const wins = c.s.counters.wins || 0;
  let idx = 0;
  MASTERY.forEach((m, i) => { if (wins >= m.w) idx = i; });
  const next = MASTERY[idx + 1];
  await c.send("Clan Mastery", "🏵️", `${CLAN_MAP[c.s.clan || ""]?.name || "—"}\nRank: ${MASTERY[idx].n}\nWins: ${fmt(wins)}${next ? `\nNext: ${next.n} at ${fmt(next.w)} wins\n[${bar(wins - MASTERY[idx].w, next.w - MASTERY[idx].w)}]` : "\nMax rank reached."}`);
};

H["clan.perks"] = async (c) => {
  const cl = CLAN_MAP[c.s.clan || ""];
  await c.send("Clan Perks", "🩸", cl ? clanText(cl) : "You have no clan.");
};

H["clan.compare"] = async (c) => {
  const a = CLAN_MAP[(c.rest[0] || "").toLowerCase()], b = CLAN_MAP[(c.rest[1] || "").toLowerCase()];
  if (!a || !b) { await c.send("Clan Compare", "⚠️", "Usage: /noblesse clan compare <idA> <idB>"); return; }
  const row = (k: string) => `${k.toUpperCase()}: x${a.mult[k]} vs x${b.mult[k]} ${a.mult[k] > b.mult[k] ? "◀" : a.mult[k] < b.mult[k] ? "▶" : "="}`;
  await c.send("Clan Compare", "⚖️", `${a.name} vs ${b.name}\n\n${STAT_KEYS.map(row).join("\n")}`);
};

async function afford(c: Ctx, coins: number, gems = 0): Promise<boolean> {
  if (c.isDev) return true;
  if (c.s.coins < coins || c.s.gems < gems) {
    const need = [coins ? `${fmt(coins)} 🪙` : "", gems ? `${fmt(gems)} 💎` : ""].filter(Boolean).join(" + ");
    await c.send("Insufficient Funds", "❌", `You need ${need}.\nYou have: ${fmt(c.s.coins)} 🪙 | ${fmt(c.s.gems)} 💎`);
    return false;
  }
  return true;
}

function charge(c: Ctx, coins: number, gems = 0): void {
  if (c.isDev) return;
  c.s.coins -= coins; c.s.gems -= gems;
}

const enemyPower = (e: any): number => e.atk * 0.7 + e.def * 0.3;

function pickEnemy(s: Profile, pool: any[], lo = 0.3, hi = 1.5): any {
  const p = power(s);
  const ok = pool.filter(e => enemyPower(e) >= p * lo && enemyPower(e) <= p * hi);
  if (ok.length) return pick(ok);
  return [...pool].sort((a, b) => Math.abs(enemyPower(a) - p) - Math.abs(enemyPower(b) - p))[0];
}

const normalEnemies = (): any[] => ENEMY_LIST.filter((e: any) => !e.boss);
const bossEnemies = (): any[] => ENEMY_LIST.filter((e: any) => e.boss);

H["battle"] = async (c) => {
  if (await c.onCd("battle", C.COOLDOWNS.battle)) return;
  await runFight(c, pickEnemy(c.s, normalEnemies()), { head: "Battle", sym: "⚔️" });
};

H["hunt"] = async (c) => {
  if (await c.onCd("hunt", C.COOLDOWNS.hunt)) return;
  await runFight(c, pickEnemy(c.s, normalEnemies()), { head: "Hunt", sym: "🐺", counter: "hunts", rewardMult: 1.2 });
};

H["ambush"] = async (c) => {
  if (await c.onCd("ambush", C.COOLDOWNS.ambush)) return;
  const pool = normalEnemies().filter((e: any) => ["elite", "noble", "experiment"].includes(e.tag));
  await runFight(c, pickEnemy(c.s, pool, 0.4, 2), { head: "Ambush", sym: "🗡️", powerMult: 1.25, rewardMult: 1.5, loseCoins: true });
};

H["boss"] = async (c) => {
  if (await c.onCd("boss", C.COOLDOWNS.boss)) return;
  await runFight(c, pickEnemy(c.s, bossEnemies(), 0.3, 2), { head: "Boss Battle", sym: "💀", counter: "bossFights", rewardMult: 1.5, loseCoins: true });
};

H["bounty"] = async (c) => {
  if (await c.onCd("bounty", C.COOLDOWNS.bounty)) return;
  const pool = ENEMY_LIST.filter((e: any) => e.boss || ["nightmare", "elite"].includes(e.tag));
  await runFight(c, pickEnemy(c.s, pool, 0.3, 2), { head: "Bounty", sym: "🎯", counter: "bounties", rewardMult: 3, loseCoins: true });
};

H["authority"] = async (c) => {
  const s = c.s;
  if (!c.isDev && s.charge < 100) { await c.send("Authority", "⚠️", `Authority charge: ${s.charge}%/100%\n[${bar(s.charge, 100)}]\nWin fights to fill the gauge.`); return; }
  if (await c.onCd("authority", C.COOLDOWNS.authority)) return;
  const ch = CHAR_MAP[s.mainChar || ""];
  const mult = C.AUTHORITY_MULT[ch?.rarity || "R"];
  const pool = ENEMY_LIST.filter((e: any) => e.boss || e.tag === "nightmare");
  const enemy = pickEnemy(s, pool, 0.5, 3);
  await c.send(ch?.ability || "Authority", "⚡", `${ch?.name} unleashes ${ch?.ability}!\n${ch?.abilityText}\nPower x${mult}`);
  await runFight(c, enemy, { head: "Authority", sym: "⚡", powerMult: mult, rewardMult: 2.5, counter: "authorities", chargeReset: true });
};

H["stance"] = async (c) => {
  const v = (c.rest[0] || "").toLowerCase();
  if (!C.STANCES[v]) {
    await c.send("Stance", "🥋", `Current: ${c.s.stance}\n\n${Object.entries(C.STANCES).map(([k, m]: any) => `${k}: ATK x${m.atk} | DEF x${m.def}`).join("\n")}\n\nUsage: /noblesse stance <offense/defense/balanced>`); return;
  }
  c.s.stance = v;
  await c.save();
  await c.send("Stance", "✅", `Stance set to ${v}.`);
};

H["duel"] = async (c) => {
  const name = c.rest.join(" ").trim();
  if (!name) { await c.send("Duel", "⚠️", "Usage: /noblesse duel <name>"); return; }
  const t = await loadOther(c, name);
  if (!t) return;
  if (t.userID === c.sid) { await c.send("Duel", "🛑", "You cannot duel yourself."); return; }
  if (t.disabled) { await c.send("Duel", "🛑", "That Noble cannot be challenged right now."); return; }
  if (await c.onCd("duel", C.COOLDOWNS.duel)) return;
  if (isDevUser(t.userID)) t.stats = devStats(t);
  const a = power(c.s) * (0.85 + Math.random() * 0.3);
  const b = power(t) * (0.85 + Math.random() * 0.3);
  const win = c.isDev ? true : a > b;
  const sc = 1 + c.s.level * 0.02;
  bump(c.s, "duels");
  if (win) { bump(c.s, "duelWins"); bump(c.s, "wins"); gain(c.s, { coins: C.DUEL_REWARD.coins * sc, exp: C.DUEL_REWARD.exp * sc }); }
  else gain(c.s, { exp: C.DUEL_REWARD.exp * 0.25 });
  const nt = await c.save();
  await c.send("Duel", "🤺", `${c.s.name} vs ${t.name}\n\n⚔️ ${c.s.name}: ${fmt(Math.floor(a))}\n🛡️ ${t.name}: ${fmt(Math.floor(b))}\n\n${win ? `🏆 ${c.s.name} wins!\n+${fmt(Math.floor(C.DUEL_REWARD.coins * sc))} 🪙 | +${fmt(Math.floor(C.DUEL_REWARD.exp * sc))} EXP` : `💀 ${t.name} wins!\n+${fmt(Math.floor(C.DUEL_REWARD.exp * 0.25))} EXP consolation`}${nt}`);
};

H["spar"] = async (c) => {
  if (await c.onCd("spar", C.COOLDOWNS.spar)) return;
  const s = c.s;
  const stat = pick(STAT_KEYS);
  const g = Math.max(1, Math.floor(rnd(2, 6) * (1 + s.level * 0.01)));
  (s.trained as any)[stat] += g;
  const exp = Math.floor(rnd(80, 200) * (1 + s.level * 0.01));
  gain(s, { exp });
  bump(s, "spars");
  const nt = await c.save();
  await c.send("Spar", "🥋", `You spar with a shadow of yourself and learn from every exchange.\n\n+${fmt(exp)} EXP | +${g} trained ${stat.toUpperCase()}${nt}`);
};

H["arena"] = async (c) => {
  if (await c.onCd("arena", C.COOLDOWNS.arena)) return;
  const s = c.s;
  const rating = s.counters.arenaRating ?? C.ARENA.START_RATING;
  const oppPow = power(s) * (0.7 + Math.random() * 0.6) * (0.9 + (rating - C.ARENA.START_RATING) / 4000);
  const myPow = power(s) * (0.85 + Math.random() * 0.3);
  const win = c.isDev ? true : myPow > oppPow;
  let text: string;
  if (win) {
    s.counters.arenaRating = rating + C.ARENA.WIN;
    bump(s, "arenaWins"); bump(s, "wins");
    const coins = Math.floor(200 + rating * 0.3), exp = Math.floor(150 + rating * 0.2);
    const gems = Math.random() < C.ARENA.GEM_CHANCE ? rnd(1, 3) : 0;
    gain(s, { coins, exp, gems });
    text = `🏆 Victory! Rating +${C.ARENA.WIN}\n+${fmt(coins)} 🪙 | +${fmt(exp)} EXP${gems ? ` | +${gems} 💎` : ""}`;
  } else {
    s.counters.arenaRating = Math.max(0, rating - C.ARENA.LOSS);
    gain(s, { exp: 50 });
    text = `💀 Defeat. Rating -${C.ARENA.LOSS}\n+50 EXP`;
  }
  const nt = await c.save();
  await c.send("Arena", "🏟️", `Your rating: ${s.counters.arenaRating}\nOpponent power: ${fmt(Math.floor(oppPow))}\nYour power: ${fmt(Math.floor(myPow))}\n\n${text}${nt}`);
};

for (const a of ACT.hunt) {
  H[a.key] = async (c) => {
    if (await c.onCd(a.key, a.cd)) return;
    const pool = ENEMY_LIST.filter((e: any) => e.tag === a.tag);
    await runFight(c, pickEnemy(c.s, pool, 0.2, 2), { head: a.label, sym: "🐺", counter: "hunts", rewardMult: a.mult });
  };
}

for (const a of ACT.train) {
  H[a.key] = async (c) => {
    const s = c.s;
    if (!(await afford(c, a.cost))) return;
    if (await c.onCd(a.key, a.cd)) return;
    charge(c, a.cost);
    const mult = 1 + s.level * 0.01;
    const amt = a.stat === "none" ? 0 : Math.max(1, Math.floor(rnd(a.gain[0], a.gain[1]) * mult));
    if (a.stat === "all") for (const k of STAT_KEYS) (s.trained as any)[k] += amt;
    else if (a.stat !== "none") (s.trained as any)[a.stat] += amt;
    const exp = Math.floor(a.exp * mult);
    gain(s, { exp });
    if (a.charge) s.charge = Math.min(100, s.charge + a.charge);
    if (a.clearCd) { const keep = s.cd[a.key]; s.cd = {}; s.cd[a.key] = keep; }
    bump(s, "trains");
    const nt = await c.save();
    await c.send(a.label, "🏋️", `${a.text}\n\n${a.stat === "none" ? "" : `+${amt} trained ${a.stat === "all" ? "to every stat" : a.stat.toUpperCase()}\n`}+${fmt(exp)} EXP${a.charge ? `\n⚡ Authority +${a.charge}% (${s.charge}%)` : ""}${a.clearCd ? "\n♻️ All cooldowns cleared." : ""}${a.cost && !c.isDev ? `\nCost: ${fmt(a.cost)} 🪙` : ""}${nt}`);
  };
}

for (const a of ACT.buff) {
  H[a.key] = async (c) => {
    const s = c.s;
    if (!(await afford(c, a.cost))) return;
    if (await c.onCd(a.key, a.cd)) return;
    charge(c, a.cost);
    s.buff = { pct: a.pct, until: c.now + a.secs };
    bump(s, "meals");
    await c.save();
    await c.send("Ramen", "🍜", `${a.text}\n\n+${Math.round(a.pct * 100)}% power for ${Math.floor(a.secs / 60)} minutes.${a.cost && !c.isDev ? `\nCost: ${fmt(a.cost)} 🪙` : ""}`);
  };
}

for (const a of ACT.gather) {
  H[a.key] = async (c) => {
    const s = c.s;
    if (await c.onCd(a.key, a.cd)) return;
    const mat = a.mat === "random" ? pick(Object.keys(MATERIAL_MAP)) : a.mat;
    let q = rnd(a.qty[0], a.qty[1]);
    if (Math.random() < Math.min(0.3, s.stats.luck / (s.stats.luck + 20000))) q += 1;
    addItem(s, "material", mat, q);
    const coins = Math.floor(a.coins * (1 + s.level * 0.01));
    gain(s, { coins });
    bump(s, "gathers");
    const nt = await c.save();
    await c.send("Gathering", "🧺", `${a.text}\n\n+${q}x ${MATERIAL_MAP[mat].name}\n+${fmt(coins)} 🪙${nt}`);
  };
}

async function doExplore(c: Ctx, loc: any): Promise<void> {
  const s = c.s;
  if (!c.isDev && s.level < loc.levelReq) { await c.send("Explore", "🔒", `${loc.name} requires level ${loc.levelReq}. You are level ${s.level}.`); return; }
  if (await c.onCd("explore", C.COOLDOWNS.explore)) return;
  const sc = 1 + s.level * 0.005;
  bump(s, "explores");
  if (!c.isDev && Math.random() < 0.1) {
    const l = Math.min(s.coins, Math.floor(s.coins * 0.02));
    s.coins -= l;
    gain(s, { exp: 30 });
    const nt = await c.save();
    await c.send(loc.name, "🧭", `${pick<string>(loc.setbacks)}\n\n💸 Lost ${fmt(l)} 🪙\n+30 EXP${nt}`);
    return;
  }
  const coins = Math.floor(rnd(loc.coins[0], loc.coins[1]) * sc);
  const exp = Math.floor(rnd(loc.exp[0], loc.exp[1]) * sc);
  const gems = Math.random() < loc.gemChance ? rnd(1, 4) : 0;
  let drop = "";
  if (Math.random() < 0.4) {
    const m = pick<string>(loc.drops), q = rnd(1, 3);
    addItem(s, "material", m, q);
    drop = `\n🎁 Found: ${q}x ${MATERIAL_MAP[m].name}`;
  }
  gain(s, { coins, exp, gems });
  const nt = await c.save();
  await c.send(loc.name, "🧭", `${pick<string>(loc.events)}\n\n+${fmt(coins)} 🪙 | +${fmt(exp)} EXP${gems ? ` | +${gems} 💎` : ""}${drop}${nt}`);
}

H["explore"] = async (c) => {
  const pool = LOCATION_LIST.filter((l: any) => c.isDev || l.levelReq <= c.s.level);
  await doExplore(c, pick(pool));
};
for (const loc of LOCATION_LIST) H[`explore.${loc.id}`] = async (c) => { await doExplore(c, loc); };

async function storyFight(c: Ctx, idx: number, replay: boolean): Promise<void> {
  const s = c.s;
  const ch = STORY_LIST[idx];
  const myPow = power(s) * (0.85 + Math.random() * 0.3);
  const enPow = (ch.atk * 0.7 + ch.def * 0.3) * (0.9 + Math.random() * 0.2);
  const win = c.isDev ? true : myPow > enPow;
  const m = replay ? 0.25 : 1;
  let text: string;
  if (win) {
    gain(s, { coins: ch.reward.coins * m, exp: ch.reward.exp * m, gems: ch.reward.gems * m });
    if (!replay) s.story = idx + 1;
    bump(s, "wins");
    s.charge = Math.min(100, s.charge + C.CHARGE_PER_WIN);
    text = `✅ CHAPTER ${replay ? "REPLAYED" : "CLEARED"}!\n\n+${fmt(Math.floor(ch.reward.coins * m))} 🪙 | +${fmt(Math.floor(ch.reward.exp * m))} EXP | +${Math.floor(ch.reward.gems * m)} 💎`;
  } else {
    gain(s, { exp: Math.floor(ch.reward.exp * 0.1) });
    text = `💀 DEFEAT\n\nTrain more and try again.\n${ch.hint}`;
  }
  const nt = await c.save();
  await c.send(`Chapter ${ch.id}: ${ch.name}`, "📖", `Boss: ${ch.enemy}\n⚔️ Your Power: ${fmt(Math.floor(myPow))}\n🛡️ Enemy Power: ${fmt(Math.floor(enPow))}\n\n${text}${nt}`);
}

H["story"] = async (c) => {
  if (c.s.story >= STORY_LIST.length) { await c.send("Story", "🏆", "You have cleared every chapter. Use /noblesse story replay <n> to revisit them."); return; }
  if (await c.onCd("story", C.COOLDOWNS.story)) return;
  await storyFight(c, c.s.story, false);
};

H["story.list"] = async (c) => {
  const lines = STORY_LIST.map((x: any, i: number) => `${i < c.s.story ? "✅" : i === c.s.story ? "▶️" : "🔒"} ${x.id}. ${x.name}`).join("\n");
  await c.send("Story Chapters", "📖", lines);
};

H["story.progress"] = async (c) => {
  const n = STORY_LIST.length;
  await c.send("Story Progress", "📖", `[${bar(c.s.story, n, 14)}] ${c.s.story}/${n} (${Math.floor(c.s.story / n * 100)}%)\n${c.s.story < n ? `Next: ${STORY_LIST[c.s.story].name}` : "All chapters cleared ✅"}`);
};

H["story.replay"] = async (c) => {
  const n = parseInt(c.rest[0]);
  if (isNaN(n) || n < 1 || n > c.s.story) { await c.send("Story Replay", "⚠️", `Usage: /noblesse story replay <1-${c.s.story || 1}>\nYou can only replay cleared chapters.`); return; }
  if (await c.onCd("story", C.COOLDOWNS.story)) return;
  await storyFight(c, n - 1, true);
};

H["story.rewards"] = async (c) => {
  if (c.s.story >= STORY_LIST.length) { await c.send("Story Rewards", "🏆", "All chapter rewards have been claimed."); return; }
  const x = STORY_LIST[c.s.story];
  await c.send("Story Rewards", "🎁", `Chapter ${x.id}: ${x.name}\n\n+${fmt(x.reward.coins)} 🪙\n+${fmt(x.reward.exp)} EXP\n+${x.reward.gems} 💎`);
};

H["story.hint"] = async (c) => {
  if (c.s.story >= STORY_LIST.length) { await c.send("Story Hint", "🏆", "No more chapters to clear."); return; }
  const x = STORY_LIST[c.s.story];
  await c.send("Story Hint", "💡", `Chapter ${x.id}: ${x.name}\nBoss: ${x.enemy}\n\n${x.hint}\nYour power: ${fmt(Math.floor(power(c.s)))}`);
};

function questLines(s: Profile): string {
  return Object.entries(s.quests.list).map(([id, q]) => {
    const d = questDone(s, q);
    const state = q.claimed ? "✅ Claimed" : d >= q.goal ? "🎁 Ready" : `${d}/${q.goal}`;
    return `• ${q.desc} [${id}]\n  ${state} — ${fmt(q.coins)} 🪙 | ${fmt(q.exp)} EXP${q.gems ? ` | ${q.gems} 💎` : ""}`;
  }).join("\n");
}

H["quest"] = async (c) => {
  ensureQuests(c.s);
  await c.save();
  await c.send("Daily Quests", "📜", `${questLines(c.s)}\n\nUse /noblesse quest claim <id>`);
};

H["quest.list"] = async (c) => {
  await c.send("Quest Pool", "📜", QUEST_LIST.map((q: any) => `• ${q.desc} — ${fmt(q.coins)} 🪙 | ${fmt(q.exp)} EXP${q.gems ? ` | ${q.gems} 💎` : ""}`).join("\n") + `\n\n${C.QUESTS_PER_DAY} random quests are assigned each day.`);
};

async function claimQuest(c: Ctx, id: string): Promise<string | null> {
  const q = c.s.quests.list[id];
  if (!q) return null;
  if (q.claimed || questDone(c.s, q) < q.goal) return null;
  q.claimed = true;
  gain(c.s, { coins: q.coins, exp: q.exp, gems: q.gems });
  return `${q.desc}: +${fmt(q.coins)} 🪙 | +${fmt(q.exp)} EXP${q.gems ? ` | +${q.gems} 💎` : ""}`;
}

H["quest.claim"] = async (c) => {
  ensureQuests(c.s);
  const id = c.rest[0] || "";
  const r = await claimQuest(c, id);
  if (!r) { await c.send("Quest", "⚠️", "That quest is not ready, already claimed, or does not exist.\nUse /noblesse quest to see IDs."); return; }
  const nt = await c.save();
  await c.send("Quest Claimed", "🎁", `${r}${nt}`);
};

H["quest.claimall"] = async (c) => {
  ensureQuests(c.s);
  const out: string[] = [];
  for (const id of Object.keys(c.s.quests.list)) { const r = await claimQuest(c, id); if (r) out.push(r); }
  if (!out.length) { await c.send("Quest", "⚠️", "No completed quests to claim."); return; }
  const nt = await c.save();
  await c.send("Quests Claimed", "🎁", `${out.join("\n")}${nt}`);
};

H["quest.daily"] = async (c) => {
  ensureQuests(c.s);
  const list = Object.values(c.s.quests.list);
  const done = list.filter(q => q.claimed).length;
  const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
  const left = Math.floor((midnight.getTime() - Date.now()) / 1000);
  await c.send("Quest Reset", "⏰", `Claimed: ${done}/${list.length}\nResets in ${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m (00:00 UTC).`);
};

H["quest.reroll"] = async (c) => {
  ensureQuests(c.s);
  if (Object.values(c.s.quests.list).some(q => q.claimed)) { await c.send("Quest Reroll", "🛑", "You cannot reroll after claiming a quest today."); return; }
  if (!(await spend(c, 0, C.QUEST_REROLL_GEMS))) return;
  rollQuests(c.s, c.s.quests.date);
  await c.save();
  await c.send("Quest Reroll", "🔄", `New quests assigned!\n\n${questLines(c.s)}${c.isDev ? "" : `\n\nCost: ${C.QUEST_REROLL_GEMS} 💎`}`);
};

function sellValue(type: string, ref: string): number {
  if (type === "weapon") return Math.floor(WEAPON_MAP[ref].price * C.SELL_RATIO);
  if (type === "potion") { const p = POTION_MAP[ref]; return p.currency === "gems" ? 2000 : Math.floor(p.price * C.SELL_RATIO); }
  return MATERIAL_MAP[ref].value;
}

function addBondExp(s: Profile, n: number): number {
  let gained = 0;
  s.bond.exp += n;
  while (s.bond.level < C.BOND_MAX_LEVEL && s.bond.exp >= C.BOND_EXP_PER_LEVEL * (s.bond.level + 1)) {
    s.bond.exp -= C.BOND_EXP_PER_LEVEL * (s.bond.level + 1);
    s.bond.level += 1;
    gained += 1;
  }
  if (s.bond.level >= C.BOND_MAX_LEVEL) s.bond.exp = 0;
  return gained;
}

function weaponLine(id: string): string {
  const w = WEAPON_MAP[id];
  return `${id} ${w.name} — ATK +${fmt(w.atk)} | DEF +${fmt(w.def)}`;
}

H["shop"] = async (c) => {
  await c.send("Noble Shop", "🛍️", `🗡️ Weapons: ${Object.keys(WEAPON_MAP).length} (/noblesse shop weapons)\n🧪 Potions: ${Object.keys(POTION_MAP).length} (/noblesse shop potions)\n🧱 Materials: ${Object.keys(MATERIAL_MAP).length} (/noblesse shop materials)\n\nBuy with /noblesse buy <ID> <qty>\nYou have: ${fmt(c.s.coins)} 🪙 | ${fmt(c.s.gems)} 💎`);
};

H["shop.weapons"] = async (c) => {
  await c.send("Weapon Shop", "🗡️", Object.entries(WEAPON_MAP).map(([id, w]: any) => `${weaponLine(id)}\n   ${fmt(w.price)} 🪙 | Lv.${w.reqLevel} ${icon(w.rarity)}`).join("\n"));
};

H["shop.potions"] = async (c) => {
  await c.send("Potion Shop", "🧪", Object.entries(POTION_MAP).map(([id, p]: any) => `${id} ${p.name} — ${fmt(p.price)} ${p.currency === "gems" ? "💎" : "🪙"}\n   ${p.desc}`).join("\n"));
};

H["shop.materials"] = async (c) => {
  await c.send("Material Shop", "🧱", Object.entries(SHOP_MAP).filter(([, v]: any) => v.type === "material").map(([id, v]: any) => `${id} ${MATERIAL_MAP[v.ref].name} ${icon(MATERIAL_MAP[v.ref].rarity)} — ${fmt(v.price)} 🪙`).join("\n"));
};

H["buy"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  const entry = SHOP_MAP[id];
  if (!entry) { await c.send("Shop", "⚠️", "Invalid item ID. Use /noblesse shop."); return; }
  let qty = Math.max(1, parseInt(c.rest[1]) || 1);
  if (entry.type === "weapon") {
    qty = 1;
    if (c.s.inv.weapons[entry.ref]) { await c.send("Shop", "🛑", "You already own that weapon."); return; }
    if (!c.isDev && c.s.level < WEAPON_MAP[entry.ref].reqLevel) { await c.send("Shop", "🔒", `Requires level ${WEAPON_MAP[entry.ref].reqLevel}.`); return; }
  }
  const total = entry.price * qty;
  const gems = entry.currency === "gems";
  if (!(await spend(c, gems ? 0 : total, gems ? total : 0))) return;
  addItem(c.s, entry.type, entry.ref, qty);
  bump(c.s, "shopBuys");
  const nt = await c.save();
  await c.send("Shop", "✅", `Purchased ${qty}x ${itemName(entry.type, entry.ref)}\nCost: ${fmt(total)} ${gems ? "💎" : "🪙"}${nt}`);
};

H["sell"] = async (c) => {
  const it = resolveItem(c.rest[0] || "");
  if (!it) { await c.send("Sell", "⚠️", "Usage: /noblesse sell <ID> <qty>"); return; }
  const have = itemQty(c.s, it.type, it.ref);
  let qty = c.rest[1] ? parseAmount(c.rest[1], have) : 1;
  if (isNaN(qty) || qty < 1) qty = 1;
  if (it.type === "weapon" && c.s.equipped.weapon === it.ref) { await c.send("Sell", "🛑", "Unequip that weapon first."); return; }
  if (have < qty) { await c.send("Sell", "❌", `You only have ${have}x ${itemName(it.type, it.ref)}.`); return; }
  const v = sellValue(it.type, it.ref) * qty;
  takeItem(c.s, it.type, it.ref, qty);
  c.s.coins += v;
  await c.save();
  await c.send("Sell", "✅", `Sold ${qty}x ${itemName(it.type, it.ref)} for ${fmt(v)} 🪙.`);
};

H["use"] = async (c) => {
  const it = resolveItem(c.rest[0] || "");
  if (!it || it.type !== "potion") { await c.send("Use", "⚠️", "Usage: /noblesse use <potionID> <qty>"); return; }
  const have = itemQty(c.s, "potion", it.ref);
  let qty = c.rest[1] ? parseAmount(c.rest[1], have) : 1;
  if (isNaN(qty) || qty < 1) qty = 1;
  if (have < qty) { await c.send("Use", "❌", `You only have ${have}x ${POTION_MAP[it.ref].name}.`); return; }
  const e = POTION_MAP[it.ref].effect;
  const s = c.s;
  let text = "";
  if (e.kind === "exp") { gain(s, { exp: e.value * qty }); text = `+${fmt(e.value * qty)} EXP`; }
  else if (e.kind === "authority") { s.charge = Math.min(100, s.charge + e.value * qty); text = `Authority: ${s.charge}%`; }
  else if (e.kind === "bond") { const g = addBondExp(s, e.value * qty); text = `+${e.value * qty} bond EXP${g ? ` (+${g} bond level)` : ""}`; }
  else if (e.kind === "cooldown") { s.cd = {}; text = "All cooldowns cleared."; }
  else if (e.kind === "trained") { for (const k of STAT_KEYS) (s.trained as any)[k] += e.value * qty; text = `+${e.value * qty} to every trained stat`; }
  else if (e.kind === "gems") { gain(s, { gems: e.value * qty }); text = `+${e.value * qty} 💎`; }
  if (!c.isDev) takeItem(s, "potion", it.ref, qty);
  const nt = await c.save();
  await c.send("Use Potion", "🧪", `Used ${qty}x ${POTION_MAP[it.ref].name}\n${text}${nt}`);
};

H["inventory"] = async (c) => {
  const s = c.s;
  const w = Object.keys(s.inv.weapons).length, p = Object.values(s.inv.potions).reduce((a, b) => a + b, 0), m = Object.values(s.inv.materials).reduce((a, b) => a + b, 0);
  await c.send("Inventory", "🎒", `🗡️ Weapons: ${w} (equipped: ${s.equipped.weapon ? WEAPON_MAP[s.equipped.weapon].name : "none"})\n🧪 Potions: ${fmt(p)}\n🧱 Materials: ${fmt(m)}\n\n/noblesse inventory weapons | potions | materials`);
};

H["inventory.weapons"] = async (c) => {
  const lines = Object.entries(c.s.inv.weapons).map(([id, w]) => `${weaponLine(id)}\n   +${w.level}/${C.WEAPON_MAX_UPGRADE}${c.s.equipped.weapon === id ? " ✅ equipped" : ""}`);
  await c.send("Weapons", "🗡️", lines.join("\n") || "No weapons yet.");
};

H["inventory.potions"] = async (c) => {
  const lines = Object.entries(c.s.inv.potions).map(([id, q]) => `${id} ${POTION_MAP[id].name} x${fmt(q)}`);
  await c.send("Potions", "🧪", lines.join("\n") || "No potions yet.");
};

H["inventory.materials"] = async (c) => {
  const lines = Object.entries(c.s.inv.materials).map(([k, q]) => `${icon(MATERIAL_MAP[k].rarity)} ${MATERIAL_MAP[k].name} x${fmt(q)}`);
  await c.send("Materials", "🧱", lines.join("\n") || "No materials yet.");
};

H["equip"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  if (!c.s.inv.weapons[id]) { await c.send("Equip", "❌", "You do not own that weapon. Use /noblesse inventory weapons."); return; }
  c.s.equipped.weapon = id;
  await c.save();
  await c.send("Equip", "✅", `Equipped ${WEAPON_MAP[id].name}.\n\n${statLine(c.s.stats)}`);
};

H["unequip"] = async (c) => {
  if (!c.s.equipped.weapon) { await c.send("Unequip", "⚠️", "No weapon equipped."); return; }
  c.s.equipped.weapon = undefined;
  await c.save();
  await c.send("Unequip", "✅", "Weapon unequipped.");
};

H["upgrade"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  const own = c.s.inv.weapons[id];
  if (!own) { await c.send("Upgrade", "❌", "You do not own that weapon."); return; }
  if (own.level >= C.WEAPON_MAX_UPGRADE) { await c.send("Upgrade", "🌟", "That weapon is already at max level."); return; }
  const w = WEAPON_MAP[id];
  const coins = C.UPGRADE_COIN_BASE * (own.level + 1) * (1 + rarityIdx(w.rarity));
  const mats: Record<string, number> = { [w.upgradeMat]: own.level + 1 };
  if (!c.isDev && !hasMats(c.s, mats)) { await c.send("Upgrade", "❌", `Missing materials: ${matsText(mats)}`); return; }
  if (!(await spend(c, coins))) return;
  if (!c.isDev) takeMats(c.s, mats);
  own.level += 1;
  const nt = await c.save();
  await c.send("Upgrade", "⬆️", `${w.name} upgraded to +${own.level}!\nCost: ${fmt(coins)} 🪙 + ${matsText(mats)}${nt}`);
};

H["recipes"] = async (c) => {
  await c.send("Recipes", "📘", RECIPE_LIST.map((r: any) => `${r.id} ${r.name} x${r.qty}\n   ${matsText(r.mats)} + ${fmt(r.coins)} 🪙`).join("\n") + "\n\nUse /noblesse craft <ID> <qty>");
};

H["craft"] = async (c) => {
  const r = RECIPE_LIST.find((x: any) => x.id === (c.rest[0] || "").toUpperCase());
  if (!r) { await c.send("Craft", "⚠️", "Invalid recipe. Use /noblesse recipes."); return; }
  let qty = r.type === "weapon" ? 1 : Math.max(1, parseInt(c.rest[1]) || 1);
  if (r.type === "weapon" && c.s.inv.weapons[r.ref]) { await c.send("Craft", "🛑", "You already own that weapon."); return; }
  const mats: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.mats)) mats[k] = (v as number) * qty;
  if (!c.isDev && !hasMats(c.s, mats)) { await c.send("Craft", "❌", `Missing materials: ${matsText(mats)}`); return; }
  if (!(await spend(c, r.coins * qty))) return;
  if (!c.isDev) takeMats(c.s, mats);
  addItem(c.s, r.type, r.ref, r.qty * qty);
  bump(c.s, "crafts", qty);
  const nt = await c.save();
  await c.send("Craft", "🔨", `Crafted ${r.qty * qty}x ${itemName(r.type, r.ref)}!\nCost: ${matsText(mats)} + ${fmt(r.coins * qty)} 🪙${nt}`);
};

H["disassemble"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  const own = c.s.inv.weapons[id];
  if (!own) { await c.send("Disassemble", "❌", "You do not own that weapon."); return; }
  if (c.s.equipped.weapon === id) { await c.send("Disassemble", "🛑", "Unequip that weapon first."); return; }
  const w = WEAPON_MAP[id];
  const a = 1 + Math.floor(own.level / 2) + rarityIdx(w.rarity), b = 3 + own.level * 2;
  takeItem(c.s, "weapon", id, 1);
  addItem(c.s, "material", w.upgradeMat, a);
  addItem(c.s, "material", "steel_scrap", b);
  await c.save();
  await c.send("Disassemble", "🔧", `${w.name} broken down.\n+${a}x ${MATERIAL_MAP[w.upgradeMat].name}\n+${b}x ${MATERIAL_MAP.steel_scrap.name}`);
};

function skillLine(id: string, s: Profile): string {
  const k = SKILL_MAP[id];
  const b = Object.entries(k.bonus).filter(([, v]: any) => v !== 0).map(([n, v]: any) => `${n.toUpperCase()} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`).join(" ");
  return `${s.equippedSkills.includes(id) ? "✅" : s.skills.includes(id) ? "📗" : "🔒"} ${id} ${k.name} — ${b}\n   ${k.desc} (Lv.${k.levelReq}, ${fmt(k.cost)} 🪙)`;
}

H["skill.list"] = async (c) => {
  await c.send("Skills", "🌀", `Equipped: ${c.s.equippedSkills.length}/${C.MAX_EQUIPPED_SKILLS}\n\n${Object.keys(SKILL_MAP).map(id => skillLine(id, c.s)).join("\n")}`);
};

H["skill.learn"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  const k = SKILL_MAP[id];
  if (!k) { await c.send("Skills", "⚠️", "Invalid skill ID. Use /noblesse skill list."); return; }
  if (c.s.skills.includes(id)) { await c.send("Skills", "🛑", "You already know that skill."); return; }
  if (!c.isDev && c.s.level < k.levelReq) { await c.send("Skills", "🔒", `Requires level ${k.levelReq}.`); return; }
  if (!(await spend(c, k.cost))) return;
  c.s.skills.push(id);
  const nt = await c.save();
  await c.send("Skills", "✅", `Learned ${k.name}!\nUse /noblesse skill equip ${id}${nt}`);
};

H["skill.info"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  if (!SKILL_MAP[id]) { await c.send("Skills", "⚠️", "Invalid skill ID."); return; }
  await c.send("Skill Info", "🌀", skillLine(id, c.s));
};

H["skill.equip"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  if (!c.s.skills.includes(id)) { await c.send("Skills", "❌", "You have not learned that skill."); return; }
  if (c.s.equippedSkills.includes(id)) { await c.send("Skills", "🛑", "Already equipped."); return; }
  if (c.s.equippedSkills.length >= C.MAX_EQUIPPED_SKILLS) { await c.send("Skills", "🛑", `You can equip up to ${C.MAX_EQUIPPED_SKILLS} skills. Unequip one first.`); return; }
  c.s.equippedSkills.push(id);
  await c.save();
  await c.send("Skills", "✅", `Equipped ${SKILL_MAP[id].name}.\n\n${statLine(c.s.stats)}`);
};

H["skill.unequip"] = async (c) => {
  const id = (c.rest[0] || "").toUpperCase();
  if (!c.s.equippedSkills.includes(id)) { await c.send("Skills", "⚠️", "That skill is not equipped."); return; }
  c.s.equippedSkills = c.s.equippedSkills.filter(x => x !== id);
  await c.save();
  await c.send("Skills", "✅", `Unequipped ${SKILL_MAP[id].name}.`);
};

H["skill.reset"] = async (c) => {
  if (c.isDev) { await c.send("Skills", "👑", "The developer account keeps every skill."); return; }
  if (!c.s.skills.length) { await c.send("Skills", "⚠️", "You have no skills to reset."); return; }
  const refund = Math.floor(c.s.skills.reduce((a, id) => a + SKILL_MAP[id].cost, 0) * C.SKILL_RESET_REFUND);
  c.s.skills = []; c.s.equippedSkills = []; c.s.coins += refund;
  await c.save();
  await c.send("Skills", "♻️", `All skills reset.\nRefund: ${fmt(refund)} 🪙`);
};

H["bond"] = async (c) => {
  const s = c.s;
  const ch = CHAR_MAP[s.mainChar || ""];
  const need = C.BOND_EXP_PER_LEVEL * (s.bond.level + 1);
  await c.send("Bond", "💛", `Partner: ${ch?.name}\nLevel: ${s.bond.level}/${C.BOND_MAX_LEVEL}\n${s.bond.level >= C.BOND_MAX_LEVEL ? "[MAX]" : `[${bar(s.bond.exp, need)}] ${s.bond.exp}/${need}`}\nStat bonus: +${Math.round(s.bond.level * C.BOND_STAT_PER_LEVEL * 100)}% to all stats`);
};

H["bond.train"] = async (c) => {
  if (c.s.bond.level >= C.BOND_MAX_LEVEL) { await c.send("Bond", "💛", "Your bond is already at the maximum."); return; }
  if (await c.onCd("bondTrain", C.COOLDOWNS.bondTrain)) return;
  const g = rnd(15, 30);
  const lv = addBondExp(c.s, g);
  bump(c.s, "bondTrains");
  const nt = await c.save();
  await c.send("Bond Training", "💛", `You train alongside ${CHAR_MAP[c.s.mainChar || ""]?.name}.\n+${g} bond EXP${lv ? `\n🎉 Bond level up! Now Lv.${c.s.bond.level}` : ""}${nt}`);
};

H["bond.gift"] = async (c) => {
  const it = resolveItem(c.rest[0] || "");
  if (!it || it.type === "weapon") { await c.send("Bond Gift", "⚠️", "Usage: /noblesse bond gift <potion or material ID> <qty>"); return; }
  const have = itemQty(c.s, it.type, it.ref);
  let qty = c.rest[1] ? parseAmount(c.rest[1], have) : 1;
  if (isNaN(qty) || qty < 1) qty = 1;
  if (have < qty) { await c.send("Bond Gift", "❌", `You only have ${have}x ${itemName(it.type, it.ref)}.`); return; }
  const per = it.type === "material" ? Math.max(1, Math.floor(MATERIAL_MAP[it.ref].value / 20)) : Math.max(1, Math.floor(POTION_MAP[it.ref].price / 50));
  if (!c.isDev) takeItem(c.s, it.type, it.ref, qty);
  const lv = addBondExp(c.s, per * qty);
  const nt = await c.save();
  await c.send("Bond Gift", "🎁", `You gifted ${qty}x ${itemName(it.type, it.ref)}.\n+${fmt(per * qty)} bond EXP${lv ? `\n🎉 Bond level up! Now Lv.${c.s.bond.level}` : ""}${nt}`);
};

H["bond.status"] = async (c) => {
  const lv = c.s.bond.level;
  const rows = [5, 10, 15, 20].map(n => `${lv >= n ? "✅" : "🔒"} Lv.${n}: +${Math.round(n * C.BOND_STAT_PER_LEVEL * 100)}% total stats`);
  await c.send("Bond Status", "💛", `Current: Lv.${lv} (+${Math.round(lv * C.BOND_STAT_PER_LEVEL * 100)}%)\n\n${rows.join("\n")}`);
};

H["bond.story"] = async (c) => {
  const lv = c.s.bond.level;
  const unlocked = LORE_DATA.bondStories.filter((_: string, i: number) => lv >= (i + 1) * 2);
  await c.send("Bond Stories", "📖", unlocked.length ? unlocked.join("\n\n") : "Raise your bond to level 2 to unlock the first story.");
};

function soulBase(s: Profile): any { return s.soul ? SOUL_LIST.find((x: any) => x.id === s.soul!.id) : null; }

H["soulweapon.info"] = async (c) => {
  const s = c.s;
  const b = soulBase(s);
  if (!b) {
    await c.send("Soul Weapon", "👻", `You have no soul weapon.\nForge cost: ${fmt(C.SOUL.FORGE.coins)} 🪙 + ${matsText(C.SOUL.FORGE.mats)}\n\nPossible forms:\n${SOUL_LIST.map((x: any) => `${icon(x.rarity)} ${x.name}`).join("\n")}`); return;
  }
  const sb = soulBonus({ ...s, soul: { ...s.soul!, bound: true } } as Profile);
  await c.send("Soul Weapon", "👻", `${icon(b.rarity)} ${b.name} ${"★".repeat(s.soul!.stars)}\n"${b.desc}"\nLevel: ${s.soul!.level}/${C.SOUL.MAX_LEVEL}\nState: ${s.soul!.bound ? "Bound ✅" : "Unbound"}\n\nBonus when bound:\n${statLine({ atk: Math.floor(sb.atk), def: Math.floor(sb.def), mana: Math.floor(sb.mana), luck: Math.floor(sb.luck) })}`);
};

H["soulweapon.forge"] = async (c) => {
  if (c.s.soul) { await c.send("Soul Weapon", "🛑", "You already have a soul weapon. Release it first."); return; }
  if (!c.isDev && !hasMats(c.s, C.SOUL.FORGE.mats)) { await c.send("Soul Weapon", "❌", `Missing materials: ${matsText(C.SOUL.FORGE.mats)}`); return; }
  if (!(await spend(c, C.SOUL.FORGE.coins))) return;
  if (!c.isDev) takeMats(c.s, C.SOUL.FORGE.mats);
  const b = weighted(SOUL_LIST);
  c.s.soul = { id: b.id, level: 1, stars: 0, bound: false };
  const nt = await c.save();
  await c.send("Soul Weapon", "👻", `Your will takes form!\n\n${icon(b.rarity)} ${b.name} [${b.rarity}]\n"${b.desc}"\n\nBind it with /noblesse soulweapon bind${nt}`);
};

H["soulweapon.upgrade"] = async (c) => {
  const so = c.s.soul;
  if (!so) { await c.send("Soul Weapon", "❌", "You have no soul weapon."); return; }
  if (so.level >= C.SOUL.MAX_LEVEL) { await c.send("Soul Weapon", "🌟", "Your soul weapon is at max level."); return; }
  const coins = C.SOUL.UPGRADE_COIN_BASE * so.level;
  const mats: Record<string, number> = { soul_shard: Math.ceil(so.level / 2) };
  if (!c.isDev && !hasMats(c.s, mats)) { await c.send("Soul Weapon", "❌", `Missing materials: ${matsText(mats)}`); return; }
  if (!(await spend(c, coins))) return;
  if (!c.isDev) takeMats(c.s, mats);
  so.level += 1;
  const nt = await c.save();
  await c.send("Soul Weapon", "⬆️", `Soul weapon upgraded to Lv.${so.level}!\nCost: ${fmt(coins)} 🪙 + ${matsText(mats)}${nt}`);
};

H["soulweapon.bind"] = async (c) => {
  const so = c.s.soul;
  if (!so) { await c.send("Soul Weapon", "❌", "You have no soul weapon."); return; }
  so.bound = !so.bound;
  await c.save();
  await c.send("Soul Weapon", so.bound ? "🔗" : "🔓", so.bound ? `Bound! Its power now flows into you.\n\n${statLine(c.s.stats)}` : "Unbound. Its bonus is inactive.");
};

H["soulweapon.release"] = async (c) => {
  const so = c.s.soul;
  if (!so) { await c.send("Soul Weapon", "❌", "You have no soul weapon."); return; }
  if (c.isDev) { await c.send("Soul Weapon", "👑", "The Noblesse Soul Weapon cannot be released."); return; }
  const ne = Math.floor(so.level / 4) + 1 + so.stars, ss = so.level;
  addItem(c.s, "material", "noble_essence", ne);
  addItem(c.s, "material", "soul_shard", ss);
  c.s.soul = undefined;
  await c.save();
  await c.send("Soul Weapon", "💨", `Your soul weapon dissolves.\n+${ne}x ${MATERIAL_MAP.noble_essence.name}\n+${ss}x ${MATERIAL_MAP.soul_shard.name}`);
};

H["soulweapon.evolve"] = async (c) => {
  const so = c.s.soul;
  if (!so) { await c.send("Soul Weapon", "❌", "You have no soul weapon."); return; }
  if (so.stars >= C.SOUL.MAX_STARS) { await c.send("Soul Weapon", "🌟", "Your soul weapon is fully evolved."); return; }
  const need = 6 * (so.stars + 1);
  if (so.level < need) { await c.send("Soul Weapon", "🔒", `Evolution requires soul weapon level ${need}.`); return; }
  const mats: Record<string, number> = {};
  for (const [k, v] of Object.entries(C.SOUL.EVOLVE_MATS)) mats[k] = (v as number) * (so.stars + 1);
  const coins = 10000 * (so.stars + 1);
  if (!c.isDev && !hasMats(c.s, mats)) { await c.send("Soul Weapon", "❌", `Missing materials: ${matsText(mats)}`); return; }
  if (!(await spend(c, coins))) return;
  if (!c.isDev) takeMats(c.s, mats);
  so.stars += 1;
  const nt = await c.save();
  await c.send("Soul Weapon", "🌟", `Your soul weapon evolved to ${"★".repeat(so.stars)}!\nCost: ${fmt(coins)} 🪙 + ${matsText(mats)}${nt}`);
};

function achState(s: Profile, a: any): string {
  const v = metric(s, a.metric);
  if (s.achievements[a.id]) return "✅ Claimed";
  if (v >= a.min) return "🎁 Ready";
  return `🔒 ${fmt(Math.min(v, a.min))}/${fmt(a.min)}`;
}

H["achievements"] = async (c) => {
  await c.send("Achievements", "🏅", ACH_LIST.map((a: any) => `${a.name} — ${a.desc}\n   ${achState(c.s, a)} | ${fmt(a.coins)} 🪙 + ${a.gems} 💎 (${a.id})`).join("\n"));
};

H["achievements.claim"] = async (c) => {
  const only = c.rest[0];
  const out: string[] = [];
  for (const a of ACH_LIST) {
    if (only && a.id !== only) continue;
    if (c.s.achievements[a.id] || metric(c.s, a.metric) < a.min) continue;
    c.s.achievements[a.id] = true;
    gain(c.s, { coins: a.coins, gems: a.gems });
    out.push(`${a.name}: +${fmt(a.coins)} 🪙 | +${a.gems} 💎`);
  }
  if (!out.length) { await c.send("Achievements", "⚠️", "Nothing to claim right now."); return; }
  const nt = await c.save();
  await c.send("Achievements Claimed", "🏅", `${out.join("\n")}${nt}`);
};

H["achievements.progress"] = async (c) => {
  await c.send("Achievement Progress", "📈", ACH_LIST.map((a: any) => `${a.name}\n[${bar(Math.min(metric(c.s, a.metric), a.min), a.min)}] ${fmt(Math.min(metric(c.s, a.metric), a.min))}/${fmt(a.min)}`).join("\n"));
};

function genId(): string { return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4); }

function listingLine(l: any): string {
  return `[${l.id}] ${l.qty}x ${itemName(l.type, l.ref)}${l.type === "weapon" ? ` +${l.level || 0}` : ""} — ${fmt(l.price)} 🪙 by ${l.sellerName}`;
}

H["market.list"] = async (c) => {
  const rows = await c.col(COL_MARKET).find({ status: "active" }).sort({ created: -1 }).limit(15).toArray();
  await c.send("Market", "🏪", rows.length ? rows.map(listingLine).join("\n") + "\n\nBuy with /noblesse market buy <id>" : "No active listings.");
};

H["market.mine"] = async (c) => {
  const rows = await c.col(COL_MARKET).find({ seller: c.sid, status: "active" }).sort({ created: -1 }).limit(20).toArray();
  await c.send("My Listings", "🏪", rows.length ? rows.map(listingLine).join("\n") : "You have no active listings.");
};

H["market.sell"] = async (c) => {
  const it = resolveItem(c.rest[0] || "");
  const qty = parseInt(c.rest[1]);
  const price = parseAmount(c.rest[2], 0);
  if (!it || isNaN(qty) || qty < 1 || isNaN(price) || price < C.MARKET.MIN_PRICE) { await c.send("Market", "⚠️", "Usage: /noblesse market sell <ID> <qty> <total price>"); return; }
  if (it.type === "weapon" && (qty !== 1 || c.s.equipped.weapon === it.ref)) { await c.send("Market", "🛑", "Weapons are listed one at a time and must be unequipped."); return; }
  if (itemQty(c.s, it.type, it.ref) < qty) { await c.send("Market", "❌", "You do not have enough of that item."); return; }
  const mine = await c.col(COL_MARKET).find({ seller: c.sid, status: "active" }).limit(50).toArray();
  if (mine.length >= C.MARKET.MAX_LISTINGS) { await c.send("Market", "🛑", `You can have at most ${C.MARKET.MAX_LISTINGS} active listings.`); return; }
  const level = it.type === "weapon" ? c.s.inv.weapons[it.ref].level : 0;
  takeItem(c.s, it.type, it.ref, qty);
  const id = genId();
  await c.col(COL_MARKET).insertOne({ id, seller: c.sid, sellerName: c.s.name, type: it.type, ref: it.ref, qty, level, price, status: "active", created: c.now });
  await c.save();
  await c.send("Market", "✅", `Listed ${qty}x ${itemName(it.type, it.ref)} for ${fmt(price)} 🪙.\nListing ID: ${id}\nFee on sale: ${Math.round(C.MARKET.FEE * 100)}%`);
};

H["market.buy"] = async (c) => {
  const id = c.rest[0] || "";
  const l = await c.col(COL_MARKET).findOne({ id, status: "active" });
  if (!l) { await c.send("Market", "❌", "Listing not found or already sold."); return; }
  if (l.seller === c.sid) { await c.send("Market", "🛑", "You cannot buy your own listing. Use /noblesse market cancel."); return; }
  if (!(await spend(c, l.price))) return;
  await c.col(COL_MARKET).updateOne({ id }, { $set: { status: "sold", buyer: c.sid } });
  addItem(c.s, l.type, l.ref, l.qty, l.level || 0);
  const seller = await getProfile(c.db, l.seller);
  seller.coins += Math.floor(l.price * (1 - C.MARKET.FEE));
  await saveProfile(c.db, seller);
  const nt = await c.save();
  await c.send("Market", "✅", `Bought ${l.qty}x ${itemName(l.type, l.ref)} for ${fmt(l.price)} 🪙.${nt}`);
};

H["market.cancel"] = async (c) => {
  const id = c.rest[0] || "";
  const l = await c.col(COL_MARKET).findOne({ id, status: "active" });
  if (!l || l.seller !== c.sid) { await c.send("Market", "❌", "You have no active listing with that ID."); return; }
  await c.col(COL_MARKET).updateOne({ id }, { $set: { status: "cancelled" } });
  addItem(c.s, l.type, l.ref, l.qty, l.level || 0);
  await c.save();
  await c.send("Market", "✅", `Listing ${id} cancelled. Items returned.`);
};

H["prestige.info"] = async (c) => {
  const s = c.s;
  await c.send("Prestige", "🌟", `Prestige: ${s.prestige}/${C.PRESTIGE_MAX}\nPoints: ${s.prestigePoints}\n\nRequires level ${C.PRESTIGE_LEVEL_REQ} (you are ${fmt(s.level)}).\nEach prestige: +${Math.round(C.PRESTIGE_BONUS * 100)}% to all stats permanently.\nReset: level, EXP, trained stats, story progress and Authority.\nKept: characters, gold, crystals, items, skills, bond.\nPoints earned: 1 + floor(level / 100).`);
};

H["prestige"] = async (c) => {
  const s = c.s;
  if (c.isDev) { await c.send("Prestige", "👑", "The developer account is already at maximum prestige."); return; }
  if (s.prestige >= C.PRESTIGE_MAX) { await c.send("Prestige", "🌟", "You are at the maximum prestige."); return; }
  if (s.level < C.PRESTIGE_LEVEL_REQ) { await c.send("Prestige", "🔒", `Requires level ${C.PRESTIGE_LEVEL_REQ}. You are level ${s.level}.`); return; }
  const pts = 1 + Math.floor(s.level / 100);
  s.prestige += 1; s.prestigePoints += pts;
  s.level = 1; s.exp = 0; s.trained = emptyStats(); s.story = 0; s.charge = 0;
  const nt = await c.save();
  await c.send("Prestige", "🌟", `You are reborn! Prestige ${s.prestige}\n+${pts} Prestige Point(s)\nAll stats now x${(1 + s.prestige * C.PRESTIGE_BONUS).toFixed(2)}${nt}`);
};

H["prestige.shop"] = async (c) => {
  const s = c.s;
  const id = (c.rest[0] || "").toUpperCase();
  if (!id) {
    await c.send("Prestige Shop", "🌟", `Points: ${s.prestigePoints}\n\n${C.PRESTIGE_SHOP.map((x: any) => `${x.id} ${x.name} — ${x.cost} pt`).join("\n")}\n\nBuy with /noblesse prestige shop <ID>`); return;
  }
  const it = C.PRESTIGE_SHOP.find((x: any) => x.id === id);
  if (!it) { await c.send("Prestige Shop", "⚠️", "Invalid item ID."); return; }
  if (s.prestigePoints < it.cost) { await c.send("Prestige Shop", "❌", `Not enough points. Need ${it.cost}, have ${s.prestigePoints}.`); return; }
  s.prestigePoints -= it.cost;
  if (it.gems) gain(s, { gems: it.gems });
  if (it.coins) gain(s, { coins: it.coins });
  if (it.mat) addItem(s, "material", it.mat, it.qty);
  if (it.trained) for (const k of STAT_KEYS) (s.trained as any)[k] += it.trained;
  const nt = await c.save();
  await c.send("Prestige Shop", "✅", `Purchased: ${it.name}${nt}`);
};

async function finalize(db: any, p: Profile): Promise<void> {
  recalc(p);
  p.power = Math.floor(power(p, false));
  grantTitles(p);
  await saveProfile(db, p);
}

async function withProfile(c: Ctx, uid: string, fn: (p: Profile) => void): Promise<void> {
  if (uid === c.sid) { fn(c.s); return; }
  const p = await getProfile(c.db, uid);
  if (!p.name) return;
  fn(p);
  await finalize(c.db, p);
}

function splitTail(rest: string[], n: number): { name: string; tail: string[] } {
  return { name: rest.slice(0, Math.max(0, rest.length - n)).join(" ").trim(), tail: rest.slice(-n) };
}

async function getHouse(c: Ctx, name: string): Promise<any> {
  return c.col(COL_HOUSES).findOne({ name, disbanded: false });
}

async function houseMembers(c: Ctx, h: any): Promise<Profile[]> {
  const out: Profile[] = [];
  for (const id of h.members.slice(0, 50)) { const p = await getProfile(c.db, id); if (p.name) out.push(p); }
  return out;
}

async function refreshHousePower(c: Ctx, h: any): Promise<number> {
  const ms = await houseMembers(c, h);
  const total = ms.reduce((a, p) => a + (p.userID === c.sid ? Math.floor(power(c.s, false)) : (p.power || 0)), 0);
  await c.col(COL_HOUSES).updateOne({ name: h.name, disbanded: false }, { $set: { totalPower: total } });
  return total;
}

H["house.create"] = async (c) => {
  const name = c.rest.join(" ").trim();
  if (name.length < C.HOUSE.NAME_MIN || name.length > C.HOUSE.NAME_MAX) { await c.send("House", "⚠️", `Usage: /noblesse house create <name> (${C.HOUSE.NAME_MIN}-${C.HOUSE.NAME_MAX} characters)`); return; }
  if (c.s.house) { await c.send("House", "🛑", `You are already in ${c.s.house}. Leave first.`); return; }
  if (await getHouse(c, name)) { await c.send("House", "❌", `House "${name}" already exists.`); return; }
  if (!(await spend(c, C.HOUSE.CREATE_COST))) return;
  await c.col(COL_HOUSES).insertOne({ name, owner: c.sid, members: [c.sid], bank: 0, totalPower: Math.floor(power(c.s, false)), disbanded: false, created: c.now });
  c.s.house = name;
  const nt = await c.save();
  await c.send("House", "🏰", `House "${name}" founded! You are the Lord.\nCost: ${fmt(C.HOUSE.CREATE_COST)} 🪙${nt}`);
};

H["house.join"] = async (c) => {
  const name = c.rest.join(" ").trim();
  if (c.s.house) { await c.send("House", "🛑", `You are already in ${c.s.house}.`); return; }
  const h = await getHouse(c, name);
  if (!h) { await c.send("House", "❌", `House "${name}" not found.`); return; }
  if (h.members.length >= C.HOUSE.MAX_MEMBERS) { await c.send("House", "🛑", "That House is full."); return; }
  await c.col(COL_HOUSES).updateOne({ name, disbanded: false }, { $push: { members: c.sid } });
  c.s.house = name;
  const nt = await c.save();
  await c.send("House", "✅", `You joined House "${name}"!${nt}`);
};

H["house.leave"] = async (c) => {
  if (!c.s.house) { await c.send("House", "⚠️", "You are not in a House."); return; }
  const h = await getHouse(c, c.s.house);
  if (h && h.owner === c.sid) { await c.send("House", "🛑", "The Lord cannot leave. Use /noblesse house disband."); return; }
  const old = c.s.house;
  await c.col(COL_HOUSES).updateOne({ name: old, disbanded: false }, { $pull: { members: c.sid } });
  c.s.house = undefined;
  await c.save();
  await c.send("House", "✅", `You left House "${old}".`);
};

H["house.list"] = async (c) => {
  const rows = await c.col(COL_HOUSES).find({ disbanded: false }).sort({ totalPower: -1 }).limit(C.LEADERBOARD_SIZE).toArray();
  await c.send("Houses", "🏰", rows.length ? rows.map((h: any, i: number) => `${i + 1}. ${h.name} — ${h.members.length} members | ${fmt(h.totalPower || 0)} power`).join("\n") : "No Houses yet.");
};

H["house.info"] = async (c) => {
  const name = c.rest.join(" ").trim() || c.s.house || "";
  const h = name ? await getHouse(c, name) : null;
  if (!h) { await c.send("House", "❌", name ? `House "${name}" not found.` : "You are not in a House."); return; }
  const total = await refreshHousePower(c, h);
  await c.send("House Info", "🏰", `${h.name}\nMembers: ${h.members.length}/${C.HOUSE.MAX_MEMBERS}\nBank: ${fmt(h.bank || 0)} 🪙\nTotal Power: ${fmt(total)}`);
};

H["house.donate"] = async (c) => {
  if (!c.s.house) { await c.send("House", "⚠️", "You are not in a House."); return; }
  const amt = parseAmount(c.rest[0], c.s.coins);
  if (isNaN(amt) || amt < 1) { await c.send("House", "⚠️", "Usage: /noblesse house donate <amount>"); return; }
  if (!(await spend(c, amt))) return;
  const h = await getHouse(c, c.s.house);
  if (!h) { await c.send("House", "❌", "Your House no longer exists."); return; }
  await c.col(COL_HOUSES).updateOne({ name: h.name, disbanded: false }, { $set: { bank: (h.bank || 0) + amt } });
  bump(c.s, "donated", amt);
  await c.save();
  await c.send("House", "💰", `Donated ${fmt(amt)} 🪙 to ${h.name}.`);
};

H["house.kick"] = async (c) => {
  const h = c.s.house ? await getHouse(c, c.s.house) : null;
  if (!h || h.owner !== c.sid) { await c.send("House", "🛑", "Only a House Lord can kick members."); return; }
  const t = await loadOther(c, c.rest.join(" ").trim());
  if (!t) return;
  if (t.userID === c.sid || t.house !== h.name) { await c.send("House", "⚠️", "That Noble is not a kickable member of your House."); return; }
  await c.col(COL_HOUSES).updateOne({ name: h.name, disbanded: false }, { $pull: { members: t.userID } });
  t.house = undefined;
  await finalize(c.db, t);
  await c.send("House", "✅", `${t.name} was removed from ${h.name}.`);
};

H["house.disband"] = async (c) => {
  const h = c.s.house ? await getHouse(c, c.s.house) : null;
  if (!h || h.owner !== c.sid) { await c.send("House", "🛑", "Only a House Lord can disband the House."); return; }
  for (const id of h.members) {
    if (id === c.sid) continue;
    const p = await getProfile(c.db, id);
    if (p.name) { p.house = undefined; await finalize(c.db, p); }
  }
  await c.col(COL_HOUSES).updateOne({ name: h.name, disbanded: false }, { $set: { disbanded: true, members: [] } });
  c.s.house = undefined;
  await c.save();
  await c.send("House", "💥", `House "${h.name}" has been disbanded.`);
};

H["house.rename"] = async (c) => {
  const nn = c.rest.join(" ").trim();
  const h = c.s.house ? await getHouse(c, c.s.house) : null;
  if (!h || h.owner !== c.sid) { await c.send("House", "🛑", "Only a House Lord can rename the House."); return; }
  if (nn.length < C.HOUSE.NAME_MIN || nn.length > C.HOUSE.NAME_MAX) { await c.send("House", "⚠️", "Usage: /noblesse house rename <new name>"); return; }
  if (await getHouse(c, nn)) { await c.send("House", "❌", "That name is taken."); return; }
  if (!(await spend(c, C.HOUSE.RENAME_COST))) return;
  for (const id of h.members) {
    if (id === c.sid) continue;
    const p = await getProfile(c.db, id);
    if (p.name) { p.house = nn; await finalize(c.db, p); }
  }
  await c.col(COL_HOUSES).updateOne({ name: h.name, disbanded: false }, { $set: { name: nn } });
  c.s.house = nn;
  await c.save();
  await c.send("House", "✅", `House renamed to "${nn}".\nCost: ${fmt(C.HOUSE.RENAME_COST)} 🪙`);
};

H["house.top"] = async (c) => {
  const rows = await c.col(COL_HOUSES).find({ disbanded: false }).sort({ bank: -1 }).limit(C.LEADERBOARD_SIZE).toArray();
  await c.send("Richest Houses", "💰", rows.length ? rows.map((h: any, i: number) => `${i + 1}. ${h.name} — ${fmt(h.bank || 0)} 🪙`).join("\n") : "No Houses yet.");
};

H["house.members"] = async (c) => {
  const h = c.s.house ? await getHouse(c, c.s.house) : null;
  if (!h) { await c.send("House", "⚠️", "You are not in a House."); return; }
  const ms = await houseMembers(c, h);
  await c.send(`${h.name} Members`, "🏰", ms.map(p => `${p.userID === h.owner ? "👑" : "•"} ${p.name} — Lv.${fmt(p.level)} | ${fmt(p.power || 0)} power`).join("\n"));
};

async function rewardMany(c: Ctx, ids: string[], r: { coins?: number; exp?: number; gems?: number }): Promise<void> {
  for (const id of ids) await withProfile(c, id, p => gain(p, r));
}

H["raid.open"] = async (c) => {
  const ex = raidLobbies.get(c.tid);
  if (ex && ex.expiresAt > c.now) { await c.send("Raid", "⚠️", `A raid lobby is already open (${ex.participants.length}/${C.RAID.MAX}). Use /noblesse raid join.`); return; }
  raidLobbies.set(c.tid, { participants: [c.sid], initiator: c.sid, expiresAt: c.now + C.RAID.DURATION });
  setTimeout(() => raidLobbies.delete(c.tid), C.RAID.DURATION * 1000);
  await c.send("⚡ RAID LOBBY ⚡", "🐉", `${c.s.name} opened a raid!\nUp to ${C.RAID.MAX} Nobles may join.\n\nJoin: /noblesse raid join\nStart: /noblesse raid start (initiator only)\nWindow: ${C.RAID.DURATION / 60} minutes`);
};

H["raid.join"] = async (c) => {
  const r = raidLobbies.get(c.tid);
  if (!r || r.expiresAt < c.now) { await c.send("Raid", "⚠️", "No open raid lobby. Use /noblesse raid open."); return; }
  if (r.participants.includes(c.sid)) { await c.send("Raid", "🛑", "You already joined."); return; }
  if (r.participants.length >= C.RAID.MAX) { await c.send("Raid", "🛑", "The raid is full."); return; }
  r.participants.push(c.sid);
  await c.send("Raid", "✅", `${c.s.name} joined the raid! (${r.participants.length}/${C.RAID.MAX})`);
};

H["raid.start"] = async (c) => {
  const r = raidLobbies.get(c.tid);
  if (!r) { await c.send("Raid", "⚠️", "No raid open. Use /noblesse raid open."); return; }
  if (r.initiator !== c.sid) { await c.send("Raid", "❌", "Only the initiator can start the raid."); return; }
  if (r.participants.length < 2) { await c.send("Raid", "⚠️", `Need at least 2 Nobles. Current: ${r.participants.length}.`); return; }
  let team = 0, raw = 0;
  const names: string[] = [];
  for (const id of r.participants) {
    const p = id === c.sid ? c.s : await getProfile(c.db, id);
    if (isDevUser(id)) p.stats = devStats(p);
    raw += power(p);
    team += power(p) * (0.85 + Math.random() * 0.3);
    names.push(p.name || "Unknown");
  }
  const boss = pickEnemy(c.s, bossEnemies(), 0.2, 4);
  const bossPow = raw * (0.75 + Math.random() * 0.5);
  const win = team > bossPow;
  raidLobbies.delete(c.tid);
  if (win) {
    await rewardMany(c, r.participants, C.RAID.REWARD);
    for (const id of r.participants) await withProfile(c, id, p => bump(p, "raidWins"));
  } else await rewardMany(c, r.participants, { exp: Math.floor(C.RAID.REWARD.exp * 0.2) });
  const nt = await c.save();
  await c.send("⚡ RAID RESULT ⚡", "🐉", `Boss: ${boss.name}\nTeam: ${names.join(", ")}\n\n⚔️ Team Power: ${fmt(Math.floor(team))}\n🛡️ Boss Power: ${fmt(Math.floor(bossPow))}\n\n${win ? `🏆 VICTORY!\nEach Noble: +${fmt(C.RAID.REWARD.coins)} 🪙 | +${fmt(C.RAID.REWARD.exp)} EXP | +${C.RAID.REWARD.gems} 💎` : `💀 DEFEAT. Each Noble: +${fmt(Math.floor(C.RAID.REWARD.exp * 0.2))} EXP`}${nt}`);
};

H["tournament.open"] = async (c) => {
  const ex = tourneyLobbies.get(c.tid);
  if (ex && ex.expiresAt > c.now) { await c.send("Tournament", "⚠️", "A tournament lobby is already open."); return; }
  tourneyLobbies.set(c.tid, { participants: [c.sid], initiator: c.sid, expiresAt: c.now + C.TOURNEY.DURATION });
  setTimeout(() => tourneyLobbies.delete(c.tid), C.TOURNEY.DURATION * 1000);
  await c.send("🏆 TOURNAMENT 🏆", "⚔️", `${c.s.name} opened a Noble Tournament!\nUp to ${C.TOURNEY.MAX} entrants.\n\nJoin: /noblesse tournament join\nBegin: /noblesse tournament begin (initiator only)`);
};

H["tournament.join"] = async (c) => {
  const t = tourneyLobbies.get(c.tid);
  if (!t || t.expiresAt < c.now) { await c.send("Tournament", "⚠️", "No open tournament. Use /noblesse tournament open."); return; }
  if (t.participants.includes(c.sid)) { await c.send("Tournament", "🛑", "You already entered."); return; }
  if (t.participants.length >= C.TOURNEY.MAX) { await c.send("Tournament", "🛑", "The tournament is full."); return; }
  t.participants.push(c.sid);
  await c.send("Tournament", "✅", `${c.s.name} entered! (${t.participants.length}/${C.TOURNEY.MAX})`);
};

H["tournament.begin"] = async (c) => {
  const t = tourneyLobbies.get(c.tid);
  if (!t) { await c.send("Tournament", "⚠️", "No tournament open."); return; }
  if (t.initiator !== c.sid) { await c.send("Tournament", "❌", "Only the initiator can begin."); return; }
  if (t.participants.length < 2) { await c.send("Tournament", "⚠️", "Need at least 2 entrants."); return; }
  const entrants: { id: string; name: string; pw: number }[] = [];
  for (const id of t.participants) {
    const p = id === c.sid ? c.s : await getProfile(c.db, id);
    if (isDevUser(id)) p.stats = devStats(p);
    entrants.push({ id, name: p.name || "Unknown", pw: power(p) * (0.85 + Math.random() * 0.3) });
  }
  entrants.sort((a, b) => b.pw - a.pw);
  tourneyLobbies.delete(c.tid);
  await withProfile(c, entrants[0].id, p => { gain(p, C.TOURNEY.WINNER); bump(p, "tourneyWins"); });
  await rewardMany(c, entrants.slice(1).map(e => e.id), C.TOURNEY.LOSER);
  const nt = await c.save();
  await c.send("🏆 TOURNAMENT RESULT 🏆", "⚔️", `${entrants.map((e, i) => `${i + 1}. ${e.name} — ${fmt(Math.floor(e.pw))}`).join("\n")}\n\n🏆 Champion: ${entrants[0].name}\n+${fmt(C.TOURNEY.WINNER.coins)} 🪙 | +${fmt(C.TOURNEY.WINNER.exp)} EXP | +${C.TOURNEY.WINNER.gems} 💎\nOthers: +${fmt(C.TOURNEY.LOSER.exp)} EXP${nt}`);
};

H["surge.start"] = async (c) => {
  const ex = surges.get(c.tid);
  if (ex && ex.expiresAt > c.now) { await c.send("Soul Surge", "⚠️", "A Soul Surge is already active!"); return; }
  surges.set(c.tid, { expiresAt: c.now + C.SURGE.DURATION, claimedBy: null });
  const r = C.SURGE.REWARDS;
  setTimeout(() => {
    const sg = surges.get(c.tid);
    if (sg && !sg.claimedBy) { surges.delete(c.tid); c.api.sendMessage(styled("Soul Surge", "🌙", "The surge faded before anyone claimed it."), c.tid); }
  }, C.SURGE.DURATION * 1000);
  await c.send("⚡ SOUL SURGE ⚡", "🌙", `A surge of noble power ripples through the area!\n\nFirst registered Noble to use /noblesse surge enter claims:\n• ${fmt(r.coins)} 🪙\n• ${fmt(r.exp)} EXP\n• ${r.gems} 💎\n\nOnly ONE Noble can claim it!`);
};

H["surge.enter"] = async (c) => {
  const sg = surges.get(c.tid);
  if (!sg || sg.expiresAt < c.now) { await c.send("Soul Surge", "⚠️", "No active Soul Surge right now."); return; }
  if (sg.claimedBy) { await c.send("Soul Surge", "🛑", "The surge was already claimed."); return; }
  sg.claimedBy = c.sid;
  gain(c.s, C.SURGE.REWARDS);
  bump(c.s, "surges");
  const nt = await c.save();
  await c.send("⚡ SOUL SURGE CLAIMED ⚡", "🌙", `${c.s.name} seized the surge!\n+${fmt(C.SURGE.REWARDS.coins)} 🪙 | +${fmt(C.SURGE.REWARDS.exp)} EXP | +${C.SURGE.REWARDS.gems} 💎${nt}`);
};

async function ensureBoss(c: Ctx, force = false): Promise<any> {
  const col = c.col(COL_WORLD);
  let b = await col.findOne({ key: "worldboss" });
  const respawn = !b || force || (b.hp <= 0 && c.now - (b.deadAt || 0) >= C.WORLDBOSS.RESPAWN_SECS);
  if (respawn) {
    const kills = b?.kills || 0;
    const maxHp = Math.floor(C.WORLDBOSS.BASE_HP * Math.pow(C.WORLDBOSS.HP_GROWTH, kills));
    b = { key: "worldboss", name: pick(bossEnemies()).name, hp: maxHp, maxHp, damage: {}, kills, deadAt: 0 };
    await col.updateOne({ key: "worldboss" }, { $set: b }, { upsert: true });
  }
  return b;
}

H["worldboss"] = async (c) => {
  const b = await ensureBoss(c);
  if (b.hp <= 0) { const left = C.WORLDBOSS.RESPAWN_SECS - (c.now - b.deadAt); await c.send("World Boss", "💀", `${b.name} was defeated.\nA new threat appears in ${Math.max(0, Math.floor(left / 60))} minutes.`); return; }
  const top = Object.entries(b.damage || {}).sort((x: any, y: any) => y[1] - x[1]).slice(0, 3);
  const names: string[] = [];
  for (const [id, d] of top) { const p = await getProfile(c.db, id); names.push(`${p.name || "Unknown"} — ${fmt(d as number)}`); }
  await c.send("World Boss", "🐉", `${b.name}\nHP: [${bar(b.hp, b.maxHp, 14)}]\n${fmt(b.hp)}/${fmt(b.maxHp)}\n\nTop damage:\n${names.join("\n") || "None yet"}\n\nAttack with /noblesse worldboss attack`);
};

H["worldboss.attack"] = async (c) => {
  const b = await ensureBoss(c);
  if (b.hp <= 0) { await c.send("World Boss", "💀", "The boss is already defeated. Wait for it to respawn."); return; }
  if (await c.onCd("worldboss", C.COOLDOWNS.worldboss)) return;
  const dmg = Math.floor(power(c.s) * C.WORLDBOSS.DAMAGE_MULT * (0.8 + Math.random() * 0.4));
  const dealt = Math.min(dmg, b.hp);
  const damage = { ...(b.damage || {}) };
  damage[c.sid] = (damage[c.sid] || 0) + dealt;
  const hp = b.hp - dealt;
  bump(c.s, "worldBossHits");
  if (hp > 0) {
    await c.col(COL_WORLD).updateOne({ key: "worldboss" }, { $set: { hp, damage } });
    const nt = await c.save();
    await c.send("World Boss", "🐉", `You strike ${b.name} for ${fmt(dealt)} damage!\nHP: [${bar(hp, b.maxHp, 14)}] ${fmt(hp)}/${fmt(b.maxHp)}${nt}`);
    return;
  }
  await c.col(COL_WORLD).updateOne({ key: "worldboss" }, { $set: { hp: 0, damage, deadAt: c.now, kills: (b.kills || 0) + 1 } });
  const pool = C.WORLDBOSS.KILL_POOL;
  const lines: string[] = [];
  for (const [id, d] of Object.entries(damage).slice(0, 50)) {
    const share = (d as number) / b.maxHp;
    const r = { coins: Math.floor(pool.coins * share), exp: Math.floor(pool.exp * share), gems: Math.floor(pool.gems * share) };
    if (id === c.sid) { r.coins += C.WORLDBOSS.KILLER_BONUS.coins; r.gems += C.WORLDBOSS.KILLER_BONUS.gems; }
    await withProfile(c, id, p => { gain(p, r); if (id === c.sid) bump(p, "worldBossKills"); });
    lines.push(`${id === c.sid ? c.s.name : (await getProfile(c.db, id)).name}: +${fmt(r.coins)} 🪙 | +${fmt(r.exp)} EXP | +${r.gems} 💎`);
  }
  const nt = await c.save();
  await c.send("World Boss Defeated", "🏆", `${c.s.name} landed the final blow on ${b.name}!\n\n${lines.join("\n")}${nt}`);
};

H["admin.spawnboss"] = async (c) => {
  const b = await ensureBoss(c, true);
  await c.send("Admin", "✅", `Spawned ${b.name} with ${fmt(b.maxHp)} HP.`);
};

async function topBoard(c: Ctx, title: string, sortKey: string, val: (p: any) => string): Promise<void> {
  const rows = await c.col(COL_PLAYERS).find({ name: { $exists: true } }).sort({ [sortKey]: -1 }).limit(C.LEADERBOARD_SIZE * 2).toArray();
  const list = rows.filter((p: any) => p.name).slice(0, C.LEADERBOARD_SIZE);
  await c.send(title, "🏅", list.length ? list.map((p: any, i: number) => `${i + 1}. ${p.name}${isDevUser(p.userID) ? " 👑" : ""} — ${val(p)}`).join("\n") : "No players yet.");
}

H["leaderboard"] = async (c) => { await topBoard(c, "Top Nobles", "power", p => `${fmt(p.power || 0)} power`); };
H["leaderboard.power"] = H["leaderboard"];
H["leaderboard.wins"] = async (c) => { await topBoard(c, "Most Wins", "counters.wins", p => `${fmt(p.counters?.wins || 0)} wins`); };
H["leaderboard.wealth"] = async (c) => { await topBoard(c, "Richest Nobles", "coins", p => `${fmt(p.coins || 0)} 🪙`); };
H["leaderboard.level"] = async (c) => { await topBoard(c, "Highest Level", "level", p => `Lv.${fmt(p.level || 1)}`); };
H["leaderboard.house"] = async (c) => { await H["house.list"](c); };

H["pay"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 1);
  const amt = parseAmount(tail[0], c.s.coins);
  if (!name || isNaN(amt) || amt < C.PAY.MIN) { await c.send("Pay", "⚠️", "Usage: /noblesse pay <name> <amount>"); return; }
  const t = await loadOther(c, name);
  if (!t) return;
  if (t.userID === c.sid) { await c.send("Pay", "🛑", "You cannot pay yourself."); return; }
  if (!(await spend(c, amt))) return;
  const got = Math.floor(amt * (1 - C.PAY.FEE));
  t.coins += got;
  await finalize(c.db, t);
  await c.save();
  await c.send("Pay", "💸", `Sent ${fmt(amt)} 🪙 to ${t.name}.\nThey received ${fmt(got)} 🪙 (${Math.round(C.PAY.FEE * 100)}% fee).`);
};

H["gift"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 2);
  const it = resolveItem(tail[0] || "");
  const qty = parseInt(tail[1]);
  if (!name || !it || isNaN(qty) || qty < 1) { await c.send("Gift", "⚠️", "Usage: /noblesse gift <name> <ID> <qty>"); return; }
  const t = await loadOther(c, name);
  if (!t) return;
  if (t.userID === c.sid) { await c.send("Gift", "🛑", "You cannot gift yourself."); return; }
  if (it.type === "weapon" && (qty !== 1 || c.s.equipped.weapon === it.ref || t.inv.weapons[it.ref])) { await c.send("Gift", "🛑", "Weapons are gifted one at a time, unequipped, and only if the recipient lacks them."); return; }
  if (itemQty(c.s, it.type, it.ref) < qty) { await c.send("Gift", "❌", "You do not have enough of that item."); return; }
  const lvl = it.type === "weapon" ? c.s.inv.weapons[it.ref].level : 0;
  takeItem(c.s, it.type, it.ref, qty);
  addItem(t, it.type, it.ref, qty, lvl);
  await finalize(c.db, t);
  await c.save();
  await c.send("Gift", "🎁", `Gifted ${qty}x ${itemName(it.type, it.ref)} to ${t.name}.`);
};

async function getBet(c: Ctx, tok: string | undefined): Promise<number> {
  const bet = parseAmount(tok, Math.min(c.s.coins, C.GAMBLE_MAX_BET));
  if (isNaN(bet) || bet < 1) { await c.send("Games", "⚠️", `Usage: /noblesse ${c.key.replace(".", " ")} <amount>`); return NaN; }
  if (bet > C.GAMBLE_MAX_BET) { await c.send("Games", "🛑", `Max bet is ${fmt(C.GAMBLE_MAX_BET)} 🪙.`); return NaN; }
  if (!c.isDev && bet > c.s.coins) { await c.send("Games", "❌", `You only have ${fmt(c.s.coins)} 🪙.`); return NaN; }
  return bet;
}

async function finishGame(c: Ctx, title: string, sym: string, bet: number, payout: number, body: string): Promise<void> {
  c.s.coins += payout - bet;
  bump(c.s, "gamesPlayed");
  const nt = await c.save();
  const net = payout - bet;
  await c.send(title, sym, `${body}\n\n${net > 0 ? `🏆 Won ${fmt(net)} 🪙` : net === 0 ? "🔹 Break even" : `💸 Lost ${fmt(-net)} 🪙`}\nBalance: ${fmt(c.s.coins)} 🪙${nt}`);
}

H["coinflip"] = async (c) => {
  const side = (c.rest[1] || "").toLowerCase();
  if (!["heads", "tails"].includes(side)) { await c.send("Coinflip", "⚠️", "Usage: /noblesse coinflip <amount> <heads/tails>"); return; }
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

H["gamble"] = async (c) => {
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const win = Math.random() < 0.45;
  await finishGame(c, "Gamble", "🎯", bet, win ? bet * 2 : 0, win ? "Fortune smiles on you." : "Fortune turns away.");
};

H["wheel"] = async (c) => {
  const bet = await getBet(c, c.rest[0]);
  if (isNaN(bet)) return;
  if (await c.onCd("game", C.GAME_CD)) return;
  const seg = weighted<any>(C.WHEEL);
  await finishGame(c, "Wheel", "🎡", bet, Math.floor(bet * seg.mult), `The wheel stops on ${seg.label} (x${seg.mult}).`);
};

H["lottery"] = async (c) => {
  if (!(await spend(c, C.LOTTERY.COST))) return;
  if (await c.onCd("game", C.GAME_CD)) { c.s.coins += c.isDev ? 0 : C.LOTTERY.COST; return; }
  const p = weighted<any>(C.LOTTERY.PRIZES);
  gain(c.s, { coins: p.coins, gems: p.gems });
  bump(c.s, "gamesPlayed");
  const nt = await c.save();
  await c.send("Lottery", "🎟️", `You scratch your ticket...\n\n🎁 ${p.label}${p.coins || p.gems ? `\n+${fmt(p.coins)} 🪙${p.gems ? ` | +${p.gems} 💎` : ""}` : ""}\nTicket: ${fmt(C.LOTTERY.COST)} 🪙${nt}`);
};

async function listenOnce(c: Ctx, msgID: string, check: (body: string) => boolean, reward: () => Promise<void>, onFail: () => string): Promise<void> {
  let done = false;
  global.registerEnkiduListener(msgID, async ({ api, event }: any) => {
    if (done || event.senderID.toString() !== c.sid) return;
    done = true;
    global.replyListeners.delete(msgID);
    if (check((event.body || "").trim().toLowerCase())) await reward();
    else await api.sendMessage(styled("Result", "❌", onFail()), event.threadID, event.messageID);
  });
  setTimeout(() => { if (!done) { done = true; global.replyListeners.delete(msgID); } }, C.TRIVIA.TIMEOUT * 1000);
}

async function rewardTrivia(c: Ctx, text: string): Promise<void> {
  const p = await getProfile(c.db, c.sid);
  if (isDevUser(c.sid)) applyDevBuff(p);
  gain(p, C.TRIVIA.REWARD);
  bump(p, "gamesPlayed"); bump(p, "triviaWins");
  await finalize(c.db, p);
  await c.api.sendMessage(styled("Correct!", "✅", `${text}\n+${fmt(C.TRIVIA.REWARD.coins)} 🪙 | +${fmt(C.TRIVIA.REWARD.exp)} EXP`), c.tid);
}

H["trivia"] = async (c) => {
  const q = pick<any>(TRIVIA_DATA.questions);
  const letters = ["a", "b", "c", "d"];
  const info: any = await new Promise(resolve => {
    c.api.sendMessage(styled("Noblesse Trivia", "❓", `${q.q}\n\n${q.options.map((o: string, i: number) => `${letters[i].toUpperCase()}. ${o}`).join("\n")}\n\nReply to this message with A, B, C or D within ${C.TRIVIA.TIMEOUT}s.`), c.tid, (e: any, i: any) => resolve(i), c.mid);
  });
  if (!info?.messageID) return;
  await listenOnce(c, info.messageID, b => b === letters[q.answer], () => rewardTrivia(c, `The answer was ${letters[q.answer].toUpperCase()}. ${q.options[q.answer]}.`), () => `Wrong! The answer was ${letters[q.answer].toUpperCase()}. ${q.options[q.answer]}.`);
};

H["riddle"] = async (c) => {
  const r = pick<any>(TRIVIA_DATA.riddles);
  const info: any = await new Promise(resolve => {
    c.api.sendMessage(styled("Noble Riddle", "🧩", `${r.q}\n\nReply to this message with your answer within ${C.TRIVIA.TIMEOUT}s.`), c.tid, (e: any, i: any) => resolve(i), c.mid);
  });
  if (!info?.messageID) return;
  await listenOnce(c, info.messageID, b => r.answers.includes(b), () => rewardTrivia(c, "You solved the riddle."), () => `Wrong! Possible answer: ${r.answers[0]}.`);
};

function loreText(list: any[]): string { return list.map((e: any) => `▪ ${e.t}\n${e.d}`).join("\n\n"); }

for (const cat of Object.keys(LORE_DATA.categories)) {
  H[`lore.${cat}`] = async (c) => { await c.send(`Lore: ${cat}`, "📚", loreText(LORE_DATA.categories[cat])); };
}

H["lore.quotes"] = async (c) => { await c.send("Proverbs of the Nobles", "📜", [...LORE_DATA.proverbs].sort(() => Math.random() - 0.5).slice(0, 3).map((q: string) => `"${q}"`).join("\n\n")); };
H["lore.fact"] = async (c) => { await c.send("Did You Know?", "💡", pick<string>(LORE_DATA.facts)); };
H["lore.random"] = async (c) => {
  const all = Object.values(LORE_DATA.categories).flat() as any[];
  await c.send("Random Lore", "🎲", loreText([pick(all)]));
};
H["lore.search"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase().trim();
  if (!q) { await c.send("Lore Search", "⚠️", "Usage: /noblesse lore search <keyword>"); return; }
  const hits = (Object.values(LORE_DATA.categories).flat() as any[]).filter((e: any) => e.t.toLowerCase().includes(q) || e.d.toLowerCase().includes(q)).slice(0, 8);
  await c.send("Lore Search", "🔎", hits.length ? loreText(hits) : `No lore found for "${q}".`);
};

async function adminTarget(c: Ctx, name: string): Promise<Profile | null> {
  const t = await findByName(c.db, name);
  if (!t) await c.send("Admin", "❌", `Noble "${name}" not found.`);
  return t;
}

H["admin.setstat"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 4);
  const v = tail.map(x => parseInt(x));
  if (!name || v.some(isNaN)) { await c.send("Admin", "⚠️", "Usage: /noblesse admin setstat <name> <atk> <def> <mana> <luck>"); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  t.trained = { atk: v[0], def: v[1], mana: v[2], luck: v[3] };
  await finalize(c.db, t);
  await c.send("Admin", "✅", `Trained stats for ${t.name} set.\n\n${statLine(t.stats)}`);
};

async function adminGive(c: Ctx, field: "coins" | "gems" | "exp"): Promise<void> {
  const { name, tail } = splitTail(c.rest, 1);
  const amt = parseInt(tail[0]);
  if (!name || isNaN(amt)) { await c.send("Admin", "⚠️", `Usage: /noblesse admin give${field} <name> <amount>`); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  gain(t, { [field]: amt });
  await finalize(c.db, t);
  await c.send("Admin", "✅", `Gave ${fmt(amt)} ${field} to ${t.name}.`);
}
H["admin.givecoins"] = async (c) => { await adminGive(c, "coins"); };
H["admin.givegems"] = async (c) => { await adminGive(c, "gems"); };
H["admin.giveexp"] = async (c) => { await adminGive(c, "exp"); };

H["admin.givematerial"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 2);
  const it = resolveItem(tail[0] || "");
  const qty = parseInt(tail[1]);
  if (!name || !it || it.type !== "material" || isNaN(qty)) { await c.send("Admin", "⚠️", `Usage: /noblesse admin givematerial <name> <key> <qty>\nKeys: ${Object.keys(MATERIAL_MAP).join(", ")}`); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  addItem(t, "material", it.ref, qty);
  await finalize(c.db, t);
  await c.send("Admin", "✅", `Gave ${qty}x ${MATERIAL_MAP[it.ref].name} to ${t.name}.`);
};

H["admin.setlevel"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 1);
  const lv = parseInt(tail[0]);
  if (!name || isNaN(lv) || lv < 1) { await c.send("Admin", "⚠️", "Usage: /noblesse admin setlevel <name> <level>"); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  t.level = lv; t.exp = (lv - 1) * C.EXP_PER_LEVEL;
  await finalize(c.db, t);
  await c.send("Admin", "✅", `${t.name} is now level ${fmt(lv)}.`);
};

H["admin.ban"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  t.disabled = true;
  await saveProfile(c.db, t);
  await c.send("Admin", "✅", `${t.name} has been banned.`);
};

H["admin.unban"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  t.disabled = false;
  await saveProfile(c.db, t);
  await c.send("Admin", "✅", `${t.name} has been unbanned.`);
};

H["admin.wipe"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  if (isDevUser(t.userID)) { await c.send("Admin", "🛑", "The developer account cannot be wiped."); return; }
  const fresh = newProfile(t.userID);
  fresh.name = undefined;
  await saveProfile(c.db, fresh);
  await c.send("Admin", "✅", `${t.name} was wiped and must register again.`);
};

H["admin.resetcd"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  t.cd = {};
  await saveProfile(c.db, t);
  await c.send("Admin", "✅", `Cooldowns cleared for ${t.name}.`);
};

H["admin.inspect"] = async (c) => {
  const t = await adminTarget(c, c.rest.join(" ").trim());
  if (!t) return;
  await c.send("Inspect", "🔍", `${t.name} (${t.userID})\nChar: ${CHAR_MAP[t.mainChar || ""]?.name} | Clan: ${t.clan}\nLevel: ${fmt(t.level)} | Prestige: ${t.prestige}\n${statLine(t.stats)}\n🪙 ${fmt(t.coins)} | 💎 ${fmt(t.gems)}\nWins: ${fmt(t.counters.wins || 0)} | Story: ${t.story}/${STORY_LIST.length}\nHouse: ${t.house || "None"} | Banned: ${t.disabled ? "yes" : "no"}`);
};

H["admin.setclan"] = async (c) => {
  const { name, tail } = splitTail(c.rest, 1);
  const cl = CLAN_MAP[(tail[0] || "").toLowerCase()];
  if (!name || !cl) { await c.send("Admin", "⚠️", "Usage: /noblesse admin setclan <name> <clanId>"); return; }
  const t = await adminTarget(c, name);
  if (!t) return;
  t.clan = cl.id;
  await finalize(c.db, t);
  await c.send("Admin", "✅", `${t.name} is now in clan ${cl.name}.`);
};

H["dev.buff"] = async (c) => {
  applyDevBuff(c.s);
  await c.save();
  await c.send("Developer", "👑", `Developer buff reapplied.\n\n${D.displayName}\n${statLine(c.s.stats)}`);
};

H["dev.unlock"] = async (c) => {
  applyDevBuff(c.s);
  c.s.story = STORY_LIST.length;
  for (const a of ACH_LIST) c.s.achievements[a.id] = c.s.achievements[a.id] || false;
  await c.save();
  await c.send("Developer", "🔓", `Everything unlocked:\n• ${CHAR_LIST.length} characters (${C.STAR_MAX}★)\n• ${Object.keys(SKILL_MAP).length} skills\n• ${Object.keys(WEAPON_MAP).length} weapons (+${C.WEAPON_MAX_UPGRADE})\n• ${TITLE_LIST.length} titles\n• ${STORY_LIST.length} story chapters\n• Bound ${SOUL_LIST[SOUL_LIST.length - 1].name}\n• Maximum bond, prestige and Authority`);
};

H["dev.form"] = async (c) => {
  const f = D.forms.find((x: any) => x.id === (c.rest[0] || "").toLowerCase());
  if (!f) { await c.send("Developer Forms", "🌌", `Current: ${devForm(c.s).name}\n\n${D.forms.map((x: any) => `${x.id}: ${x.name} (x${x.mult})\n   ${x.desc}`).join("\n")}\n\nUsage: /noblesse dev form <id>`); return; }
  c.s.devForm = f.id;
  await c.save();
  await c.send("Developer Forms", "🌌", `Form changed to ${f.name}.\n"${f.desc}"\n\n${statLine(c.s.stats)}`);
};

const CATEGORY_ORDER: string[] = Array.from(new Set(Object.values(REG).map(v => v.category)));
const disp = (k: string): string => k.replace(".", " ");

H["help"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase().trim();
  if (!q) {
    const lines = CATEGORY_ORDER.map(cat => `${cat} (${Object.values(REG).filter(v => v.category === cat).length})`).join("\n");
    await c.send("Noblesse Commands", "🌙", `${Object.keys(REG).length} subcommands.\n\n${lines}\n\n/noblesse help <category> for details\n/noblesse commands for the full list\n/noblesse search <keyword>`);
    return;
  }
  const cat = CATEGORY_ORDER.find(x => x.toLowerCase().includes(q));
  if (!cat) { await c.send("Help", "⚠️", "Category not found. Use /noblesse help."); return; }
  const rows = Object.entries(REG).filter(([, v]) => v.category === cat).map(([k, v]) => `/noblesse ${disp(k)}${v.usage ? " " + v.usage : ""}\n   ${v.desc}${v.access !== "all" ? ` (${v.access})` : ""}`);
  await c.send(cat, "📖", rows.join("\n"));
};

H["commands"] = async (c) => {
  const keys = Object.keys(REG);
  const p = pageOf(keys, parseInt(c.rest[0]) || 1, C.PAGE_SIZE * 2);
  await c.send("All Subcommands", "📋", `Page ${p.page}/${p.pages}\n\n${p.items.map(disp).join(", ")}\n\n/noblesse commands <page>`);
};

H["search"] = async (c) => {
  const q = c.rest.join(" ").toLowerCase().trim();
  if (!q) { await c.send("Search", "⚠️", "Usage: /noblesse search <keyword>"); return; }
  const hits = Object.entries(REG).filter(([k, v]) => k.includes(q) || v.desc.toLowerCase().includes(q)).slice(0, 20);
  await c.send("Search", "🔎", hits.length ? hits.map(([k, v]) => `/noblesse ${disp(k)}${v.usage ? " " + v.usage : ""} — ${v.desc}`).join("\n") : `Nothing found for "${q}".`);
};

H["about"] = async (c) => {
  await c.send("About Noblesse", "🌙", `A Noblesse-themed RPG.\n\n📜 ${Object.keys(REG).length} subcommands\n🎴 ${CHAR_LIST.length - 1} summonable characters\n🩸 ${CLAN_LIST.length - 1} clans\n🗡️ ${Object.keys(WEAPON_MAP).length} weapons | 🌀 ${Object.keys(SKILL_MAP).length} skills\n📖 ${STORY_LIST.length} story chapters | 🧭 ${LOCATION_LIST.length} locations\n\nVersion ${C.VERSION}`);
};

H["ping"] = async (c) => {
  const t0 = Date.now();
  await c.col(COL_PLAYERS).findOne({ userID: c.sid });
  await c.send("Ping", "🏓", `Pong! Database round trip: ${Date.now() - t0}ms`);
};

H["version"] = async (c) => { await c.send("Version", "🏷️", `Noblesse command v${C.VERSION}`); };
H["tips"] = async (c) => { await c.send("Tip", "💡", pick<string>(C.TIPS)); };

const noblesseCommand: ShadowBot.Command = {
  config: {
    name: "noblesse",
    description: "Noblesse RPG — become a Noble, summon allies, fight the Union and rise to the Noblesse!",
    usage: "/noblesse help | /noblesse register <name> | /noblesse status | /noblesse summon | /noblesse battle | /noblesse commands",
    aliases: ["nb", "noble"],
    category: "Games 🎮",
  },

  run: async ({ api, event, args, db }) => {
    if (!db) { await api.sendMessage("Database not available.", event.threadID, event.messageID); return; }

    const { threadID, messageID, senderID } = event;
    const sid = senderID.toString();
    const isDev = isDevUser(sid);
    const now = nowSec();
    const { key, rest } = resolveKey(args);

    const s = await getProfile(db, sid);
    if (isDev && s.name) applyDevBuff(s);

    const c: Ctx = {
      api, event, db, s, isDev, sid, tid: threadID, mid: messageID, key, rest, now,
      send: async (h, sym, b) => { await api.sendMessage(styled(h, sym, b), threadID, messageID); },
      save: async () => {
        recalc(s);
        s.power = Math.floor(power(s, false));
        const nt = titleLine(grantTitles(s));
        await saveProfile(db, s);
        return nt;
      },
      onCd: async (k, secs) => {
        if (isDev) return false;
        const until = s.cd[k] || 0;
        if (until > now) { await api.sendMessage(styled("Cooldown", "⏳", `Wait ${until - now}s before using this again.`), threadID, messageID); return true; }
        s.cd[k] = now + secs;
        return false;
      },
      col: (n: string) => db.db(n),
    };

    if (!key) {
      const a0 = (args[0] || "").toLowerCase();
      const group = a0 ? Object.keys(REG).filter(k => k.startsWith(a0 + ".")) : [];
      if (group.length) {
        await c.send(`Noblesse: ${a0}`, "📖", group.map(k => `/noblesse ${disp(k)}${REG[k].usage ? " " + REG[k].usage : ""}\n   ${REG[k].desc}`).join("\n"));
        return;
      }
      await H["help"]({ ...c, rest: [] });
      return;
    }

    if (s.disabled && !isDev) { await c.send("Noblesse", "🚫", "You are banned from using Noblesse commands."); return; }

    const meta = REG[key];
    if (meta.access === "dev" && !isDev) { await c.send("Developer", "❌", "Developer only."); return; }
    if (meta.access === "admin" && !isAuthorized(sid, isDev)) { await c.send("Admin", "❌", "Access denied."); return; }

    if (!s.name && !NO_REG_KEYS.includes(key) && !key.startsWith("lore.")) {
      await c.send("Noblesse", "⚠️", "You need to register first!\nUsage: /noblesse register <name>");
      return;
    }

    const fn = H[key];
    if (!fn) { await c.send("Noblesse", "⚠️", "That subcommand is not available."); return; }
    try { await fn(c); }
    catch (err: any) { await c.send("Noblesse", "⚠️", `Something went wrong: ${err?.message || "unknown error"}`); }
  },
};

export default noblesseCommand;


