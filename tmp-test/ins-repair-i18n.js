/* One-off: the two sentences the dock now says when it cannot work. */
const fs = require("fs");

const file = "i18n.js";
let s = fs.readFileSync(file, "utf8");

const marker = '        "DESKTOP MODE": "MODO COMPUTADOR",';

if (!s.includes(marker)) { throw new Error("marker not found in i18n.js"); }

const PAIRS = [
    ["You cannot repair here: this world is neutral or hostile. A dock needs a world your faction holds.",
        "Não podes reparar aqui: este mundo é neutro ou hostil. Uma doca precisa de um mundo que a tua facção controle."],
    ["A dock needs a world your faction holds: this fleet is not in orbit of one.",
        "Uma doca precisa de um mundo que a tua facção controle: esta frota não está em órbita de nenhum."]
];

const added = [];
const lines = [];

for (const [en, pt] of PAIRS) {
    if (s.includes(JSON.stringify(en) + ":")) { continue; }
    added.push(en);
    lines.push("        " + JSON.stringify(en) + ": " + JSON.stringify(pt) + ",");
}

if (!lines.length) {
    console.log("nothing to add");
    process.exit(0);
}

s = s.replace(marker, marker + "\n\n        /* ---------- the dock, when it cannot work (2026-11-18) ---------- */\n" + lines.join("\n"));
fs.writeFileSync(file, s);

console.log("added " + added.length + " keys");
