/* How often does a directive actually pass the Supreme Soviet?

   Opens the real sql/2026-10-28_combine_soviet.sql in PGlite, then puts
   directives of each kind before the plenum: it seats the chamber the way
   cs_debate_tick() does, lets the undecided make up their minds the way
   five minutes of debate does, and resolves the vote. Nothing is forced.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/soviet-balance.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const SQL = fs.readFileSync(path.join(ROOT, "sql/2026-10-28_combine_soviet.sql"), "utf8");
const ME = "11111111-1111-1111-1111-111111111111";

const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;
create schema if not exists extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select '${ME}'::uuid $$;
create table public.game_control (id int primary key, started boolean default true, maintenance boolean default false);
insert into public.game_control (id) values (1);
create or replace function public.game_frozen() returns boolean language sql stable as $$ select false $$;
create or replace function public.collect_faction_income() returns void language sql as $$ select $$;
create table public.players (id uuid primary key, faction text, username text);
insert into public.players values ('${ME}', 'Combine', 'Comrade Volkov');
create or replace function public.my_identity() returns table (username text) language sql stable
as $$ select p.username from public.players as p where p.id = auth.uid() $$;
create table public.planets (id serial primary key, name text unique, income int default 100);
insert into public.planets (name) values ('Veyrona'), ('Krieg'), ('Ultramars'), ('Liberty City');
create table public.cities (id serial primary key, planet_id int references public.planets (id), faction text);
insert into public.cities (planet_id, faction) values
    (1, 'Independents'), (2, 'Combine'), (3, 'Freedom Authority'), (4, 'Combine');
create table public.faction_treasury (faction text primary key, credits bigint default 5000, fleets_built int default 0, last_income_at timestamptz);
insert into public.faction_treasury (faction, credits) values ('Combine', 5000), ('Freedom Authority', 500);
create table public.fleets (
    id uuid primary key default gen_random_uuid(), player_id uuid, name text, faction text, origin text,
    destination text, status text default 'stationed', departure_time timestamptz, arrival_time timestamptz, squads jsonb
);
insert into public.fleets (player_id, name, faction, status) values ('${ME}', 'Frota Um', 'Combine', 'stationed');
create table public.cg_authorizations (id serial primary key, kind text, player_id uuid, used boolean default false, used_at timestamptz);
`;

const TYPES = ["fleet_construction", "military_campaign", "production_quota", "knightmare_construction", "diplomacy"];

(async function main() {

    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(SQL);

    /* the sponsor of each kind, as the commissars bring them themselves */
    const sponsorOf = { military_campaign: 3, production_quota: 1, diplomacy: 1, fleet_construction: 2, knightmare_construction: 3 };

    console.log("type / sponsor                       passed  avg yes  needed");

    for (const type of TYPES) {

        for (const sponsor of [1, 2, 3]) {

            let passed = 0;
            let yesTotal = 0;
            let need = 0;
            const runs = 40;

            for (let i = 0; i < runs; i++) {

                await db.query("update public.cs_state set quota = 0, confidence = 55 where id = 1");

                const planet = type === "military_campaign" ? "('Veyrona')" : "null";
                const target = type === "diplomacy" ? "'Independents'" : "null";

                const id = (await db.query(
                    `insert into public.cs_directives (dtype, title, sponsor_current, source, proposer_name, planet, target_faction)
                     values ('${type}', 'teste', ${sponsor}, 'npc', 'O Partido', ${planet}, ${target})
                     returning id`)).rows[0].id;

                /* the chamber takes sides exactly as cs_debate_tick() seats it */
                await db.query(
                    `insert into public.cs_debate_sides (directive_id, commissar_id, side)
                     select ${id}, m.id,
                            case
                                when random() < public.cs_likelihood(m.current_id, m.loyalty, ${sponsor}, '${type}',
                                        (select confidence from public.cs_state where id = 1)) / 100.0 then 'yes'
                                when random() < (public.cs_likelihood(m.current_id, m.loyalty, ${sponsor}, '${type}',
                                        (select confidence from public.cs_state where id = 1)) + 25) / 100.0 then 'no'
                                else 'undecided'
                            end
                     from public.cs_commissars as m where m.active`);

                /* five minutes of debate: the undecided make up their minds */
                await db.query(`update public.cs_debate_sides set side = case when random() < 0.5 then 'yes' else 'no' end
                                where directive_id = ${id} and side = 'undecided'`);

                const r = (await db.query(`select public.cs_resolve(${id}) as r`)).rows[0].r;
                if (r.status === "passed") { passed++; }
                yesTotal += Number(r.yes);
                need = Number(r.required);

                await db.query(`delete from public.cs_votes where directive_id = ${id}`);
                await db.query(`delete from public.cs_directives where id = ${id}`);
                await db.query("delete from public.cs_authorizations");
                await db.query("delete from public.fleets where name <> 'Frota Um'");
                await db.query("delete from public.cs_privileges");
            }

            console.log(
                (type + " (" + sponsor + ")").padEnd(38) +
                (Math.round(passed / runs * 100) + "%").padStart(6) +
                (Math.round(yesTotal / runs)).toString().padStart(9) +
                need.toString().padStart(8));
        }
    }

    await db.close();

})().catch(e => { console.log("CRASH: " + (e && e.message ? e.message : e)); process.exit(1); });
