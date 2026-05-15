/**
 * After git checkout/branch switches, node_modules can be incomplete while
 * package.json still lists deps. Install only when critical packages are missing.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const mustHave = ["react-native-svg"];

const missing = mustHave.filter(
  (pkg) => !fs.existsSync(path.join(root, "node_modules", pkg))
);

if (missing.length) {
  console.log(`[mobile] Missing: ${missing.join(", ")} — running npm install…`);
  execSync("npm install --no-audit --no-fund", { stdio: "inherit", cwd: root });
}
