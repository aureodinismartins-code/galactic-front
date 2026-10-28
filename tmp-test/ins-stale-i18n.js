/* One-off: the sentence the tab now says when the database still has the older
   committee functions. */
const fs = require("fs");

const file = "i18n.js";
const s = fs.readFileSync(file, "utf8");

const EN = "This database still has an earlier version of the committee functions. Run sql/2026-11-15_committees_and_ministers.sql again: it replaces them.";
const PT = "Esta base de dados ainda tem a versão anterior das funções das comissões. Rode sql/2026-11-15_committees_and_ministers.sql outra vez: ele substitui-as.";

if (s.includes(JSON.stringify(EN) + ":")) {
    console.log("nothing to add");
    process.exit(0);
}

const lines = s.split("\n");
const at = lines.findIndex(l => l.includes("Os recrutas são formados num mundo"));

if (at === -1) { throw new Error("anchor line not found in i18n.js"); }

lines.splice(at + 1, 0,
    "",
    "        /* ---------- a half-applied committee patch (2026-11-19) ---------- */",
    "        " + JSON.stringify(EN) + ": " + JSON.stringify(PT) + ","
);

fs.writeFileSync(file, lines.join("\n"));
console.log("added 1 key");
