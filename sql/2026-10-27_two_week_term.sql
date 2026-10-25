-- =========================================================
-- GALACTIC FRONT — a presidential term lasts two weeks
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- It can run with maintenance on or off.
--
-- The length of a term is decided by cg_run_elections(), which
-- writes cg_state.term_end when it installs a new President. So
-- the length is enforced here, by the database itself: every time
-- the term number changes (that is, every time a President takes
-- office) the term is set to exactly 14 days from that moment,
-- whoever wrote the date and whatever that function believed the
-- length was. Nothing else about an election changes.
--
-- The term that is running right now is stretched to the same two
-- weeks, so the rule is visible immediately instead of after the
-- next election.
-- =========================================================


-- ---------------------------------------------------------
-- 1. The rule, from now on
-- ---------------------------------------------------------

create or replace function public.cg_two_week_term()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin

    /* a fresh term: the term counter moved (or a different commander
       took the office) and the new President already has an end date.
       Whatever cg_run_elections wrote, the term is two weeks long. */
    if new.president_player is not null
       and new.term_end is not null
       and (new.term_no is distinct from old.term_no
            or new.president_player is distinct from old.president_player) then
        new.term_end := now() + interval '14 days';
    end if;

    return new;

end;
$function$;


drop trigger if exists cg_two_week_term on public.cg_state;

create trigger cg_two_week_term
before update on public.cg_state
for each row
execute function public.cg_two_week_term();


-- ---------------------------------------------------------
-- 2. The term that is already running
--
-- game_guard refuses writes on cg_state while the game is closed,
-- and this repair is not gameplay: both are user triggers, so they
-- are off for this one statement and back on immediately after.
-- DDL is transactional here, so a failure rolls the disable back
-- instead of leaving the table unprotected.
-- ---------------------------------------------------------

alter table public.cg_state disable trigger user;

update public.cg_state as s
set term_end = now() + interval '14 days'
where s.id = 1
  and s.president_player is not null
  and s.term_end is not null
  and s.term_end < now() + interval '14 days';

alter table public.cg_state enable trigger user;


-- ---------------------------------------------------------
-- 3. sanity output
-- ---------------------------------------------------------

select
    s.president_player as president,
    s.term_no as term,
    s.term_end,
    round(extract(epoch from (s.term_end - now())) / 3600) as hours_left,
    (select count(*) from pg_trigger where tgname = 'cg_two_week_term') as rule_installed
from public.cg_state as s
where s.id = 1;
