/* 2026-11-39: the militia unit and its company strength, and that the patch
   can be run twice without complaint (the host may re-run anything). */
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.resolve(__dirname, "..");
const PATCH = "sql/2026-11-39_the_militia.sql";

let passed = 0, failed = 0;

function ok(name, cond, extra) {
    if (cond) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}

(async function main() {

    const db = new PGlite();
    const sql = fs.readFileSync(path.join(ROOT, PATCH), "utf8");

    await db.exec(sql);
    await db.exec(sql); /* re-run: the host may press the button twice */

    async function one(q) { return (await db.query(q)).rows[0]; }

    ok("a militia company is five hundred men",
        Number((await one("select public.rebel_company() as n")).n) === 500);
    ok("a militia squad carries a company",
        Number((await one("select public.fleet_squad_size('Militia') as n")).n) === 500);

    ok("fifteen hundred men are three companies",
        Number((await one("select public.rebel_companies(1500) as n")).n) === 3);
    ok("four bands are twelve companies",
        Number((await one("select public.rebel_companies(6000) as n")).n) === 12);
    ok("a wound does not round the company away",
        Number((await one("select public.rebel_companies(500) as n")).n) === 1);
    ok("no men, no companies",
        Number((await one("select public.rebel_companies(0) as n")).n) === 0);

    /* the other squads are untouched by the militia patch */
    ok("a rifle squad is still a thousand",
        Number((await one("select public.fleet_squad_size('Rifle') as n")).n) === 1000);
    ok("a knightmare is still three",
        Number((await one("select public.fleet_squad_size('Knightmare') as n")).n) === 3);
    ok("an unknown type still falls back",
        Number((await one("select public.fleet_squad_size('Whatever') as n")).n) === 1000);

    console.log(passed + " passed, " + failed + " failed");
    process.exit(failed ? 1 : 0);

})();
