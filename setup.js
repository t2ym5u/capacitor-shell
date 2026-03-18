#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════╗
 * ║        Capacitor Shell — Setup           ║
 * ║  node setup.js [--config config.json]    ║
 * ╚══════════════════════════════════════════╝
 *
 * Available modes:
 *   node setup.js                          → config.json (default)
 *   node setup.js --config config.dev.json
 *   node setup.js --config config.prod.json
 *   node setup.js --interactive            → guided question/answer setup
 *   node setup.js --reset                  → delete android/ and ios/ to start fresh
 *   node setup.js --check                  → audit project state without modifying anything
 *   node setup.js --check --config config.prod.json
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

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

// ─── Available plugins (source: plugins.json) ────────────────────────────────
const PLUGINS_FILE = path.join(__dirname, "plugins.json");
if (!fs.existsSync(PLUGINS_FILE)) {
  console.error(`\x1b[31m✖\x1b[0m  plugins.json not found — this file is required`);
  process.exit(1);
}
const AVAILABLE_PLUGINS = JSON.parse(fs.readFileSync(PLUGINS_FILE, "utf-8"));

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

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ─── Config loading with inheritance (extends) ────────────────────────────────
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

// ─── Prerequisites check ──────────────────────────────────────────────────────
function checkPrerequisites() {
  log.step("Checking prerequisites");
  log.divider();

  const checks = [
    {
      cmd: "node --version",
      label: "Node.js",
      minVersion: 18,
      extract: (out) => parseInt(out.replace("v", "").split(".")[0]),
    },
    { cmd: "pnpm --version", label: "pnpm", minVersion: null, extract: null },
  ];

  let allOk = true;

  for (const check of checks) {
    const result = run(check.cmd, true);
    if (!result.ok) {
      log.error(`${check.label} not found — install it before continuing`);
      allOk = false;
      continue;
    }

    if (check.minVersion && check.extract) {
      const out = execSync(check.cmd, { encoding: "utf-8" }).trim();
      const version = check.extract(out);
      if (version < check.minVersion) {
        log.error(
          `${check.label} version ${out} is too old — version ≥ ${check.minVersion} required`,
        );
        allOk = false;
        continue;
      }
    }

    log.success(`${check.label} available`);
  }

  if (!allOk) {
    console.log();
    process.exit(1);
  }
}

// ─── Config validation ────────────────────────────────────────────────────────
function validateConfig(cfg) {
  const errors = [];

  if (!cfg.appId)
    errors.push('appId missing (e.g. "com.mycompany.myapp")');
  else if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,}$/.test(cfg.appId))
    errors.push(
      `invalid appId "${cfg.appId}" — expected format: com.company.app`,
    );

  if (!cfg.appName || cfg.appName.trim() === "")
    errors.push('appName missing (e.g. "My Application")');

  if (!cfg.url)
    errors.push('url missing (e.g. "https://my-site.com")');
  else if (!/^https?:\/\/.+/.test(cfg.url))
    errors.push(
      `invalid url "${cfg.url}" — must start with http:// or https://`,
    );

  if (cfg.icon && !/^https?:\/\/.+/.test(cfg.icon))
    errors.push(
      `invalid icon URL "${cfg.icon}" — must start with http:// or https://`,
    );

  if (cfg.splash && !/^https?:\/\/.+/.test(cfg.splash))
    errors.push(
      `invalid splash URL "${cfg.splash}" — must start with http:// or https://`,
    );

  if (cfg.backgroundColor && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(cfg.backgroundColor))
    errors.push(
      `invalid backgroundColor "${cfg.backgroundColor}" — expected hex format: #rrggbb or #rrggbbaa`,
    );

  if (!cfg.platforms || cfg.platforms.length === 0)
    errors.push('platforms is empty — add "android" and/or "ios"');
  else {
    cfg.platforms.forEach((p) => {
      if (!["android", "ios"].includes(p))
        errors.push(
          `unknown platform "${p}" — accepted values: android, ios`,
        );
    });
  }

  if (cfg.plugins) {
    cfg.plugins.forEach((p) => {
      if (!AVAILABLE_PLUGINS[p])
        errors.push(`unknown plugin "${p}" — see the list in PLUGINS.MD`);
    });
  }

  return errors;
}

// ─── capacitor.config.ts generation ──────────────────────────────────────────
function generateCapacitorConfig(cfg) {
  const pluginBlocks = (cfg.plugins || [])
    .map((key) => {
      const plugin = AVAILABLE_PLUGINS[key];
      switch (key) {
        case "push-notifications":
          return `\n    PushNotifications: {\n      presentationOptions: ['badge', 'sound', 'alert'],\n    },`;
        case "splash-screen":
          return `\n    SplashScreen: {\n      launchShowDuration: 2000,\n      backgroundColor: '${cfg.backgroundColor || '#ffffff'}',\n      showSpinner: false,\n    },`;
        case "status-bar":
          return `\n    StatusBar: {\n      style: 'dark',\n      backgroundColor: '${cfg.backgroundColor || '#ffffff'}',\n    },`;
        case "keyboard":
          return `\n    Keyboard: {\n      resize: 'body',\n      style: 'dark',\n      resizeOnFullScreen: true,\n    },`;
        case "geolocation":
          return `\n    Geolocation: {\n      permissions: ['location'],\n    },`;
        case "camera":
          return `\n    Camera: {\n      permissions: ['camera', 'photos'],\n    },`;
        case "local-notifications":
          return `\n    LocalNotifications: {\n      smallIcon: 'ic_stat_icon',\n      iconColor: '#0066CC',\n    },`;
        default:
          return `\n    // ${plugin.label} — no configuration required`;
      }
    })
    .join("");

  return `import { CapacitorConfig } from '@capacitor/cli';

// Auto-generated by setup.js on ${new Date().toLocaleString("en-GB")}
// To regenerate: node setup.js --config <file>

const config: CapacitorConfig = {
  appId: '${cfg.appId}',
  appName: '${cfg.appName}',
  webDir: 'www',

  server: {
    url: '${cfg.url}',
    cleartext: ${cfg.url.startsWith("http://") ? "true" : "false"},
    androidScheme: 'https',
  },

  plugins: {${pluginBlocks}
  },
};

export default config;
`;
}

// ─── Check mode ───────────────────────────────────────────────────────────────
function checkMode(configFile) {
  let issues = 0;

  // ── Prerequisites ─────────────────────────────────────────────────────────
  log.step("Prerequisites");
  log.divider();

  const prereqs = [
    { cmd: "node --version", label: "Node.js", minVersion: 18, extract: (o) => parseInt(o.replace("v", "").split(".")[0]) },
    { cmd: "pnpm --version", label: "pnpm", minVersion: null, extract: null },
  ];

  for (const p of prereqs) {
    const result = run(p.cmd, true);
    if (!result.ok) {
      log.error(`${p.label} not found`);
      issues++;
    } else if (p.minVersion && p.extract) {
      const out = execSync(p.cmd, { encoding: "utf-8" }).trim();
      if (p.extract(out) < p.minVersion) {
        log.error(`${p.label} ${out} is too old — version ≥ ${p.minVersion} required`);
        issues++;
      } else {
        log.success(`${p.label} ${out}`);
      }
    } else {
      const out = execSync(p.cmd, { encoding: "utf-8" }).trim();
      log.success(`${p.label} ${out}`);
    }
  }

  // ── Config file ───────────────────────────────────────────────────────────
  log.step(`Config file (${configFile})`);
  log.divider();

  if (!fs.existsSync(configFile)) {
    log.error(`${configFile} not found`);
    issues++;
    console.log(`\n${c.red}${c.bold}✖ ${issues} issue(s) found${c.reset}\n`);
    return issues;
  }

  let cfg;
  try {
    cfg = loadConfig(configFile);
    log.success(`${configFile} loaded`);
  } catch (e) {
    log.error(`Invalid JSON in ${configFile}: ${e.message}`);
    issues++;
    return issues;
  }

  const cfgErrors = validateConfig(cfg);
  if (cfgErrors.length > 0) {
    cfgErrors.forEach((e) => { log.error(e); issues++; });
  } else {
    log.success(`appId           : ${cfg.appId}`);
    log.success(`appName         : ${cfg.appName}`);
    log.success(`url             : ${cfg.url}`);
    log.success(`backgroundColor : ${cfg.backgroundColor || "#ffffff (default)"}`);
    log.success(`platforms       : ${cfg.platforms.join(", ")}`);
    log.success(`plugins         : ${cfg.plugins && cfg.plugins.length ? cfg.plugins.join(", ") : "none"}`);
  }

  // ── capacitor.config.ts ───────────────────────────────────────────────────
  log.step("capacitor.config.ts");
  log.divider();

  if (!fs.existsSync("capacitor.config.ts")) {
    log.warn("capacitor.config.ts missing — run node setup.js to generate it");
    issues++;
  } else {
    const content = fs.readFileSync("capacitor.config.ts", "utf-8");
    let ok = true;
    if (cfg && cfg.appId && !content.includes(cfg.appId)) {
      log.warn(`appId "${cfg.appId}" not found in capacitor.config.ts — regenerate with node setup.js`);
      issues++; ok = false;
    }
    if (cfg && cfg.url && !content.includes(cfg.url)) {
      log.warn(`url "${cfg.url}" not found in capacitor.config.ts — regenerate with node setup.js`);
      issues++; ok = false;
    }
    if (ok) log.success("capacitor.config.ts present and consistent with config");
  }

  // ── www/index.html ────────────────────────────────────────────────────────
  log.step("www/index.html");
  log.divider();

  if (!fs.existsSync(path.join("www", "index.html"))) {
    log.error("www/index.html missing — required by Capacitor");
    issues++;
  } else {
    log.success("www/index.html present");
  }

  // ── Platform directories ──────────────────────────────────────────────────
  if (cfg && cfg.platforms) {
    log.step("Native platforms");
    log.divider();

    for (const platform of cfg.platforms) {
      if (fs.existsSync(path.join(process.cwd(), platform))) {
        log.success(`${platform}/ present`);
        if (platform === "ios" && process.platform !== "darwin") {
          log.warn("iOS found but you are not on macOS — Xcode is required to build");
        }
      } else {
        log.warn(`${platform}/ missing — run node setup.js to add it`);
        issues++;
      }
    }
  }

  // ── Installed plugins ─────────────────────────────────────────────────────
  if (cfg && cfg.plugins && cfg.plugins.length > 0) {
    log.step("Plugins");
    log.divider();

    for (const key of cfg.plugins) {
      const plugin = AVAILABLE_PLUGINS[key];
      if (!plugin) continue;
      const pluginDir = path.join("node_modules", plugin.pkg);
      if (fs.existsSync(pluginDir)) {
        log.success(`${plugin.pkg} installed`);
      } else {
        log.error(`${plugin.pkg} missing from node_modules — run node setup.js`);
        issues++;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  if (issues === 0) {
    console.log(`${c.green}${c.bold}✔ Everything looks good — no issues detected${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bold}✖ ${issues} issue(s) found — see warnings above${c.reset}\n`);
  }

  return issues;
}

// ─── Reset mode ───────────────────────────────────────────────────────────────
async function resetMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const dirs = ["android", "ios"].filter((d) =>
    fs.existsSync(path.join(process.cwd(), d)),
  );

  if (dirs.length === 0) {
    log.warn("No android/ or ios/ directory found — nothing to delete");
    rl.close();
    return;
  }

  console.log(`\n${c.yellow}The following directories will be deleted:${c.reset}`);
  dirs.forEach((d) => console.log(`  ${c.bold}${d}/${c.reset}`));

  const answer = await ask(
    rl,
    `\n${c.red}Confirm deletion? ${c.gray}(yes/no)${c.reset}: `,
  );
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    log.warn("Reset cancelled");
    return;
  }

  for (const dir of dirs) {
    fs.rmSync(path.join(process.cwd(), dir), { recursive: true, force: true });
    log.success(`${dir}/ deleted`);
  }

  log.info("Run node setup.js to reconfigure the project");
}

// ─── Interactive mode ─────────────────────────────────────────────────────────
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const cfg = {};

  console.log(`\n${c.bold}${c.cyan}Interactive configuration${c.reset}\n`);

  // appId with loop validation
  while (true) {
    cfg.appId = (
      await ask(
        rl,
        `${c.cyan}?${c.reset} App ID ${c.gray}(e.g. com.company.app)${c.reset}: `,
      )
    ).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,}$/.test(cfg.appId)) {
      log.error(`Invalid format — expected: com.company.app`);
    } else {
      break;
    }
  }

  // appName with loop validation
  while (true) {
    cfg.appName = (
      await ask(rl, `${c.cyan}?${c.reset} App name: `)
    ).trim();
    if (!cfg.appName) {
      log.error("App name cannot be empty");
    } else {
      break;
    }
  }

  // URL with loop validation
  while (true) {
    cfg.url = (
      await ask(rl, `${c.cyan}?${c.reset} Website URL: `)
    ).trim();
    if (!/^https?:\/\/.+/.test(cfg.url)) {
      log.error("Invalid URL — must start with http:// or https://");
    } else {
      break;
    }
  }

  // Platforms with loop validation
  while (true) {
    const platformsInput = await ask(
      rl,
      `${c.cyan}?${c.reset} Platforms ${c.gray}(android, ios, or both comma-separated)${c.reset}: `,
    );
    cfg.platforms = platformsInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const invalid = cfg.platforms.filter(
      (p) => !["android", "ios"].includes(p),
    );
    if (cfg.platforms.length === 0) {
      log.error('At least one platform required: "android" and/or "ios"');
    } else if (invalid.length > 0) {
      log.error(`Unknown platform(s): ${invalid.join(", ")}`);
    } else {
      break;
    }
  }

  console.log(`\n${c.cyan}Available plugins:${c.reset}`);
  Object.entries(AVAILABLE_PLUGINS).forEach(([key, val], i) => {
    console.log(
      `  ${c.gray}${String(i + 1).padStart(2)}.${c.reset} ${key.padEnd(22)} ${c.gray}${val.label}${c.reset}`,
    );
  });

  const pluginsInput = await ask(
    rl,
    `\n${c.cyan}?${c.reset} Plugins to enable ${c.gray}(comma-separated numbers, or leave blank)${c.reset}: `,
  );
  const keys = Object.keys(AVAILABLE_PLUGINS);
  cfg.plugins = pluginsInput
    ? pluginsInput
        .split(",")
        .map((n) => keys[parseInt(n.trim()) - 1])
        .filter(Boolean)
    : [];

  const saveConfig = await ask(
    rl,
    `${c.cyan}?${c.reset} Save this config to a JSON file? ${c.gray}(filename or leave blank)${c.reset}: `,
  );
  if (saveConfig.trim()) {
    const filename = saveConfig.trim().endsWith(".json")
      ? saveConfig.trim()
      : `${saveConfig.trim()}.json`;
    fs.writeFileSync(filename, JSON.stringify(cfg, null, 2));
    log.success(`Config saved to ${filename}`);
  }

  rl.close();
  return cfg;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n${c.bold}${c.cyan}╔══════════════════════════════════╗${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}║   Capacitor Shell — Setup v1.2   ║${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}╚══════════════════════════════════╝${c.reset}\n`,
  );

  const args = process.argv.slice(2);
  const isInteractive = args.includes("--interactive");
  const isReset = args.includes("--reset");
  const isCheck = args.includes("--check");
  const configIndex = args.indexOf("--config");
  const configFile = configIndex !== -1 ? args[configIndex + 1] : "config.json";

  // ── Check mode ────────────────────────────────────────────────────────────
  if (isCheck) {
    const issues = checkMode(configFile);
    process.exit(issues > 0 ? 1 : 0);
  }

  // ── Reset mode ────────────────────────────────────────────────────────────
  if (isReset) {
    await resetMode();
    return;
  }

  // ── Prerequisites ─────────────────────────────────────────────────────────
  checkPrerequisites();

  // ── Load config ───────────────────────────────────────────────────────────
  let cfg;

  if (isInteractive) {
    cfg = await interactiveMode();
  } else {
    if (!fs.existsSync(configFile)) {
      log.error(`Config file not found: ${c.bold}${configFile}${c.reset}`);
      log.info(`Create a ${c.bold}config.json${c.reset} file or use:`);
      console.log(`  node setup.js --config config.dev.json`);
      console.log(`  node setup.js --interactive\n`);
      process.exit(1);
    }

    log.info(`Loading ${c.bold}${configFile}${c.reset}`);
    cfg = loadConfig(configFile);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  log.step("Validating configuration");
  log.divider();

  const errors = validateConfig(cfg);
  if (errors.length > 0) {
    errors.forEach((e) => log.error(e));
    console.log();
    process.exit(1);
  }

  log.success(`App ID      : ${c.bold}${cfg.appId}${c.reset}`);
  log.success(`Name        : ${c.bold}${cfg.appName}${c.reset}`);
  log.success(`URL         : ${c.bold}${cfg.url}${c.reset}`);
  log.success(`Background  : ${c.bold}${cfg.backgroundColor || "#ffffff (default)"}${c.reset}`);
  log.success(`Platforms   : ${c.bold}${cfg.platforms.join(", ")}${c.reset}`);

  if (cfg.plugins && cfg.plugins.length > 0) {
    log.success(`Plugins     : ${c.bold}${cfg.plugins.join(", ")}${c.reset}`);
  } else {
    log.warn(`No native plugins selected`);
  }

  // ── Generate capacitor.config.ts ──────────────────────────────────────────
  log.step("Generating capacitor.config.ts");
  log.divider();

  const configContent = generateCapacitorConfig(cfg);
  fs.writeFileSync("capacitor.config.ts", configContent);
  log.success("capacitor.config.ts generated");

  // ── Install base Capacitor dependencies ───────────────────────────────────
  log.step("Installing Capacitor dependencies");
  log.divider();

  log.info("pnpm add @capacitor/core @capacitor/cli ...");
  const baseInstall = run("pnpm add @capacitor/core @capacitor/cli");
  if (baseInstall.ok) log.success("Base dependencies installed");
  else {
    log.error(`pnpm add failed: ${baseInstall.error}`);
    process.exit(1);
  }

  // ── Install plugins ───────────────────────────────────────────────────────
  const failedPlugins = [];

  if (cfg.plugins && cfg.plugins.length > 0) {
    log.step(`Installing plugins (${cfg.plugins.length})`);
    log.divider();

    for (const key of cfg.plugins) {
      const plugin = AVAILABLE_PLUGINS[key];
      log.info(`Installing ${c.bold}${plugin.pkg}${c.reset} ...`);
      const result = run(`pnpm add ${plugin.pkg}`);
      if (result.ok) log.success(`${plugin.label} installed`);
      else {
        failedPlugins.push(plugin.pkg);
        log.warn(`Failed for ${plugin.pkg}\n  ${c.gray}${result.error}${c.reset}`);
      }
    }
  }

  // ── Add platforms ─────────────────────────────────────────────────────────
  log.step("Configuring native platforms");
  log.divider();

  for (const platform of cfg.platforms) {
    if (platform === "ios" && process.platform !== "darwin") {
      log.warn(`iOS skipped — Xcode is only available on macOS`);
      continue;
    }
    const platformDir = path.join(process.cwd(), platform);
    if (fs.existsSync(platformDir)) {
      log.warn(
        `Directory ${c.bold}${platform}/${c.reset} already exists — skipping pnpm exec cap add`,
      );
    } else {
      log.info(`Adding platform ${c.bold}${platform}${c.reset} ...`);
      const result = run(`pnpm exec cap add ${platform}`);
      if (result.ok) log.success(`${platform} added`);
      else
        log.warn(
          `Failed for ${platform} — run manually: pnpm exec cap add ${platform}\n  ${c.gray}${result.error}${c.reset}`,
        );
    }
  }

  // ── Sync ──────────────────────────────────────────────────────────────────
  log.step("Capacitor sync");
  log.divider();

  log.info("pnpm exec cap sync ...");
  const syncResult = run("pnpm exec cap sync");
  if (syncResult.ok) log.success("Sync complete");
  else
    log.warn(
      `Sync failed — run manually: pnpm exec cap sync\n  ${c.gray}${syncResult.error}${c.reset}`,
    );

  // ── Post-setup validation ─────────────────────────────────────────────────
  log.step("Post-setup validation");
  log.divider();

  let postIssues = 0;

  for (const platform of cfg.platforms) {
    if (platform === "ios" && process.platform !== "darwin") continue;
    if (fs.existsSync(path.join(process.cwd(), platform))) {
      log.success(`${platform}/ present`);
    } else {
      log.warn(`${platform}/ missing — run: pnpm exec cap add ${platform}`);
      postIssues++;
    }
  }

  if (failedPlugins.length > 0) {
    log.warn(`${failedPlugins.length} plugin(s) failed to install — fix manually:`);
    failedPlugins.forEach((pkg) => log.warn(`  pnpm add ${pkg}`));
    postIssues += failedPlugins.length;
  }

  if (postIssues === 0) log.success("All dependencies are in place");

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log(
    `\n${c.bold}${c.green}╔══════════════════════════════════╗${c.reset}`,
  );
  console.log(
    `${c.bold}${c.green}║         Setup complete ✔          ║${c.reset}`,
  );
  console.log(
    `${c.bold}${c.green}╚══════════════════════════════════╝${c.reset}\n`,
  );

  console.log("Next steps:\n");
  cfg.platforms.forEach((p) => {
    if (p === "ios" && process.platform !== "darwin") return;
    console.log(
      `  ${c.cyan}pnpm exec cap open ${p}${c.reset}   → open in ${p === "android" ? "Android Studio" : "Xcode"}`,
    );
  });
  console.log(
    `  ${c.cyan}pnpm exec cap sync${c.reset}          → re-sync after any change`,
  );
  console.log(
    `  ${c.cyan}node setup.js --reset${c.reset} → start fresh (deletes android/ and ios/)\n`,
  );
}

main().catch((err) => {
  log.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
