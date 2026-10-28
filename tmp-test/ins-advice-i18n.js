/* The committees tab answered every failure with "run 2026-11-15", which was
   wrong for the failure that actually happened: the party book had no loyalty
   column, and that is 2026-11-22. These are its two new sentences.

   Run: node tmp-test/ins-advice-i18n.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");

const ANCHOR = '        "STATE SECURITY": "SEGURANÇA DO ESTADO",';

const BLOCK = [
    '        "The party book is missing a column. Run sql/2026-11-22_the_party_book_has_a_loyalty.sql, then reload this page.":',
    '            "O livro dos partidos não tem uma coluna. Rode sql/2026-11-22_the_party_book_has_a_loyalty.sql e recarregue esta página.",',
    '        "A table or column this screen needs is missing. Run sql/2026-11-15_committees_and_ministers.sql, then sql/2026-11-20_the_ministries_belong_to_the_chamber.sql, then sql/2026-11-22_the_party_book_has_a_loyalty.sql.":',
    '            "Falta uma tabela ou coluna que este ecrã precisa. Rode sql/2026-11-15_committees_and_ministers.sql, depois sql/2026-11-20_the_ministries_belong_to_the_chamber.sql e depois sql/2026-11-22_the_party_book_has_a_loyalty.sql.",'
].join("\n");

if (src.includes('"The party book is missing a column.')) {
    console.log("nothing to insert: the advice is already translated");
} else {
    const at = src.indexOf(ANCHOR);
    if (at === -1) { throw new Error("anchor not found"); }
    const end = at + ANCHOR.length;
    src = src.slice(0, end) + "\n" + BLOCK + src.slice(end);
    fs.writeFileSync(FILE, src);
    console.log("inserted the patch advice into i18n.js");
}
