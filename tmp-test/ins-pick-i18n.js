/* the picker's two strings, inserted the same way the ministry strings were:
   i18n.js is too big to patch in a single request.

   Run: node tmp-test/ins-pick-i18n.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");

const ANCHOR = '        "loyalty": "lealdade",';

const BLOCK = [
    '        "— THE CHAMBER\'S CHOICE —": "— A ESCOLHA DA CÂMARA —",',
    '        "THE MINISTRY": "O MINISTÉRIO",'
].join("\n");

if (src.includes('"— THE CHAMBER\'S CHOICE —"')) {
    console.log("nothing to insert: the strings are already there");
} else {
    const at = src.indexOf(ANCHOR);
    if (at === -1) { throw new Error("anchor not found"); }
    const end = at + ANCHOR.length;
    src = src.slice(0, end) + "\n" + BLOCK + src.slice(end);
    fs.writeFileSync(FILE, src);
    console.log("inserted the picker strings into i18n.js");
}
