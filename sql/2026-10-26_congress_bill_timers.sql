-- =========================================================
-- GALACTIC FRONT — Congress bill timers: 3 minutes + 5 minutes
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- It can run with maintenance on or off.
--
-- Problem: a bill showed "Debate opens in 11650:59" — about eight
-- days. Congress_tick() adds the time a Freedom Authority player
-- spent offline back onto every clock (cg_shift), and after a long
-- pause (maintenance, or simply nobody online for a while) that gap
-- is huge: one tick pushed every deadline days into the future, so
-- the bill never moved on and the countdown was nonsense.
--
-- Fix: the length of a bill phase is now enforced by the database
-- itself, whatever any other function writes:
--
--   a new bill goes in with DEBATE opening in 3 minutes, and the
--   vote 5 minutes after that;
--
--   while a bill is live its deadline can never be further away
--   than the phase allows (3 minutes of introduction, 5 minutes of
--   debate), so no shift can stretch it again.
--
-- Shifts still work: if Congress is paused while nobody is online,
-- the remaining time is carried over — it just can't grow.
-- =========================================================


-- ---------------------------------------------------------
-- 1. The bills that are stuck right now
-- ---------------------------------------------------------

/* game_guard refuses writes on cg_proposals while the game is closed,
   and the trigger created below would fire on these rows too: both are
   user triggers, so they are off for this one repair statement.
   Postgres rolls the whole script back if anything fails, so the table
   is never left without its triggers. */
alter table public.cg_proposals disable trigger user;

update public.cg_proposals as x
set debate_at = case
        when x.status::text = 'introduction' then now() + interval '3 minutes'
        else x.debate_at
    end,
    vote_at = case
        when x.status::text = 'introduction' then now() + interval '8 minutes'
        when x.status::text = 'debate' then now() + interval '5 minutes'
        else x.vote_at
    end
where x.status::text in ('introduction', 'debate');

alter table public.cg_proposals enable trigger user;


-- ---------------------------------------------------------
-- 2. The rule, from now on
-- ---------------------------------------------------------

create or replace function public.cg_bill_timers()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    c_intro constant interval := interval '3 minutes';   -- introduction
    c_debate constant interval := interval '5 minutes';  -- debate
begin

    if tg_op = 'INSERT' then

        /* every new bill gets the full 3 + 5 minutes, whoever submits it */
        if new.status::text = 'introduction' then
            new.debate_at := now() + c_intro;
            new.vote_at := now() + c_intro + c_debate;
        elsif new.status::text = 'debate' then
            new.vote_at := now() + c_debate;
        end if;

        return new;

    end if;

    /* an update (a shift, a phase change): the phase may get shorter,
       never longer than its own length */
    if new.status::text = 'introduction' then

        new.debate_at := least(new.debate_at, now() + c_intro);
        new.vote_at := least(new.vote_at, now() + c_intro + c_debate);

    elsif new.status::text = 'debate' then

        new.vote_at := least(new.vote_at, now() + c_debate);

    end if;

    return new;

end;
$function$;


drop trigger if exists cg_bill_timers on public.cg_proposals;

create trigger cg_bill_timers
before insert or update on public.cg_proposals
for each row
execute function public.cg_bill_timers();


-- ---------------------------------------------------------
-- 3. sanity output
-- ---------------------------------------------------------

select
    x.id,
    x.status::text as status,
    greatest(0, round(extract(epoch from (x.debate_at - now())))) as intro_seconds_left,
    greatest(0, round(extract(epoch from (x.vote_at - now())))) as vote_seconds_left
from public.cg_proposals as x
where x.status::text in ('introduction', 'debate')
order by x.id;
