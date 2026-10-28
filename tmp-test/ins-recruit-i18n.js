/* One-off: the two sentences the recruiting office now says. */
const fs = require("fs");

const file = "i18n.js";
const s = fs.readFileSync(file, "utf8");

const PAIRS = [
    ["You cannot recruit here: this world is neutral or hostile. Recruits are raised on a world your faction holds.",
        "Não podes recrutar aqui: este mundo é neutro ou hostil. Os recrutas são formados num mundo que a tua facção controle."],
    ["Recruits are raised on a world your faction holds: this fleet is not in orbit of one.",
        "Os recrutas são formados num mundo que a tua facção controle: esta frota não está em órbita de nenhum."]
];

const missing = PAIRS.filter(([en]) => !s.includes(JSON.stringify(en) + ":"));

if (!missing.length) {
    console.log("nothing to add");
    process.exit(0);
}

/* the dock's own last sentence is the anchor: it is known to be in the file */
const lines = s.split("\n");
const at = lines.findIndex(l => l.includes("Uma doca precisa de um mundo"));

if (at === -1) { throw new Error("anchor line not found in i18n.js"); }

const block = [
    "",
    "        /* ---------- the recruiting office, when it cannot work (2026-11-18) ---------- */",
    ...missing.map(([en, pt]) => "        " + JSON.stringify(en) + ": " + JSON.stringify(pt) + ",")
];

lines.splice(at + 1, 0, ...block);
fs.writeFileSync(file, lines.join("\n"));

console.log("added " + missing.length + " keys");
