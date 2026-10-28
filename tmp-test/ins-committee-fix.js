/* The inserts of 2026-11-15 that do not fit in a single edit call: the
   dictionary block for the committees and ministers tab, the server-text
   rules for the new Portuguese log lines, and the new patch files in the
   country suite's list.

   It refuses rather than guesses: if an anchor is not found it says which
   one and changes nothing.

   Run: node tmp-test/ins-committee-fix.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function edit(file, pairs) {

    const full = path.join(ROOT, file);
    let s = fs.readFileSync(full, "utf8");

    for (let i = 0; i < pairs.length; i++) {

        const a = pairs[i][0];
        const b = pairs[i][1];

        if (s.indexOf(a) === -1) {
            console.log("MISSING in " + file + ": " + JSON.stringify(a.slice(0, 90)));
            process.exit(1);
        }

        s = s.replace(a, b);
    }

    fs.writeFileSync(full, s);
    console.log("patched " + file);
}

const dict = fs.readFileSync(path.join(__dirname, "ins-i18n-committee.txt"), "utf8").replace(/\s+$/, "");
const server = fs.readFileSync(path.join(__dirname, "ins-i18n-committee-server.txt"), "utf8").replace(/\s+$/, "");

edit("i18n.js", [
    ['            "A agitação cresce dois pontos por turno mais depressa enquanto nenhuma frota nossa estiver na órbita deste mundo.",',
        '            "A agitação cresce dois pontos por turno mais depressa enquanto nenhuma frota nossa estiver na órbita deste mundo.",\n' + dict],
    ['        [/^ADMINISTRAÇÃO: (.+) passa a administração civil\\.$/, "ADMINISTRATION: $1 is placed under civil rule."],',
        '        [/^ADMINISTRAÇÃO: (.+) passa a administração civil\\.$/, "ADMINISTRATION: $1 is placed under civil rule."],\n' + server]
]);

edit("tmp-test/command-and-country-test.js", [
    ['    "sql/2026-11-14_the_blockade_reaches_the_capital.sql"',
        '    "sql/2026-11-14_the_blockade_reaches_the_capital.sql",\n' +
        '    "sql/2026-11-15_committees_and_ministers.sql"']
]);
