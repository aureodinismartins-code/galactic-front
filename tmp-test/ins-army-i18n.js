/* one-off: add the army's dictionary block to i18n.js in place */
const fs = require("fs");

const file = "i18n.js";
let s = fs.readFileSync(file, "utf8");

if (s.includes('"REPAIR THE WHOLE ARMY"')) {
    console.log("already present");
    process.exit(0);
}

const marker = '"A agitação cresce num mundo tomado à força. Ela consome a estabilidade do mundo e, aos cem, o mundo levanta-se e expulsa a ocupação.",';

if (!s.includes(marker)) {
    throw new Error("marker not found in i18n.js");
}

const block = marker + `

        /* ---------- the army (2026-11-16) ---------- */
        "THE ARMY": "O EXÉRCITO",
        "REPAIR THE WHOLE ARMY": "REPARAR O EXÉRCITO INTEIRO",
        "under strength": "abaixo do efectivo",
        "Every fleet of yours that is in orbit goes to the dock at once: the treasury pays for all of it, or nothing is repaired.":
            "Cada frota tua que esteja em órbita vai de uma vez para a doca: o tesouro paga por todas, ou não se repara nenhuma.",`;

s = s.replace(marker, block);
fs.writeFileSync(file, s);
console.log("inserted");
