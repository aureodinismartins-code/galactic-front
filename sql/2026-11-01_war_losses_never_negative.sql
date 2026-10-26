-- =========================================================
-- GALACTIC FRONT — the losses counter never goes negative
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once.
--
-- What was wrong: get_war_losses() reported NEGATIVE losses on the
-- civil-war worlds (Krieg, Vraks). The war_factions table itself is
-- healthy — every party's losses and loss_rate are positive — so the
-- fault was in the reading: the reported figure fell by loss_rate for
-- every second since the last tick, which drives a counter that only
-- ever grows down through zero and keeps going.
--
-- What this patch does:
--
--   1. The old function is kept, under the name
--      get_war_losses_legacy, so it can still be inspected or called.
--
--   2. get_war_losses() is rebuilt from the table it describes: each
--      party of the planet, with its stored losses (never below zero)
--      and its loss rate (never below zero). The screen animates the
--      counter between refreshes, as it always did.
--
--   3. A guard on war_factions stops any future write from storing a
--      negative loss or rate, so the counter cannot run backwards in
--      the table either.
-- =========================================================


-- ---------------------------------------------------------
-- 1. keep the old reading under another name
-- ---------------------------------------------------------

do $do$
declare
    r record;
    v_name text;
    v_n integer := 0;
begin

    /* an earlier run already moved the old reading aside: nothing to do,
       and the rebuilt one must not be renamed by mistake */
    if exists (select 1 from pg_proc as p
               join pg_namespace as n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'get_war_losses_legacy') then
        return;
    end if;

    /* every old copy is moved out of the way, so only one reading of that
       name can ever be left for the screen to call */
    for r in
        select p.oid::regprocedure::text as signature
        from pg_proc as p
        join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'get_war_losses'
        order by p.oid
    loop
        v_n := v_n + 1;
        v_name := case when v_n = 1 then 'get_war_losses_legacy'
                       else 'get_war_losses_legacy_' || v_n end;

        /* that name is taken already (an earlier run): try the next one */
        while exists (select 1 from pg_proc as p
                      join pg_namespace as n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = v_name)
        loop
            v_n := v_n + 1;
            v_name := 'get_war_losses_legacy_' || v_n;
        end loop;

        execute format('alter function %s rename to %s', r.signature, quote_ident(v_name));
    end loop;

end;
$do$;


-- ---------------------------------------------------------
-- 2. the reading the screen was always meant to get
-- ---------------------------------------------------------

drop function if exists public.get_war_losses(text);

create or replace function public.get_war_losses(p_planet text)
returns table (
    faction_id text,
    current_losses bigint,
    loss_rate numeric,
    server_now timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
    select w.id,
           greatest(0::bigint, coalesce(w.losses, 0)::bigint) as current_losses,
           greatest(0::numeric, coalesce(w.loss_rate, 0)) as loss_rate,
           now() as server_now
    from public.war_factions as w
    where w.planet = p_planet
    order by w.id
$function$;

/* the same readers as before: signed-in players, nobody else */
revoke all on function public.get_war_losses(text) from public;
grant execute on function public.get_war_losses(text) to authenticated;


-- ---------------------------------------------------------
-- 3. a counter that never runs backwards
-- ---------------------------------------------------------

create or replace function public.war_losses_guard()
returns trigger
language plpgsql
as $function$
begin

    if new.losses is not null and new.losses < 0 then
        new.losses := 0;
    end if;

    if new.loss_rate is not null and new.loss_rate < 0 then
        new.loss_rate := 0;
    end if;

    return new;

end;
$function$;

drop trigger if exists war_losses_guard on public.war_factions;

create trigger war_losses_guard
before insert or update on public.war_factions
for each row
execute function public.war_losses_guard();

/* and whatever is already stored is brought back to zero */
update public.war_factions as w set losses = 0 where w.losses < 0;
update public.war_factions as w set loss_rate = 0 where w.loss_rate < 0;


-- ---------------------------------------------------------
-- sanity output: nothing here should be negative
-- ---------------------------------------------------------

select w.planet,
       w.name,
       w.losses,
       round(w.loss_rate, 3) as loss_rate,
       (select l.current_losses from public.get_war_losses(w.planet) as l
        where l.faction_id = w.id) as reported
from public.war_factions as w
where w.planet in ('Krieg', 'Vraks')
order by w.planet, w.id;
