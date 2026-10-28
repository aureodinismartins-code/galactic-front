/* i18n.js is too big to patch in one request, so the strings this change
   needs are inserted here instead. Running it twice inserts nothing twice.

   Run: node tmp-test/ins-ministry-i18n.js */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "i18n.js");
let src = fs.readFileSync(FILE, "utf8");
const before = src;

function after(anchor, block) {
    const key = block.split("\n")[0].trim();
    if (src.includes(key)) { return; }
    const at = src.indexOf(anchor);
    if (at === -1) { throw new Error("anchor not found: " + anchor.slice(0, 60)); }
    const end = at + anchor.length;
    src = src.slice(0, end) + "\n" + block + src.slice(end);
}

after('        "Only the ministry\'s holder may act.": "Só o titular do ministério pode agir.",', [
    '        "STATE SECURITY": "SEGURANÇA DO ESTADO",',
    '        "GRAIN": "GRÃO",',
    '        "LABOUR": "TRABALHO",',
    '        "loyalty": "lealdade",',
    '        "stability": "estabilidade",'
].join("\n"));

after('        "That ministry has already acted this term.": "Esse ministério já agiu neste mandato.",', [
    '        "The ministries are held by the chamber, not named by hand: the party with the most seats gives each post to its most loyal delegate, and the holder acts on his own once a term, more boldly when he is loyal and his party is in favour and less when it is not. A party below 25 loyalty is not served at all.":',
    '            "Os ministérios pertencem à câmara e não são nomeados à mão: o partido com mais cadeiras entrega cada pasta ao seu delegado mais leal, e o titular age por sua conta uma vez por mandato — com mais força quando é leal e o seu partido está em favor, com menos quando não está. Um partido abaixo de 25 de lealdade não é servido de todo.",',
    '        "The commissariats are held by the plenum, not named by hand: the current with the most seats gives each post to its most loyal commissar, and the holder acts on his own once a term, harder when he is loyal and his current is in favour and less when it is not. A current below 25 loyalty is not served at all.":',
    '            "Os comissariados pertencem ao plenário e não são nomeados à mão: a corrente com mais cadeiras entrega cada pasta ao seu comissário mais leal, e o titular age por sua conta uma vez por mandato — com mais força quando é leal e a sua corrente está em favor, com menos quando não está. Uma corrente abaixo de 25 de lealdade não é servida de todo.",'
].join("\n"));

after('        "A world": "Um mundo",', [
    '        "Has not acted this term.": "Ainda não agiu neste mandato.",',
    '        "Authorised a fleet with no bill: build it from the galaxy map.":',
    '            "Autorizou uma frota sem proposta: constrói-a no mapa galáctico.",',
    '        "Took an extraordinary levy:": "Cobrou um imposto extraordinário:",',
    '        "and the people were told.": "e o povo foi avisado.",',
    '        "Sent relief to": "Enviou alívio para",',
    '        "Nothing: the holder\'s party is in disgrace and will not serve this term.":',
    '            "Nada: a bancada do titular está em desgraça e não serve neste mandato.",',
    '        "Nothing: the holder is too sullen to act this term.":',
    '            "Nada: o titular está demasiado ressentido para agir neste mandato.",',
    '        "Nothing to do: every world we administer is already settled.":',
    '            "Nada a fazer: todos os mundos que administramos já estão pacificados.",'
].join("\n"));

if (src === before) {
    console.log("nothing to insert: the strings are already there");
} else {
    fs.writeFileSync(FILE, src);
    console.log("inserted the ministry strings into i18n.js");
}
