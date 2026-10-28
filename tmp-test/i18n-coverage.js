/* Every string the pages ask the dictionary for, against every string the
   dictionary holds.

   A missing key is not a crash: T() hands back the English text. It is still
   a hole in the Portuguese game, and the only way to find them all is to ask.

   Run: node tmp-test/i18n-coverage.js            (report)
        node tmp-test/i18n-coverage.js --strict   (exit 1 when anything is missing) */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const strict = process.argv.includes("--strict");

/* both sides are source text, so an escape and the character it stands for are
   the same key to the browser — and must be the same key here */
function decode(s) {
    return s
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}

function keysUsedIn(text) {
    const out = new Set();
    const re = /\bT\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
    let m;
    while ((m = re.exec(text))) { out.add(decode(m[1])); }
    return out;
}

const i18n = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const known = new Set();

{
    const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:/gm;
    let m;
    while ((m = re.exec(i18n))) { known.add(decode(m[1])); }
}

const files = fs.readdirSync(ROOT).filter(f =>
    f.endsWith(".html") || (f.endsWith(".js") && f !== "i18n.js")
);

const missing = new Map();
const used = new Set();

for (const file of files) {

    const text = fs.readFileSync(path.join(ROOT, file), "utf8");

    for (const key of keysUsedIn(text)) {

        used.add(key);

        if (known.has(key)) { continue; }

        if (!missing.has(key)) { missing.set(key, new Set()); }
        missing.get(key).add(file);

    }

}

console.log("dictionary keys: " + known.size);
console.log("keys the pages ask for: " + used.size);
console.log("keys missing from the dictionary: " + missing.size);

if (missing.size) {

    console.log("");

    const rows = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [key, where] of rows.slice(0, 80)) {
        console.log("  MISSING  " + JSON.stringify(key) + "   (" + [...where].join(", ") + ")");
    }

    if (rows.length > 80) { console.log("  … and " + (rows.length - 80) + " more"); }

}

console.log("");

if (strict && missing.size) {
    console.log("strict: " + missing.size + " missing key(s)");
    process.exit(1);
}

console.log("ok");
