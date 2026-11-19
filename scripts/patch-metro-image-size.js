// Metro SDK 54 passes image file paths to image-size. image-size 2 expects bytes.
// Convert Metro's input to a Buffer while preserving its ZIP asset path handling.
const fs = require("node:fs");
const path = require("node:path");

const metroAssets = path.join(__dirname, "..", "node_modules", "metro", "src", "Assets.js");
if (!fs.existsSync(metroAssets)) {
  throw new Error("Metro Assets.js was not found; cannot apply the image-size compatibility patch.");
}

const source = fs.readFileSync(metroAssets, "utf8");
const original = `const isImageInput = assetInfo.files[0].includes(".zip/")
    ? _fs.default.readFileSync(assetInfo.files[0])
    : assetInfo.files[0];`;
const patched = "const isImageInput = _fs.default.readFileSync(assetInfo.files[0]);";

if (source.includes(patched)) {
  process.exit(0);
}
if (!source.includes(original)) {
  throw new Error("Unexpected Metro Assets.js source; review the image-size compatibility patch before updating Metro.");
}
fs.writeFileSync(metroAssets, source.replace(original, patched), "utf8");
