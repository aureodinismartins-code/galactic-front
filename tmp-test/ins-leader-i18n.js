/* The two sentences that say who may name a holder. i18n.js is too big to
   patch in one request, so it is inserted here. Every line ends with a comma.

   Run: node tmp-test/ins-leader-i18n.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");

const ANCHOR = '        "STATE SECURITY": "SEGURANÇA DO ESTADO",';

const BLOCK = [
    '        "The President of the Freedom Authority names the ministers. While the office is empty, any Freedom Authority player may.":',
    '            "O Presidente da Freedom Authority nomeia os ministros. Enquanto o cargo estiver vago, qualquer jogador da Freedom Authority pode fazê-lo.",',
    '        "The High Commissar of the Combine names the commissars. While the office is empty, any Combine player may.":',
    '            "O Alto Comissário do Combine nomeia os comissários. Enquanto o cargo estiver vago, qualquer jogador do Combine pode fazê-lo.",'
].join("\n");

if (src.includes('"The President of the Freedom Authority names the ministers.')) {
    console.log("nothing to insert: the sentences are already there");
} else {
    const at = src.indexOf(ANCHOR);
    if (at === -1) { throw new Error("anchor not found"); }
    const end = at + ANCHOR.length;
    src = src.slice(0, end) + "\n" + BLOCK + src.slice(end);
    fs.writeFileSync(FILE, src);
    console.log("inserted the leader sentences into i18n.js");
}
