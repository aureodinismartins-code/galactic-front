/* The live install reported "column m.player_id does not exist" on the
   Congress tab: the ministry table predates the column an older
   cg_government() reads, and every later `create table if not exists` was a
   no-op. 2026-11-25 puts the columns back.

   This builds the crippled table the install actually has, shows the read
   failing, applies the repair twice, and shows it working.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/ministry-columns-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const ME = "11111111-1111-1111-1111-111111111111";

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : "")); }
}

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

(async function main() {

    const repair = fs.readFileSync(
        path.join(ROOT, "sql", "2026-11-25_the_ministry_tables_are_whole.sql"), "utf8");

    const db = new PGlite();

    await db.exec(`
        create schema if not exists auth;
        create or replace function auth.uid() returns uuid language sql stable
        as $$ select '${ME}'::uuid $$;

        /* the table as the install really has it: no player_id, no member_id */
        create table public.cg_ministers (
            post text primary key,
            name text,
            party_id integer,
            appointed_at timestamptz not null default now(),
            term_no integer,
            last_power_term integer,
            last_power_at timestamptz
        );
        insert into public.cg_ministers (post, name, party_id)
        values ('interior', 'Alicia Whitaker', 3);

        create table public.cs_ministers (
            post text primary key,
            name text,
            current_id integer,
            appointed_at timestamptz not null default now()
        );
    `);

    console.log("\nthe error the install is showing");

    let before = "";
    try {
        /* exactly what the older cg_government() asks for */
        await call(db, "select m.player_id from public.cg_ministers as m where m.post = 'interior'");
    } catch (e) { before = String(e.message); }

    check("reading player_id fails before the repair", /player_id does not exist/.test(before), before);

    console.log("\nthe repair");

    await db.exec(repair);
    await db.exec(repair);   /* twice: it must be safe to run again */

    const cols = async (t) => (await call(db,
        "select column_name from information_schema.columns where table_schema = 'public' " +
        "and table_name = '" + t + "'")).map(r => r.column_name);

    const cg = await cols("cg_ministers");
    const cs = await cols("cs_ministers");

    ["player_id", "member_id", "name", "party_id", "last_effect", "last_effect_term",
     "last_power_term", "last_power_at", "term_no"].forEach(c => {
        check("the Congress's ministries have " + c, cg.includes(c), JSON.stringify(cg));
    });
    ["player_id", "member_id", "name", "current_id", "last_effect", "last_effect_term"].forEach(c => {
        check("the Combine's commissariats have " + c, cs.includes(c), JSON.stringify(cs));
    });

    const read = await call(db, "select m.post, m.player_id, m.member_id, m.name from public.cg_ministers as m where m.post = 'interior'");
    check("the query the screen makes now answers", read.length === 1 && read[0].player_id === null,
        JSON.stringify(read));

    check("the holder already in the table is kept", read[0].name === "Alicia Whitaker", read[0].name);

    const posts = (await call(db, "select post from public.cg_ministers order by post")).map(r => r.post);
    check("the three posts are there, once each",
        JSON.stringify(posts) === JSON.stringify(["interior", "treasury", "war"]), JSON.stringify(posts));

    const cposts = (await call(db, "select post from public.cs_ministers order by post")).map(r => r.post);
    check("and the Combine's three",
        JSON.stringify(cposts) === JSON.stringify(["grain", "labour", "security"]), JSON.stringify(cposts));

    console.log("\n" + passed + " passed, " + failed + " failed");

    if (failed) { process.exit(1); }

})();
