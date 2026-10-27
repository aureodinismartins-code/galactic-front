/* The three inserts of 2026-11-13 that do not fit in a single edit call:
   the dictionary block in i18n.js, the three server-text rules, and the two
   new patch files in the country suite's list.

   It refuses rather than guesses: if an anchor is not found it says which
   one and changes nothing.

   Run: node tmp-test/ins-policy-fix.js */

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

const dict = fs.readFileSync(path.join(__dirname, "ins-i18n-dict.txt"), "utf8").replace(/\s+$/, "");
const server = fs.readFileSync(path.join(__dirname, "ins-i18n-server.txt"), "utf8").replace(/\s+$/, "");

edit("i18n.js", [
    ['        "REVOLT": "REVOLTA",', '        "REVOLT": "REVOLTA",\n' + dict],
    ['        [/^O assalto a (.+) teve sucesso\\.$/, "The assault on $1 succeeded."],',
        server + '\n        [/^O assalto a (.+) teve sucesso\\.$/, "The assault on $1 succeeded."],']
]);

edit("tmp-test/command-and-country-test.js", [
    ['    "sql/2026-11-10_pacified_worlds_and_the_opening_quota.sql"',
        '    "sql/2026-11-10_pacified_worlds_and_the_opening_quota.sql",\n' +
        '    "sql/2026-11-13_the_occupation_has_a_policy.sql",\n' +
        '    "sql/2026-11-14_the_blockade_reaches_the_capital.sql"']
]);
