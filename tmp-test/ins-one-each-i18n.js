/* The two chambers' explanation changed: no holder takes two, and the leader
   names them. Inserted here because i18n.js is too big to patch in one
   request. Every inserted line ends with a comma.

   Run: node tmp-test/ins-one-each-i18n.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");

const ANCHOR = '        "STATE SECURITY": "SEGURANÇA DO ESTADO",';

const BLOCK = [
    '        "The ministries are the chamber\'s, and no delegate holds two: the party with the most seats fills them with its most loyal delegates, and the President may name each holder himself. Each holder acts on his own once a term, more boldly when he is loyal and his party is in favour and less when it is not. A party below 25 loyalty is not served at all.":',
    '            "Os ministérios são da câmara, e nenhum delegado fica com dois: o partido com mais cadeiras preenche-os com os seus delegados mais leais, e o Presidente pode nomear cada titular. Cada titular age por sua conta uma vez por mandato — com mais força quando é leal e o seu partido está em favor, com menos quando não está. Um partido abaixo de 25 de lealdade não é servido de todo.",',
    '        "The commissariats are the plenum\'s, and no commissar holds two: the current with the most seats fills them with its most loyal commissars, and the High Commissar may name each holder himself. Each holder acts on his own once a term, harder when he is loyal and his current is in favour and less when it is not. A current below 25 loyalty is not served at all.":',
    '            "Os comissariados são do plenário, e nenhum comissário fica com dois: a corrente com mais cadeiras preenche-os com os seus comissários mais leais, e o Alto Comissário pode nomear cada titular. Cada titular age por sua conta uma vez por mandato — com mais força quando é leal e a sua corrente está em favor, com menos quando não está. Uma corrente abaixo de 25 de lealdade não é servida de todo.",'
].join("\n");

if (src.includes('"The ministries are the chamber\'s, and no delegate holds two')) {
    console.log("nothing to insert: the explanations are already there");
} else {
    const at = src.indexOf(ANCHOR);
    if (at === -1) { throw new Error("anchor not found"); }
    const end = at + ANCHOR.length;
    src = src.slice(0, end) + "\n" + BLOCK + src.slice(end);
    fs.writeFileSync(FILE, src);
    console.log("inserted the ministry explanations into i18n.js");
}
