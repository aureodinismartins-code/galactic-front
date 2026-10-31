/* No SQL function may name a record variable the same as a table alias.

   PostgreSQL reads "m.loyalty" in a query as a field of the plpgsql record
   called m rather than as the table aliased m, and a record that has not been
   assigned yet answers:

       record "m" is not assigned yet

   That is what killed every propaganda campaign: congress_propaganda() walked
   its delegates in a record called m while three statements above aliased
   cg_members as m. 2026-11-52 renamed the variable; this file keeps it
   renamed, in that function and in every function written after it.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/sql-alias-clash-test.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SQL_DIR = path.join(ROOT, "sql");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

/* comments carry prose like "as m" and "record;" that is not code */
function withoutComments(body) {
    return body.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const DECLARATION = /^\s+([A-Za-z_]\w*)\s+record\b/gm;
const ALIAS = /\b(?:from|update|into|join|delete\s+from)\s+[A-Za-z_][\w."]*\s+as\s+([A-Za-z_]\w*)/gi;

/* every function in one file, with the record variables it clashes on */
function clashesIn(text) {

    const found = [];
    const opener = /create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(/gi;
    let head;

    while ((head = opener.exec(text)) !== null) {

        const start = head.index;
        const close = text.indexOf("$function$;", start);
        const body = withoutComments(text.slice(start, close === -1 ? text.length : close));

        const records = new Set();
        let decl;
        DECLARATION.lastIndex = 0;
        while ((decl = DECLARATION.exec(body)) !== null) { records.add(decl[1]); }

        if (!records.size) { continue; }

        const aliases = new Set();
        let alias;
        ALIAS.lastIndex = 0;
        while ((alias = ALIAS.exec(body)) !== null) { aliases.add(alias[1]); }

        records.forEach(function (variable) {
            if (aliases.has(variable)) {
                found.push({ fn: head[1], variable: variable });
            }
        });

    }

    return found;

}

console.log("\n== the checker itself");

const BROKEN = `
create or replace function public.sample() returns void language plpgsql as $function$
declare
    m record;
begin
    update public.cg_members as m set loyalty = 100;
end;
$function$;
`;

const CLEAN = `
create or replace function public.sample() returns void language plpgsql as $function$
declare
    v_member record;
begin
    -- the old shape was "update public.cg_members as m", which is what broke
    update public.cg_members as x set loyalty = 100 where x.id = v_member.id;
end;
$function$;
`;

ok("a record variable that is also a table alias is caught",
    clashesIn(BROKEN).length === 1 && clashesIn(BROKEN)[0].variable === "m", clashesIn(BROKEN));
ok("the renamed shape passes", clashesIn(CLEAN).length === 0, clashesIn(CLEAN));

console.log("\n== the whole of sql/");

/*
   A patch that has already been run is never edited in this repository, so the
   old, broken congress_propaganda() stays in 2026-10-27 for ever. What decides
   the database is the LAST definition of a function, in patch order: that is
   the one that gets checked, and the superseded ones are only counted.
*/
const files = fs.readdirSync(SQL_DIR).filter(function (f) { return f.endsWith(".sql"); }).sort();
const live = new Map();      /* function name -> its last definition */
let functionsSeen = 0;

files.forEach(function (file) {

    const text = fs.readFileSync(path.join(SQL_DIR, file), "utf8");

    functionsSeen += (text.match(/create\s+or\s+replace\s+function\s+public\./gi) || []).length;

    clashesIn(text).forEach(function (hit) {
        live.set(hit.fn, { file: file, variable: hit.variable });
    });

});

/* a clean definition later in the order clears the earlier fault */
files.forEach(function (file) {

    const text = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
    const opener = /create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(/gi;
    let head;

    while ((head = opener.exec(text)) !== null) {
        const clean = clashesIn(text.slice(head.index, text.indexOf("$function$;", head.index))).length === 0;
        if (clean && live.has(head[1])) { live.delete(head[1]); }
    }

});

const clashes = [];
live.forEach(function (hit, fn) {
    clashes.push({ file: hit.file, fn: fn, variable: hit.variable });
});

ok("the scan really read the patches", files.length > 40 && functionsSeen > 100,
    { files: files.length, functions: functionsSeen });

ok("no function in force names a record variable after a table alias",
    clashes.length === 0, clashes);

console.log("\n   " + functionsSeen + " functions in " + files.length +
    " files, " + clashes.length + " clash" + (clashes.length === 1 ? "" : "es") +
    " among the definitions that are in force");

/* the one that was wrong, kept named so the check cannot quietly stop looking */
const propaganda = fs.readFileSync(path.join(SQL_DIR, "2026-10-27_congress_propaganda.sql"), "utf8");
const fix = fs.readFileSync(path.join(SQL_DIR, "2026-11-52_the_propaganda_offices_answer.sql"), "utf8");

ok("the propaganda loop was the fault this test exists for",
    /^\s+m record;/m.test(propaganda) && /for m in/.test(propaganda));
ok("and the repair walks its delegates as v_member",
    /v_member record;/.test(fix) && /for v_member in/.test(fix));

console.log("\n" + pass + " passed, " + fail + " failed");

process.exit(fail ? 1 : 0);
