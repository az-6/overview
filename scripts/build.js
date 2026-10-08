const { mkdirSync, copyFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const out = join(root, "public");
mkdirSync(out, { recursive: true });
const assets = ["index.html", "hitung.js", "logo-putih.png"];
const unexpected = readdirSync(out).filter((name) => !assets.includes(name));
if (unexpected.length) throw new Error(`Hapus atau pindahkan file tak dikenal dari public/: ${unexpected.join(", ")}`);
for (const name of assets) {
  copyFileSync(join(root, name), join(out, name));
}
console.log("Static overview assets ready in public/");
