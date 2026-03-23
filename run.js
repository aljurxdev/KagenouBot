require("./utils/logger");
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");
const config     = JSON.parse(fs.readFileSync(configPath, "utf8"));

const script = config.DiscordMode
  ? "./Discord/index"
  : "./index";

global.log.info(`[RUN] Starting ${
  config.DiscordMode ? "Discord-KagenouBot" :
  "FB-KagenouBot"
} bot…`);

const child = spawn("node", [script], {
  stdio: "inherit",
  env: process.env
});

child.on("close", code => {
  global.log.info(`[RUN] ${script} exited with code ${code}`);
});
