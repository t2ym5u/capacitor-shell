#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════╗
 * ║      Capacitor Shell — Assets            ║
 * ║  node assets.js [--config config.json]   ║
 * ╚══════════════════════════════════════════╝
 *
 * Downloads icon/splash declared in config and generates
 * all required native sizes (iOS + Android) via @capacitor/assets.
 *
 * Source image requirements:
 *   assets/icon.png   → 1024×1024 px, opaque background
 *   assets/splash.png → 2732×2732 px, subject centred with generous margins
 *
 * Available modes:
 *   node assets.js                          → config.json (default)
 *   node assets.js --config config.dev.json
 *   node assets.js --config config.prod.json
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ─── Terminal colours ─────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  warn: (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg) => console.log(`${c.red}✖${c.reset}  ${msg}`),
  step: (msg) => console.log(`\n${c.bold}${c.cyan}▶ ${msg}${c.reset}`),
  divider: () => console.log(`${c.gray}${"─".repeat(50)}${c.reset}`),
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function run(cmd, silent = false) {
  try {
    execSync(cmd, { stdio: silent ? "pipe" : "inherit" });
    return { ok: true };
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : "";
    const stdout = e.stdout ? e.stdout.toString().trim() : "";
    const detail = stderr || stdout || e.message || "unknown error";
    return { ok: false, error: detail };
  }
}

// ─── Config loading with inheritance (mirrors setup.js) ───────────────────────
function loadConfig(filePath, visited = new Set()) {
  const resolved = path.resolve(filePath);
  if (visited.has(resolved)) {
    log.error(`Circular inheritance detected: ${filePath}`);
    process.exit(1);
  }
  visited.add(resolved);

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    log.error(`Invalid JSON in ${filePath}: ${e.message}`);
    process.exit(1);
  }

  if (!cfg.extends) return cfg;

  const baseFile = path.resolve(path.dirname(resolved), cfg.extends);
  if (!fs.existsSync(baseFile)) {
    log.error(`Base file not found: ${c.bold}${baseFile}${c.reset} (referenced via "extends")`);
    process.exit(1);
  }
  log.info(`Inheriting from ${c.bold}${cfg.extends}${c.reset}`);
  const base = loadConfig(baseFile, visited);

  const merged = { ...base };
  for (const [key, value] of Object.entries(cfg)) {
    if (key === "extends") continue;
    if (Array.isArray(value) && Array.isArray(base[key])) {
      merged[key] = [...new Set([...base[key], ...value])];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

// ─── HTTP/HTTPS download with redirect following ───────────────────────────────
function downloadFile(url, dest, redirects = 0) {
  if (redirects > 5) {
    return Promise.reject(new Error("Too many redirects"));
  }

  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);

    mod
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(res.headers.location, dest, redirects + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", (err) => { fs.unlinkSync(dest); reject(err); });
      })
      .on("error", (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║   Capacitor Shell — Assets v1.0  ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════╝${c.reset}\n`);

  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--config");
  const configFile = configIndex !== -1 ? args[configIndex + 1] : "config.json";

  // ── Load config ───────────────────────────────────────────────────────────
  log.step("Loading configuration");
  log.divider();

  if (!fs.existsSync(configFile)) {
    log.error(`Config file not found: ${c.bold}${configFile}${c.reset}`);
    process.exit(1);
  }

  log.info(`Loading ${c.bold}${configFile}${c.reset}`);
  const cfg = loadConfig(configFile);

  if (!cfg.icon && !cfg.splash) {
    log.warn(`No "icon" or "splash" field found in ${configFile}`);
    log.info(`Add one or both fields with a URL:`);
    log.info(`  ${c.bold}"icon"${c.reset}   → 1024×1024 PNG, opaque background`);
    log.info(`  ${c.bold}"splash"${c.reset} → 2732×2732 PNG, subject centred`);
    process.exit(0);
  }

  if (cfg.icon && !/^https?:\/\/.+/.test(cfg.icon)) {
    log.error(`Invalid icon URL: ${c.bold}${cfg.icon}${c.reset}`);
    process.exit(1);
  }

  if (cfg.splash && !/^https?:\/\/.+/.test(cfg.splash)) {
    log.error(`Invalid splash URL: ${c.bold}${cfg.splash}${c.reset}`);
    process.exit(1);
  }

  if (cfg.icon)   log.success(`Icon URL   : ${c.bold}${cfg.icon}${c.reset}`);
  if (cfg.splash) log.success(`Splash URL : ${c.bold}${cfg.splash}${c.reset}`);

  // ── Ensure assets/ directory exists ──────────────────────────────────────
  const assetsDir = path.join(process.cwd(), "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
    log.success("assets/ directory created");
  }

  // ── Download icon ─────────────────────────────────────────────────────────
  if (cfg.icon) {
    log.step("Downloading icon");
    log.divider();

    const iconDest = path.join(assetsDir, "icon.png");
    log.info(`Downloading from ${c.bold}${cfg.icon}${c.reset} ...`);

    try {
      await downloadFile(cfg.icon, iconDest);
      log.success(`Icon saved to ${c.bold}assets/icon.png${c.reset}`);
    } catch (e) {
      log.error(`Download failed: ${e.message}`);
      process.exit(1);
    }
  }

  // ── Download splash ───────────────────────────────────────────────────────
  if (cfg.splash) {
    log.step("Downloading splash screen");
    log.divider();

    const splashDest = path.join(assetsDir, "splash.png");
    log.info(`Downloading from ${c.bold}${cfg.splash}${c.reset} ...`);

    try {
      await downloadFile(cfg.splash, splashDest);
      log.success(`Splash saved to ${c.bold}assets/splash.png${c.reset}`);
    } catch (e) {
      log.error(`Download failed: ${e.message}`);
      process.exit(1);
    }
  }

  // ── Ensure @capacitor/assets is installed ─────────────────────────────────
  log.step("Checking @capacitor/assets");
  log.divider();

  const capAssetsDir = path.join(process.cwd(), "node_modules", "@capacitor", "assets");
  if (!fs.existsSync(capAssetsDir)) {
    log.info("Installing @capacitor/assets ...");
    const result = run("pnpm add -D @capacitor/assets");
    if (!result.ok) {
      log.error("Failed to install @capacitor/assets");
      process.exit(1);
    }
    log.success("@capacitor/assets installed");
  } else {
    log.success("@capacitor/assets already installed");
  }

  // ── Generate native assets ────────────────────────────────────────────────
  log.step("Generating native assets");
  log.divider();

  const platforms = (cfg.platforms || ["android", "ios"]);
  const platformFlags = platforms.map((p) => `--${p}`).join(" ");

  log.info(`pnpm exec capacitor-assets generate ${platformFlags}`);
  const result = run(`pnpm exec capacitor-assets generate ${platformFlags}`);

  if (result.ok) {
    log.success("Native assets generated");
  } else {
    log.error(`Asset generation failed — run manually:`);
    log.error(`  pnpm exec capacitor-assets generate ${platformFlags}`);
    process.exit(1);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.green}╔══════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.green}║         Assets ready ✔            ║${c.reset}`);
  console.log(`${c.bold}${c.green}╚══════════════════════════════════╝${c.reset}\n`);

  console.log("Next steps:\n");
  console.log(`  ${c.cyan}pnpm exec cap sync${c.reset}   → apply assets to native projects`);
  platforms.forEach((p) => {
    console.log(`  ${c.cyan}pnpm exec cap open ${p}${c.reset}   → check the result in ${p === "android" ? "Android Studio" : "Xcode"}`);
  });
  console.log();
}

main().catch((err) => {
  log.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
