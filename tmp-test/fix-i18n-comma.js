/* The advice block was inserted without a trailing comma, so the next entry
   became an orphan string and i18n.js stopped parsing. Put the comma back.

   Run: node tmp-test/fix-i18n-comma.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");
const before = src;

src = src.replace(
    /(e depois sql\/2026-11-22_the_party_book_has_a_loyalty\.sql\.)"\n(\s+"GRAIN")/,
    "$1\",\n$2"
);

if (src === before) {
    console.log("nothing to fix: the comma is already there");
} else {
    fs.writeFileSync(FILE, src);
    console.log("comma restored");
}
