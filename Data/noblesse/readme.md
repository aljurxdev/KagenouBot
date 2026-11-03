<p align="center">
  <img src="https://media1.tenor.com/m/cQand2odZ8sAAAAd/dansix-badas.gif" alt="Image description" width="100%" />
</p>

# Welcome to Noblesse Data game

- JSON's characters and other.

# Files

| File | What it holds |
| --- | --- |
| `constants.json` | Dev UID, rates, costs, cooldowns and all game settings |
| `characters.json` | Summonable characters and the developer-only Cadis Etrama Di Raizel |
| `clans.json` | Clans and their stat multipliers |
| `weapons.json` | 20 weapons |
| `potions.json` | 10 potions |
| `materials.json` | 12 crafting materials |
| `skills.json` | 16 learnable skills |
| `shop.json` | Shop IDs for weapons, potions and materials |
| `enemies.json` | Enemies by tag and world bosses |
| `locations.json` | 11 explorable locations |
| `story.json` | 14 story chapters |
| `quests.json` | Daily quest pool |
| `titles.json` | Unlockable titles |
| `achievements.json` | Claimable achievements |
| `soulweapons.json` | Soul weapon forms |
| `recipes.json` | Crafting recipes |
| `actions.json` | Training, buff, gather and hunt actions |
| `lore.json` | Lore entries, facts, proverbs and bond stories |
| `trivia.json` | Trivia questions and riddles |
| `subcommands.json` | Registry of all 220 subcommands |
| `dev.json` | Developer account and its forms |

# Setup

- Open `constants.json` and replace `DEV_UID` with your Facebook UID.
- Make sure `tsconfig.json` contains the `@noblesse/*` paths.
- Put `noblesse.ts` in your commands folder.

# Collections used

- `noblesse_players`
- `noblesse_houses`
- `noblesse_market`
- `noblesse_world`

# Patch note version 1.0.0
## Whats new?
- New Noblesse command with 220 subcommands.
- New proper db handling.
- New Developer account: Cadis Etrama Di Raizel with everything unlocked and maxed status.
- New data driven design, edit the JSON's to change the game.
