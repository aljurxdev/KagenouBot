<p align="center">
  <img src="https://media1.tenor.com/m/e605EnyHkN0AAAAd/shadow-cid-kagenou-piano-moonlight-sonata.gif" alt="Image description" width="100%" />
</p>

# Welcome to KagenouBot Data

- This folder holds the JSON data used by the game commands of KagenouBot.
- Every game keeps its data in its own folder, so editing one game never touches another.

# Folders

| Folder | Game | Command |
| --- | --- | --- |
| `fate/` | Fate/Grand Order themed RPG | `fate.ts` |
| `Wistoria-Wand-And-Sword/` | Wistoria: Wand and Sword | WWS command |
| `noblesse/` | Noblesse RPG with 220 subcommands | `noblesse.ts` |

# How it works

- Commands import the JSON files through the path aliases in `tsconfig.json`.
  - `@fate/*` points to `Data/fate/`
  - `@wistoria-wand-and-sword/*` points to `Data/Wistoria-Wand-And-Sword/`
  - `@noblesse/*` points to `Data/noblesse/`
- Game logic lives in the command files. Characters, items, enemies, costs and rates live here.
- To change the game, edit the JSON. No code change needed.
- Player progress is never stored here. It is saved in MongoDB.

# Adding a new game

- Create a new folder inside `Data/`.
- Put the JSON files inside it.
- Add the aliases to `tsconfig.json` under `paths`.
- Add a `README.md` inside the new folder.

# Patch note version 12.2.61
## Whats new?
- New `noblesse/` data folder.
- New Noblesse command with 220 subcommands.
- New Developer account: Cadis Etrama Di Raizel.
