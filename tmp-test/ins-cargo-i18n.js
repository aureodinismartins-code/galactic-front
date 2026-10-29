/* One-off: the sentences the recruiting office says for a cargo fleet. */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");

const ANCHOR = '        "You cannot recruit here: this world is neutral or hostile. Recruits are raised on a world your faction holds.": "Não podes recrutar aqui: este mundo é neutro ou hostil. Os recrutas são formados num mundo que a tua facção controle.",';

const ADD = [
    "",
    "        /* ---------- the cargo fleets (2026-11-30 / 2026-11-31) ---------- */",
    '        "You cannot recruit here: this is a cargo fleet. A slaving fleet carries Tusken, not soldiers.": "Não podes recrutar aqui: esta é uma frota de carga. Uma frota de escravos transporta Tusken, não soldados.",',
    '        "CARGO FLEET — IT CARRIES TUSKEN, NOT SOLDIERS": "FROTA DE CARGA — TRANSPORTA TUSKEN, NÃO SOLDADOS",'
].join("\n");

let text = fs.readFileSync(FILE, "utf8");

if (text.indexOf("CARGO FLEET — IT CARRIES TUSKEN, NOT SOLDIERS") !== -1) {
    console.log("already inserted");
    process.exit(0);
}

if (text.indexOf(ANCHOR) === -1) {
    console.error("anchor missing");
    process.exit(1);
}

text = text.replace(ANCHOR, ANCHOR + "\n" + ADD);

fs.writeFileSync(FILE, text);

console.log("inserted 2 entries");
