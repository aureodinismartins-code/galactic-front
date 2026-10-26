-- =========================================================
-- GALACTIC FRONT — the Supreme Soviet of the Combine
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- It can run with maintenance on or off.
--
-- The Combine now has a chamber of its own, built the way the
-- Congress was but answering to Soviet manners:
--
--   * 100 COMMISSARS sit in the Supreme Soviet, in three currents
--     of the Party: the Proletarian Vanguard (42), the Party
--     Apparatus (33) and Red Command (25). A simple majority is
--     51 seats; the heavier directives (a fleet, an armoured
--     detachment, the plan, a dismantling) need three fifths, 60.
--     Two thirds was tried first and nothing ever passed: with
--     three currents, 67 of 100 is out of reach. Three fifths is
--     still a real gate — the plenum has to be won, not assumed;
--   * a bill is a DIRECTIVE. It is free, always — nothing is
--     charged for putting one forward or for passing it;
--   * commissars take a side when the directive is introduced and
--     the plenum moves while it is debated: a few cross every
--     15 seconds, the sponsoring current holding firmest;
--   * instead of bribes there are CADRE PRIVILEGES: credits from
--     the Combine treasury spent on nomenklatura comforts, with
--     the same chance of working and the same risk of a scandal
--     (a disgraced commissar is replaced);
--   * the Party is led by a GENERAL SECRETARY, elected by the
--     Combine's players, with 5 directives before the Soviet
--     instead of 3, one veto of the Central Committee per term,
--     a term of two weeks, and a plenum 10 points friendlier to
--     whatever his own current brings;
--   * the Soviet has teeth: a Combine fleet needs an approved
--     quota directive before it can be built, and a Combine
--     attack needs an approved campaign directive for that
--     planet. This file also replaces create_fleet() to enforce
--     the first of those;
--   * a production quota directive raises the Combine's income
--     every 15 minutes, the way a tax bill raises the Authority's.
--
-- Everything is called by the Soviet screen (combine.html), like
-- the Congress screen calls the Congress: nothing moves while no
-- Combine player has the page open.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the three currents of the Party
-- ---------------------------------------------------------

create table if not exists public.cs_currents (
    id integer primary key,
    key text not null unique,
    name text not null,
    color text not null,
    seats integer not null default 0,
    loyalty numeric not null default 55,
    alignment_x numeric not null default 0,
    alignment_y numeric not null default 0,
    priorities text[] not null default '{}',
    description text not null default ''
);

insert into public.cs_currents (id, key, name, color, seats, loyalty, alignment_x, alignment_y, priorities, description)
values
    (1, 'proletarian', 'Vanguarda Proletária', '#c0272d', 42, 62, -0.85, -0.10, array['production_quota', 'diplomacy'], 'Conselhos de operários e soldados: o plano vem de baixo e a guerra é de todos'),
    (2, 'apparatus',   'Aparato do Partido',   '#c08a2e', 33, 55,  0.15,  0.85, array['fleet_construction', 'fleet_revocation'], 'Engenheiros, planejadores e burocratas: tudo se mede em toneladas e em ordens cumpridas'),
    (3, 'red_command', 'Comando Vermelho',     '#7a1f1f', 25, 74,  0.90, -0.70, array['military_campaign', 'knightmare_construction'], 'O exército fala no plenário, e fala alto')
on conflict (id) do nothing;


-- ---------------------------------------------------------
-- 2. the commissars
-- ---------------------------------------------------------

create table if not exists public.cs_commissars (
    id serial primary key,
    name text not null,
    current_id integer not null references public.cs_currents (id),
    oblast text not null,
    seat integer not null,
    loyalty numeric not null default 55,
    alignment_x numeric not null default 0,
    alignment_y numeric not null default 0,
    active boolean not null default true,
    corruption_level integer not null default 0,
    privileges_taken integer not null default 0,
    is_disgraced boolean not null default false,
    replaced_by text
);

create index if not exists cs_commissars_current_idx on public.cs_commissars (current_id);

/* the first seating: 100 names, 42 / 33 / 25 */
insert into public.cs_commissars (name, current_id, oblast, seat, loyalty, alignment_x, alignment_y)
select
    (array['Dmitri','Ivan','Yelena','Nadia','Sergei','Anya','Boris','Katya','Lev','Olga',
           'Pyotr','Raisa','Sasha','Tamara','Viktor','Zoya','Anton','Galina','Roman','Irina',
           'Nikolai','Vera','Fyodor','Larisa'])[1 + (g % 24)] || ' ' ||
    (array['Volkov','Orlova','Kuznetsov','Sokolova','Medvedev','Belova','Raskolnikov','Mironova','Zaytsev','Polyakova',
           'Trotsky','Kameneva','Dzerzhinsky','Krupskaya','Molotov','Zemlyachka','Kirov','Roshal','Ordzhonikidze','Vasileva'])[1 + ((g * 7) % 20)],
    case when g <= 42 then 1 when g <= 75 then 2 else 3 end,
    (array['Oblast Central','Oblast Norte','Oblast Sul','Oblast Leste','Oblast Oeste',
           'Oblast Industrial','Oblast Fronteira','Oblast do Rim'])[1 + (g % 8)],
    g,
    35 + ((g * 13) % 50),
    round((random() * 2 - 1)::numeric, 2),
    round((random() * 2 - 1)::numeric, 2)
from generate_series(1, 100) as g
where not exists (select 1 from public.cs_commissars);


-- ---------------------------------------------------------
-- 3. the Party's books, the directives and the votes
-- ---------------------------------------------------------

create table if not exists public.cs_state (
    id integer primary key check (id = 1),
    confidence numeric not null default 55,
    quota integer not null default 1,
    relations jsonb not null default '{"Freedom Authority": -20, "Independents": 10}'::jsonb,
    secretary_player uuid,
    secretary_name text,
    secretary_current integer,
    term_no integer not null default 0,
    term_end timestamptz,
    veto_used boolean not null default false,
    online_at timestamptz,
    last_npc_at timestamptz,
    last_quota_at timestamptz,
    last_debate_at timestamptz,
    last_election_at timestamptz
);

insert into public.cs_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.cs_directives (
    id serial primary key,
    dtype text not null,
    title text not null,
    status text not null default 'introduction',
    sponsor_current integer not null references public.cs_currents (id),
    source text not null default 'player',
    proposer_name text not null default '',
    proposer_player uuid,
    planet text,
    fleet_id text,
    target_faction text,
    created_at timestamptz not null default now(),
    debate_at timestamptz not null default now(),
    vote_at timestamptz not null default now(),
    resolved_at timestamptz,
    yes_votes integer not null default 0,
    no_votes integer not null default 0,
    abstain_votes integer not null default 0,
    required_votes integer,
    result jsonb
);

create index if not exists cs_directives_live_idx on public.cs_directives (status);

create table if not exists public.cs_privileges (
    id serial primary key,
    directive_id integer not null references public.cs_directives (id) on delete cascade,
    commissar_id integer not null references public.cs_commissars (id),
    player_id uuid,
    amount numeric not null,
    stance text not null default 'yes',
    created_at timestamptz not null default now()
);

create table if not exists public.cs_votes (
    id serial primary key,
    directive_id integer not null references public.cs_directives (id) on delete cascade,
    commissar_id integer not null references public.cs_commissars (id),
    vote text not null,
    was_privileged boolean not null default false,
    likelihood numeric,
    created_at timestamptz not null default now()
);

create table if not exists public.cs_log (
    id serial primary key,
    at timestamptz not null default now(),
    text text not null
);

/* writes one line of the Soviet's record (the table and the function share a
   name, as cg_log does on the Congress side) */
create or replace function public.cs_log(p_text text)
returns void
language sql
security definer
set search_path to ''
as $function$
    insert into public.cs_log (text) values (p_text)
$function$;

/* what the Soviet has authorised: a fleet quota, an armoured detachment, or a campaign */
create table if not exists public.cs_authorizations (
    id serial primary key,
    kind text not null check (kind in ('fleet', 'knightmare', 'war')),
    player_id uuid,
    planet text,
    used boolean not null default false,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.cs_membership (
    player_id uuid primary key,
    current_id integer not null references public.cs_currents (id),
    name text,
    joined_at timestamptz not null default now()
);

create table if not exists public.cs_election (
    id serial primary key,
    phase text not null default 'campaign' check (phase in ('campaign', 'voting', 'done')),
    campaign_end timestamptz not null,
    vote_end timestamptz not null,
    created_at timestamptz not null default now(),
    winner_id uuid,
    winner_name text,
    note text
);

create table if not exists public.cs_candidates (
    id serial primary key,
    election_id integer not null references public.cs_election (id) on delete cascade,
    player_id uuid not null,
    name text not null,
    current_id integer not null references public.cs_currents (id),
    created_at timestamptz not null default now(),
    unique (election_id, player_id)
);

create table if not exists public.cs_election_votes (
    election_id integer not null references public.cs_election (id) on delete cascade,
    player_id uuid not null,
    candidate_id uuid not null,
    created_at timestamptz not null default now(),
    primary key (election_id, player_id)
);

/* the sides the plenum is on, as the directive is debated */
create table if not exists public.cs_debate_sides (
    directive_id integer not null references public.cs_directives (id) on delete cascade,
    commissar_id integer not null references public.cs_commissars (id) on delete cascade,
    side text not null check (side in ('yes', 'no', 'undecided')),
    changed_at timestamptz not null default now(),
    changes integer not null default 0,
    primary key (directive_id, commissar_id)
);

create table if not exists public.cs_debate_standing (
    directive_id integer primary key references public.cs_directives (id) on delete cascade,
    winning boolean,
    changed_at timestamptz
);


-- ---------------------------------------------------------
-- 4. a commissar's name and the odds a commissar says yes
-- ---------------------------------------------------------

/* the best name we can find for a player: the players row if it carries a
   name column, otherwise my_identity(), otherwise nothing */
create or replace function public.cs_player_name(p_player uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v text;
begin

    if p_player is null then return null; end if;

    begin
        execute format(
            'select %I from public.players as p where p.id = $1',
            (select c.column_name
             from information_schema.columns as c
             where c.table_schema = 'public' and c.table_name = 'players'
               and c.column_name in ('username', 'name')
             order by (c.column_name = 'username') desc
             limit 1))
        into v
        using p_player;
    exception when others then v := null;
    end;

    if coalesce(v, '') = '' and p_player = auth.uid() then
        begin
            execute 'select username from public.my_identity() limit 1' into v;
        exception when others then v := null;
        end;
    end if;

    return nullif(coalesce(v, ''), '');

end;
$function$;


/* how likely a commissar is to vote yes on this directive */
create or replace function public.cs_likelihood(p_current integer, p_loyalty numeric, p_sponsor integer, p_dtype text, p_confidence numeric)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v numeric := 45;
    a record;
    b record;
    v_dist numeric;
begin

    if p_current = p_sponsor then
        /* party discipline: a current votes for its own directive */
        v := v + 32;
    else
        select c.alignment_x, c.alignment_y into a from public.cs_currents as c where c.id = p_current;
        select c.alignment_x, c.alignment_y into b from public.cs_currents as c where c.id = p_sponsor;

        if a.alignment_x is not null and b.alignment_x is not null then
            v_dist := sqrt(power(a.alignment_x - b.alignment_x, 2) + power(a.alignment_y - b.alignment_y, 2));
            v := v + greatest(-30::numeric, least(15::numeric, 15 - 18 * v_dist));
        end if;
    end if;

    if exists (select 1 from public.cs_currents as c
               where c.id = p_current and p_dtype = any (c.priorities)) then
        v := v + 12;
    end if;

    v := v + (coalesce(p_loyalty, 55) - 55) * 0.35;
    v := v + greatest(-10::numeric, least(10::numeric, (coalesce(p_confidence, 55) - 55) / 5));

    return greatest(2::numeric, least(95::numeric, round(v)));

end;
$function$;


-- ---------------------------------------------------------
-- 5. the clock: 3 minutes of introduction, 5 of debate
-- ---------------------------------------------------------

create or replace function public.cs_directive_timers()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    c_intro constant interval := interval '3 minutes';
    c_debate constant interval := interval '5 minutes';
begin

    if tg_op = 'INSERT' then

        if new.status = 'introduction' then
            new.debate_at := now() + c_intro;
            new.vote_at := now() + c_intro + c_debate;
        elsif new.status = 'debate' then
            new.vote_at := now() + c_debate;
        end if;

        return new;

    end if;

    if new.status = 'introduction' then
        new.debate_at := least(new.debate_at, now() + c_intro);
        new.vote_at := least(new.vote_at, now() + c_intro + c_debate);
    elsif new.status = 'debate' then
        new.vote_at := least(new.vote_at, now() + c_debate);
    end if;

    return new;

end;
$function$;

drop trigger if exists cs_directive_timers on public.cs_directives;

create trigger cs_directive_timers
before insert or update on public.cs_directives
for each row
execute function public.cs_directive_timers();


-- ---------------------------------------------------------
-- 6. what the screen reads
-- ---------------------------------------------------------

create or replace function public.cs_majority()
returns integer
language sql
stable
as $function$
    select floor(count(*) / 2.0)::integer + 1 from public.cs_commissars where active
$function$;

/* how much friendlier than usual the plenum is to this directive: the
   ruling current's agenda is heard more often, and a Combine with almost
   no fleets gets its quota through (nothing can be done without one) */
create or replace function public.cs_boost(p_dtype text, p_sponsor integer, p_secretary_current integer)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v numeric := 0;
    v_fleets integer;
begin

    if p_secretary_current is not null and p_sponsor = p_secretary_current then
        v := v + 10;
    end if;

    if p_dtype = 'fleet_construction' then
        select count(*) into v_fleets from public.fleets as f where f.faction = 'Combine';
        if v_fleets = 0 then
            v := v + 40;          -- no fleet at all: the Party sees to it
        elsif v_fleets < 3 then
            v := v + 20;          -- a thin fleet: the war can still be lost
        end if;
    end if;

    return v;

end;
$function$;


/* three fifths of the seated commissars: the bar for the heavier directives */
create or replace function public.cs_qualified()
returns integer
language sql
stable
as $function$
    select ceil(count(*) * 3.0 / 5)::integer from public.cs_commissars where active
$function$;


create or replace function public.cs_overview()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_majority integer;
    v_qualified integer;
    v_credits numeric;
    v_current integer;
    v_out jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cs_state as s where s.id = 1;
    v_majority := public.cs_majority();
    v_qualified := public.cs_qualified();

    select coalesce(ft.credits, 0) into v_credits from public.faction_treasury as ft where ft.faction = 'Combine';
    select m.current_id into v_current from public.cs_membership as m where m.player_id = me;

    select jsonb_build_object(

        'now', now(),

        'credits', coalesce(v_credits, 0),
        'seats', (select count(*) from public.cs_commissars where active),
        'majority', v_majority,
        'supermajority', v_qualified,

        'currents', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', c.id,
                       'key', c.key,
                       'name', c.name,
                       'color', c.color,
                       'seats', (select count(*) from public.cs_commissars as x where x.active and x.current_id = c.id),
                       'loyalty', round(coalesce((select avg(x.loyalty) from public.cs_commissars as x where x.active and x.current_id = c.id), c.loyalty)),
                       'priorities', to_jsonb(c.priorities),
                       'description', c.description
                   ) order by c.id)
            from public.cs_currents as c
        ), '[]'::jsonb),

        'commissars', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', m.id,
                       'name', m.name,
                       'faction', m.current_id,
                       'region', m.oblast,
                       'area', null,
                       'seat', m.seat,
                       'loyalty', round(m.loyalty),
                       'planet', null,
                       'suspect', m.is_disgraced
                   ) order by m.seat)
            from public.cs_commissars as m where m.active
        ), '[]'::jsonb),

        'directives', coalesce((
            select jsonb_agg(x.obj order by x.id desc)
            from (
                select d.id, jsonb_build_object(
                    'id', d.id,
                    'title', d.title,
                    'type', d.dtype,
                    'sponsor', d.sponsor_current,
                    'status', d.status,
                    'debate_at', d.debate_at,
                    'vote_at', d.vote_at,
                    'mine', (d.proposer_player is not null and d.proposer_player = me),
                    'by_secretary', (st.secretary_player is not null and d.proposer_player = st.secretary_player),
                    'proposer', d.proposer_name,
                    'yes', d.yes_votes,
                    'no', d.no_votes,
                    'abstain', d.abstain_votes,
                    'required', d.required_votes,
                    'planet', d.planet,
                    'fleet', d.fleet_id,
                    'target', d.target_faction,
                    'result', d.result,
                    'privileges', coalesce((
                        select jsonb_agg(jsonb_build_object('member', p.commissar_id, 'amount', p.amount, 'stance', p.stance))
                        from public.cs_privileges as p
                        where p.directive_id = d.id and p.player_id = me
                    ), '[]'::jsonb),
                    'forecast', coalesce((
                        select jsonb_agg(jsonb_build_object(
                                   'faction', c.id,
                                   'p', least(100, public.cs_likelihood(c.id, 55, d.sponsor_current, d.dtype, st.confidence)
                                              + public.cs_boost(d.dtype, d.sponsor_current, st.secretary_current))))
                        from public.cs_currents as c
                    ), '[]'::jsonb)
                ) as obj
                from public.cs_directives as d
                where d.status in ('introduction', 'debate', 'passed', 'rejected')
                order by d.id desc
                limit 24
            ) as x
        ), '[]'::jsonb),

        'targets', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', t.name,
                       'owners', t.owner,
                       'declared', exists (select 1 from public.cs_authorizations as a
                                           where a.kind = 'war' and a.planet = t.name))
                   order by t.name)
            from (
                select p.name,
                       case
                           when not exists (select 1 from public.cities as c where c.planet_id = p.id) then 'Unclaimed'
                           when not exists (select 1 from public.cities as c
                                            where c.planet_id = p.id and c.faction is distinct from 'Combine') then 'Combine'
                           when not exists (select 1 from public.cities as c
                                            where c.planet_id = p.id and c.faction is distinct from 'Freedom Authority') then 'Freedom Authority'
                           else 'Contested'
                       end as owner
                from public.planets as p
            ) as t
        ), '[]'::jsonb),

        'my_fleets', coalesce((
            select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.name)
            from public.fleets as f
            where f.faction = 'Combine'
              and f.player_id = me
              and coalesce(f.status::text, '') <> 'engaged'
        ), '[]'::jsonb),

        'authorizations', jsonb_build_object(
            'fleet', (select count(*) from public.cs_authorizations where kind = 'fleet' and not used),
            'knightmare', (select count(*) from public.cs_authorizations where kind = 'knightmare' and not used),
            'war', coalesce((select jsonb_agg(a.planet order by a.planet) from public.cs_authorizations as a
                             where a.kind = 'war' and not a.used), '[]'::jsonb)
        ),

        'state', jsonb_build_object(
            'popularity', st.confidence,
            'tax_level', st.quota,
            'relations', st.relations,
            'credits', coalesce(v_credits, 0)
        ),

        'president', case when st.secretary_player is null then null else jsonb_build_object(
            'name', st.secretary_name,
            'faction', st.secretary_current,
            'term_no', st.term_no,
            'term_end', st.term_end,
            'veto_used', st.veto_used,
            'me', st.secretary_player = me
        ) end,

        'election', (
            select jsonb_build_object(
                'phase', e.phase,
                'campaign_end', e.campaign_end,
                'vote_end', e.vote_end,
                'candidates', coalesce((
                    select jsonb_agg(jsonb_build_object(
                               'player_id', c.player_id,
                               'name', c.name,
                               'faction', c.current_id,
                               'mine', c.player_id = me) order by c.name)
                    from public.cs_candidates as c where c.election_id = e.id
                ), '[]'::jsonb),
                'voted', (select count(*) from public.cs_election_votes as v where v.election_id = e.id),
                'voters', (select count(*) from public.cs_membership),
                'my_vote', (select v.candidate_id from public.cs_election_votes as v where v.election_id = e.id and v.player_id = me)
            )
            from public.cs_election as e
            where e.phase <> 'done'
            order by e.id desc limit 1
        ),

        'parties', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'faction', c.id,
                       'players', coalesce((
                           select jsonb_agg(coalesce(m.name, 'Comrade') order by m.name)
                           from public.cs_membership as m where m.current_id = c.id), '[]'::jsonb)) order by c.id)
            from public.cs_currents as c
        ), '[]'::jsonb),

        'my_party', v_current,

        'party_members', coalesce((
            select jsonb_agg(jsonb_build_object('faction', m.current_id, 'name', coalesce(m.name, 'Comrade')) order by m.name)
            from public.cs_membership as m
        ), '[]'::jsonb),

        'last_election', (
            select jsonb_build_object('winner', e.winner_name, 'result', jsonb_build_object('note', e.note))
            from public.cs_election as e where e.phase = 'done' order by e.id desc limit 1
        ),

        'log', coalesce((
            select jsonb_agg(jsonb_build_object('at', l.at, 'text', l.text) order by l.id desc)
            from (select * from public.cs_log order by id desc limit 60) as l
        ), '[]'::jsonb)

    ) into v_out;

    return v_out;

end;
$function$;


/* the chamber as it stands, for the dome */
create or replace function public.cs_debate_view()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_out jsonb;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
                'id', d.id,
                'status', d.status,
                'yes', (select count(*) from public.cs_debate_sides as s where s.directive_id = d.id and s.side = 'yes'),
                'no', (select count(*) from public.cs_debate_sides as s where s.directive_id = d.id and s.side = 'no'),
                'undecided', (select count(*) from public.cs_debate_sides as s where s.directive_id = d.id and s.side = 'undecided'),
                'sides', coalesce((
                    select jsonb_object_agg(s.commissar_id::text, s.side)
                    from public.cs_debate_sides as s where s.directive_id = d.id
                ), '{}'::jsonb),
                'factions', coalesce((
                    select jsonb_object_agg(t.current_id::text, jsonb_build_object('yes', t.n_yes, 'no', t.n_no, 'undecided', t.n_und))
                    from (
                        select m.current_id,
                               count(*) filter (where s.side = 'yes') as n_yes,
                               count(*) filter (where s.side = 'no') as n_no,
                               count(*) filter (where s.side = 'undecided') as n_und
                        from public.cs_debate_sides as s
                        join public.cs_commissars as m on m.id = s.commissar_id
                        where s.directive_id = d.id
                        group by m.current_id
                    ) as t
                ), '{}'::jsonb)
            ) order by d.id), '[]'::jsonb)
    into v_out
    from public.cs_directives as d
    where d.status in ('introduction', 'debate');

    return jsonb_build_object('proposals', v_out);

end;
$function$;


/* a commissar's record, read only */
create or replace function public.cs_commissar_history(p_commissar integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v record;
    v_yes integer := 0;
    v_no integer := 0;
    v_ab integer := 0;
    v_priv integer := 0;
    v_votes jsonb;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select m.id, m.name, m.current_id into v from public.cs_commissars as m where m.id = p_commissar;
    if v.id is null then raise exception 'Unknown commissar'; end if;

    select
        count(*) filter (where x.vote = 'yes'),
        count(*) filter (where x.vote = 'no'),
        count(*) filter (where x.vote = 'abstain'),
        count(*) filter (where x.was_privileged)
    into v_yes, v_no, v_ab, v_priv
    from public.cs_votes as x
    where x.commissar_id = p_commissar;

    select coalesce(jsonb_agg(jsonb_build_object(
                'title', t.title,
                'vote', t.vote,
                'bribed', t.was_privileged,
                'status', t.status,
                'at', t.resolved_at
            ) order by t.id desc), '[]'::jsonb)
    into v_votes
    from (
        select x.vote, x.was_privileged, d.title, d.status, d.resolved_at, d.id
        from public.cs_votes as x
        join public.cs_directives as d on d.id = x.directive_id
        where x.commissar_id = p_commissar
        order by d.id desc
        limit 12
    ) as t;

    return jsonb_build_object(
        'member', v.id,
        'name', v.name,
        'yes', coalesce(v_yes, 0),
        'no', coalesce(v_no, 0),
        'abstain', coalesce(v_ab, 0),
        'bribed', coalesce(v_priv, 0),
        'votes', v_votes
    );

end;
$function$;


-- ---------------------------------------------------------
-- 7. the plenum moves
-- ---------------------------------------------------------

create or replace function public.cs_debate_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    d record;
    v_side record;
    v_total integer;
    v_need integer;
    v_yes integer;
    v_winning boolean;
    v_was boolean;
    v_boost numeric;
begin

    if auth.uid() is null then return; end if;
    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then return; end if;
    if public.game_frozen() then return; end if;

    select * into st from public.cs_state as s where s.id = 1;

    if st.online_at is null or now() - st.online_at > interval '150 seconds' then return; end if;

    if not pg_try_advisory_xact_lock(7770020) then return; end if;

    if st.last_debate_at is not null and st.last_debate_at > now() - interval '15 seconds' then return; end if;

    update public.cs_state as s set last_debate_at = now() where s.id = 1;

    delete from public.cs_debate_sides as s
    where not exists (select 1 from public.cs_directives as x
                      where x.id = s.directive_id and x.status in ('introduction', 'debate'));

    select count(*) into v_total from public.cs_commissars as m where m.active;

    for d in
        select x.* from public.cs_directives as x
        where x.status in ('introduction', 'debate')
        order by x.id
    loop

        /* the ruling current's agenda, and a Combine with no fleet at all */
        v_boost := public.cs_boost(d.dtype, d.sponsor_current, st.secretary_current);

        /* everybody takes a side the first time the directive is looked at */
        if not exists (select 1 from public.cs_debate_sides as s where s.directive_id = d.id) then

            insert into public.cs_debate_sides (directive_id, commissar_id, side)
            select d.id, m.id,
                   case
                       when random() < least(100, public.cs_likelihood(m.current_id, m.loyalty, d.sponsor_current, d.dtype, st.confidence) + v_boost) / 100.0 then 'yes'
                       when random() < (least(100, public.cs_likelihood(m.current_id, m.loyalty, d.sponsor_current, d.dtype, st.confidence) + v_boost) + 25) / 100.0 then 'no'
                       else 'undecided'
                   end
            from public.cs_commissars as m
            where m.active
            on conflict (directive_id, commissar_id) do nothing;

            insert into public.cs_debate_standing (directive_id, winning)
            values (d.id, null)
            on conflict (directive_id) do nothing;

        end if;

        /* a few commissars cross the floor: the sponsoring current holds firmest */
        update public.cs_debate_sides as s
        set side = case
                when s.side = 'yes' then 'no'
                when s.side = 'no' then 'yes'
                else case when random() < 0.5 then 'yes' else 'no' end
            end,
            changed_at = now(),
            changes = s.changes + 1
        where s.directive_id = d.id
          and s.commissar_id in (
              select x.commissar_id
              from (
                  select s2.commissar_id,
                         case when m.current_id = d.sponsor_current then 0.03 else 0.07 end as p
                  from public.cs_debate_sides as s2
                  join public.cs_commissars as m on m.id = s2.commissar_id
                  where s2.directive_id = d.id
              ) as x
              where random() < x.p
              limit 8
          );

        v_need := case
            when d.dtype in ('fleet_construction', 'knightmare_construction', 'production_quota', 'fleet_revocation')
                then ceil(v_total * 3.0 / 5)::integer
            else floor(v_total / 2.0)::integer + 1 end;

        select count(*) filter (where s.side = 'yes') into v_yes
        from public.cs_debate_sides as s where s.directive_id = d.id;

        v_winning := v_yes >= v_need;

        select x.winning into v_was from public.cs_debate_standing as x where x.directive_id = d.id;

        update public.cs_debate_standing as x
        set winning = v_winning, changed_at = now()
        where x.directive_id = d.id;

        if v_was is not null and v_was is distinct from v_winning then
            perform public.cs_log(
                case when v_winning
                    then 'PLENO: o Soviete volta-se a favor de "' || d.title || '": ' || v_yes || ' de ' || v_need || ' votos prometidos.'
                    else 'PLENO: o Soviete volta-se contra "' || d.title || '": só ' || v_yes || ' de ' || v_need || ' votos prometidos.'
                end);
        end if;

    end loop;

end;
$function$;


-- ---------------------------------------------------------
-- 8. the vote, and what a passed directive does
-- ---------------------------------------------------------

create or replace function public.cs_execute(p_id integer)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    d record;
    v_planet text;
    v_credits numeric;
begin

    select * into d from public.cs_directives as x where x.id = p_id;
    if d.id is null then return ''; end if;

    if d.dtype = 'military_campaign' then

        insert into public.cs_authorizations (kind, planet) values ('war', d.planet);
        return 'Campanha aprovada contra ' || coalesce(d.planet, 'o alvo') || ': as frotas do Combine podem atacá-lo.';

    elsif d.dtype = 'fleet_construction' then

        insert into public.cs_authorizations (kind, player_id) values ('fleet', d.proposer_player);
        return 'Uma nova frota foi autorizada: construa-a no mapa galáctico.';

    elsif d.dtype = 'knightmare_construction' then

        insert into public.cs_authorizations (kind, player_id) values ('knightmare', d.proposer_player);
        return 'Um destacamento blindado foi autorizado: recrute-o para uma frota (a cadeia da Instalação Knightmare ainda é necessária).';

    elsif d.dtype = 'production_quota' then

        update public.cs_state as s
        set quota = least(2, s.quota + 1),
            confidence = greatest(0, s.confidence - 5)
        where s.id = 1;
        return 'Plano de produção elevado: 300-500 créditos a cada 15 minutos por nível (máximo 2); o Partido perde confiança.';

    elsif d.dtype = 'diplomacy' then

        update public.cs_state as s
        set relations = jsonb_set(s.relations, array[coalesce(d.target_faction, 'Independents')],
                                  to_jsonb(coalesce((s.relations ->> coalesce(d.target_faction, 'Independents'))::numeric, 0) + 10), true)
        where s.id = 1;
        return 'Emissários enviados aos ' || coalesce(d.target_faction, 'Independents') || ': as relações melhoram.';

    elsif d.dtype = 'fleet_revocation' then

        if d.fleet_id is null or not exists (select 1 from public.fleets as f where f.id::text = d.fleet_id) then
            return 'A frota não pôde ser desativada (ela não existe mais ou está em batalha).';
        end if;

        delete from public.fleets as f where f.id::text = d.fleet_id;

        update public.faction_treasury as ft set credits = ft.credits + 500 where ft.faction = 'Combine';
        select ft.credits into v_credits from public.faction_treasury as ft where ft.faction = 'Combine';

        return 'A frota foi desativada: 500 créditos de sucata.';
    end if;

    return '';

end;
$function$;


create or replace function public.cs_resolve(p_id integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    d record;
    st record;
    m record;
    v_total integer;
    v_need integer;
    v_yes integer := 0;
    v_no integer := 0;
    v_ab integer := 0;
    v_amt numeric;
    v_stance text;
    v_eff numeric;
    v_side text;
    v_vote text;
    v_was boolean;
    v_corr integer;
    v_l numeric;
    v_r numeric;
    v_loy numeric;
    v_closest integer;
    v_old text;
    v_new text;
    v_defect text[] := '{}';
    v_removed text[] := '{}';
    v_passed boolean;
    v_status text;
    v_effect text := '';
    v_delta numeric := 0;
    v_boost numeric := 0;
begin

    select * into d from public.cs_directives as x where x.id = p_id for update;
    if d.id is null or d.status not in ('introduction', 'debate') then return null; end if;

    select * into st from public.cs_state as s where s.id = 1;
    select count(*) into v_total from public.cs_commissars as c where c.active;

    /* the ruling current's agenda, and a Combine with no fleet at all */
    v_boost := public.cs_boost(d.dtype, d.sponsor_current, st.secretary_current);

    v_need := case
        when d.dtype in ('fleet_construction', 'knightmare_construction', 'production_quota', 'fleet_revocation')
            then ceil(v_total * 3.0 / 5)::integer
        else floor(v_total / 2.0)::integer + 1 end;

    for m in select * from public.cs_commissars as c where c.active order by c.id loop

        v_was := false;
        v_corr := m.corruption_level;
        v_side := null;

        select coalesce(sum(p.amount), 0), max(p.stance) into v_amt, v_stance
        from public.cs_privileges as p where p.directive_id = d.id and p.commissar_id = m.id;

        if v_amt > 0 then
            v_eff := (v_amt / 1000.0) * (1 - m.loyalty / 100.0);
            if random() < v_eff then
                v_was := true;
                v_corr := v_corr + 5 + floor(random() * 11)::integer;
            end if;
        end if;

        if v_was then
            v_vote := v_stance;
        else
            select s.side into v_side
            from public.cs_debate_sides as s
            where s.directive_id = d.id and s.commissar_id = m.id;

            if v_side is not null then
                v_vote := case v_side when 'undecided' then 'abstain' else v_side end;
            else
                v_l := least(100, public.cs_likelihood(m.current_id, m.loyalty, d.sponsor_current, d.dtype, st.confidence) + v_boost);
                v_r := random();
                if v_r < v_l / 100.0 then v_vote := 'yes';
                elsif v_r < (v_l + 25) / 100.0 then v_vote := 'no';
                else v_vote := 'abstain';
                end if;
            end if;
        end if;

        if v_vote = 'yes' then v_yes := v_yes + 1;
        elsif v_vote = 'no' then v_no := v_no + 1;
        else v_ab := v_ab + 1;
        end if;

        insert into public.cs_votes (directive_id, commissar_id, vote, was_privileged, likelihood)
        values (d.id, m.id, v_vote, v_was, v_l);

        if v_was then

            update public.cs_commissars as c
            set corruption_level = v_corr, privileges_taken = c.privileges_taken + 1
            where c.id = m.id;

            if v_corr > 75 and not m.is_disgraced then
                update public.cs_commissars as c set is_disgraced = true where c.id = m.id;
                v_removed := v_removed || m.name;
            end if;

        end if;

        /* a commissar can lose their faith in the line */
        if random() < 0.02 then
            v_loy := m.loyalty - (5 + floor(random() * 11));
            if v_loy < 30 then
                select c.id into v_closest from public.cs_currents as c
                where c.id <> m.current_id
                order by sqrt(power(c.alignment_x - m.alignment_x, 2) + power(c.alignment_y - m.alignment_y, 2))
                limit 1;
                select c.name into v_old from public.cs_currents as c where c.id = m.current_id;
                select c.name into v_new from public.cs_currents as c where c.id = v_closest;
                update public.cs_commissars as c set current_id = v_closest, loyalty = 75 where c.id = m.id;
                v_defect := v_defect || (m.name || ': ' || v_old || ' → ' || v_new);
            else
                update public.cs_commissars as c set loyalty = v_loy where c.id = m.id;
            end if;
        end if;

    end loop;

    v_passed := v_yes >= v_need;
    v_status := case when v_passed then 'passed' else 'rejected' end;

    if v_passed then v_effect := public.cs_execute(d.id); end if;        /* the Party's confidence: a win or a loss for the leadership */
    if d.source = 'player' then
        v_delta := case
            when v_passed then (case d.dtype when 'military_campaign' then 1 when 'fleet_construction' then 3
                                    when 'knightmare_construction' then 3 when 'diplomacy' then 2 else 2 end)
            when v_status = 'rejected' then (case d.dtype when 'military_campaign' then -2 when 'fleet_construction' then -2
                                    when 'knightmare_construction' then -2 when 'diplomacy' then -2 else 0 end)
            else 0 end;
        if v_delta <> 0 then
            update public.cs_state as s set confidence = greatest(0, least(100, s.confidence + v_delta)) where s.id = 1;
        end if;
    end if;

    update public.cs_directives as x
    set status = v_status, yes_votes = v_yes, no_votes = v_no, abstain_votes = v_ab,
        required_votes = v_need, resolved_at = now(),
        result = jsonb_build_object('effect', v_effect, 'defections', to_jsonb(v_defect),
                                    'removed', to_jsonb(v_removed), 'total', v_total)
    where x.id = d.id;

    perform public.cs_log(
        case v_status when 'passed' then 'APROVADA' else 'REJEITADA' end
        || ': "' || d.title || '" (' || v_yes || ' sim, ' || v_no || ' não, ' || v_ab || ' abstenções; ' || v_need || ' necessários). ' || v_effect);

    delete from public.cs_debate_sides as s where s.directive_id = d.id;
    delete from public.cs_debate_standing as x where x.directive_id = d.id;

    return jsonb_build_object('status', v_status, 'yes', v_yes, 'no', v_no, 'abstain', v_ab, 'required', v_need);

end;
$function$;


-- ---------------------------------------------------------
-- 9. putting a directive before the Soviet
-- ---------------------------------------------------------

create or replace function public.cs_submit(p_type text, p_planet text default null, p_fleet text default null, p_target text default null, p_current text default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_current integer;
    v_live integer;
    v_limit integer;
    v_title text;
    v_sponsor integer;
    v_player_faction text;
    v_name text;
    v_id integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;
    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    select p.faction into v_player_faction from public.players as p where p.id = me;
    if coalesce(v_player_faction, '') <> 'Combine' then
        raise exception 'Only Combine players sit in the Supreme Soviet';
    end if;

    if p_type not in ('military_campaign', 'fleet_construction', 'knightmare_construction',
                      'production_quota', 'diplomacy', 'fleet_revocation') then
        raise exception 'Unknown directive';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    v_limit := case when st.secretary_player = me then 5 else 3 end;

    select count(*) into v_live from public.cs_directives as d
    where d.status in ('introduction', 'debate') and d.proposer_player = me;
    if v_live >= v_limit then
        raise exception 'You already have % directives before the Soviet', v_live;
    end if;

    /* the sponsoring current: the one that speaks for the player, or the one asked for */
    if p_current is not null then
        select c.id into v_sponsor from public.cs_currents as c where c.key = p_current;
    end if;
    if v_sponsor is null then
        select m.current_id into v_sponsor from public.cs_membership as m where m.player_id = me;
    end if;
    if v_sponsor is null then
        select c.id into v_sponsor from public.cs_currents as c
        where p_type = any (c.priorities) order by c.id limit 1;
    end if;
    v_sponsor := coalesce(v_sponsor, 1);

    v_name := coalesce(public.cs_player_name(me), 'Comrade');

    v_title := case p_type
        when 'military_campaign' then 'Campanha militar contra ' || coalesce(p_planet, '?')
        when 'fleet_construction' then 'Cota de nova frota'
        when 'knightmare_construction' then 'Destacamento blindado'
        when 'production_quota' then 'Plano de produção: elevar a cota'
        when 'diplomacy' then 'Pacto fraterno com os ' || coalesce(nullif(p_target, ''), 'Independents')
        when 'fleet_revocation' then 'Reatribuir e desmontar a frota "' || coalesce(p_fleet, '?') || '"'
        else initcap(replace(p_type, '_', ' ')) end;

    /* a campaign needs a planet that is not ours, and no campaign for the same planet already open */
    if p_type = 'military_campaign' then
        if coalesce(p_planet, '') = '' then raise exception 'Choose a planet for the campaign'; end if;
        if exists (select 1 from public.cs_directives as d
                   where d.dtype = 'military_campaign' and d.planet = p_planet and d.status in ('introduction', 'debate')) then
            raise exception 'A campaign against % is already before the Soviet', p_planet;
        end if;
        if exists (select 1 from public.cs_authorizations as a
                   where a.kind = 'war' and a.planet = p_planet and not a.used) then
            raise exception 'The Soviet has already authorised a campaign against %', p_planet;
        end if;
    end if;

    if p_type = 'fleet_revocation' then
        if not exists (select 1 from public.fleets as f where f.id::text = p_fleet and f.faction = 'Combine') then
            raise exception 'That is not a Combine fleet';
        end if;
    end if;

    if p_type = 'production_quota' then
        if st.quota >= 2 then raise exception 'The production quota is already at its highest level'; end if;
        if exists (select 1 from public.cs_directives as d
                   where d.dtype = 'production_quota' and d.status in ('introduction', 'debate')) then
            raise exception 'A production quota is already before the Soviet';
        end if;
    end if;

    insert into public.cs_directives (dtype, title, sponsor_current, source, proposer_name, proposer_player,
                                      planet, fleet_id, target_faction)
    values (p_type, v_title, v_sponsor, 'player', v_name, me,
            nullif(p_planet, ''), nullif(p_fleet, ''), nullif(p_target, ''))
    returning id into v_id;

    perform public.cs_log('DIRETIVA: ' || v_name || ' leva "' || v_title || '" ao Soviete.');

    return v_id;

end;
$function$;


/* cadre privileges: the Combine's answer to a bribe */
create or replace function public.cs_privilege(p_directive integer, p_commissar integer, p_amount numeric, p_stance text default 'yes')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    d record;
    m record;
    v_credits numeric;
    v_already numeric;
    v_total numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;
    if p_amount is null or p_amount < 100 then raise exception 'Cadre privileges start at 100 credits'; end if;
    if p_stance not in ('yes', 'no') then raise exception 'A privilege is granted for a yes or for a no'; end if;

    select * into d from public.cs_directives as x where x.id = p_directive;
    if d.id is null or d.status <> 'debate' then
        raise exception 'Cadre privileges can only be granted while the directive is debated';
    end if;

    select * into m from public.cs_commissars as c where c.id = p_commissar and c.active;
    if m.id is null then raise exception 'Unknown commissar'; end if;

    select coalesce(sum(p.amount), 0) into v_already
    from public.cs_privileges as p where p.directive_id = d.id and p.commissar_id = m.id;

    if v_already > 0 and (select p.stance from public.cs_privileges as p
                          where p.directive_id = d.id and p.commissar_id = m.id limit 1) <> p_stance then
        raise exception 'This commissar has already been granted privileges for the other side';
    end if;

    select ft.credits into v_credits from public.faction_treasury as ft where ft.faction = 'Combine' for update;
    if coalesce(v_credits, 0) < p_amount then
        raise exception 'The Combine treasury cannot pay % credits', p_amount;
    end if;

    update public.faction_treasury as ft set credits = ft.credits - p_amount where ft.faction = 'Combine';

    insert into public.cs_privileges (directive_id, commissar_id, player_id, amount, stance)
    values (d.id, m.id, me, p_amount, p_stance);

    v_total := v_already + p_amount;

    return jsonb_build_object('total', v_total, 'commissar', m.name, 'stance', p_stance);

end;
$function$;


/* the Central Committee's veto: once per term, from the General Secretary */
create or replace function public.cs_veto(p_directive integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    d record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cs_state as s where s.id = 1;
    if st.secretary_player is null or st.secretary_player <> me then
        raise exception 'Only the General Secretary may veto';
    end if;
    if st.veto_used then raise exception 'The veto of this term has been used'; end if;

    select * into d from public.cs_directives as x where x.id = p_directive for update;
    if d.id is null or d.status not in ('introduction', 'debate') then
        raise exception 'Only a live directive can be vetoed';
    end if;

    update public.cs_directives as x
    set status = 'rejected', resolved_at = now(),
        result = jsonb_build_object('effect', 'O Secretário-Geral vetou esta diretiva.', 'defections', '[]'::jsonb,
                                    'removed', '[]'::jsonb, 'total', 0)
    where x.id = d.id;

    update public.cs_state as s set veto_used = true where s.id = 1;

    delete from public.cs_debate_sides as s where s.directive_id = d.id;
    delete from public.cs_debate_standing as x where x.directive_id = d.id;

    perform public.cs_log('VETO: o Secretário-Geral ' || coalesce(st.secretary_name, '') || ' veta "' || d.title || '".');

end;
$function$;


-- ---------------------------------------------------------
-- 10. the Party: currents, candidacy, the vote
-- ---------------------------------------------------------

create or replace function public.cs_join_current(p_key text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_current integer;
    v_name text;
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select c.id into v_current from public.cs_currents as c where c.key = p_key;
    if v_current is null then raise exception 'Unknown current'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if coalesce(v_faction, '') <> 'Combine' then raise exception 'Only Combine players join a current'; end if;

    v_name := coalesce(public.cs_player_name(me), 'Comrade');

    insert into public.cs_membership (player_id, current_id, name)
    values (me, v_current, v_name)
    on conflict (player_id) do update set current_id = excluded.current_id, name = coalesce(excluded.name, public.cs_membership.name);

    perform public.cs_log('PARTIDO: ' || v_name || ' entra em ' || (select c.name from public.cs_currents as c where c.id = v_current) || '.');

end;
$function$;


create or replace function public.cs_run()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    e record;
    v_current integer;
    v_name text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into e from public.cs_election as x where x.phase = 'campaign' order by x.id desc limit 1;
    if e.id is null then raise exception 'No campaign is open'; end if;

    select m.current_id into v_current from public.cs_membership as m where m.player_id = me;
    if v_current is null then raise exception 'Join a current of the Party first'; end if;

    if exists (select 1 from public.cs_candidates as c where c.election_id = e.id and c.player_id = me) then
        raise exception 'You are already a candidate';
    end if;

    v_name := coalesce(public.cs_player_name(me), 'Comrade');

    insert into public.cs_candidates (election_id, player_id, name, current_id)
    values (e.id, me, v_name, v_current);

    perform public.cs_log('CANDIDATURA: ' || v_name || ' apresenta-se a Secretário-Geral.');

end;
$function$;


create or replace function public.cs_election_vote(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    e record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into e from public.cs_election as x where x.phase = 'voting' order by x.id desc limit 1;
    if e.id is null then raise exception 'No vote is open';
    end if;

    if not exists (select 1 from public.cs_candidates as c where c.election_id = e.id and c.player_id = p_candidate) then
        raise exception 'That is not a candidate';
    end if;

    if not exists (select 1 from public.cs_membership as m where m.player_id = me) then
        raise exception 'Join a current of the Party to vote';
    end if;

    insert into public.cs_election_votes (election_id, player_id, candidate_id)
    values (e.id, me, p_candidate)
    on conflict (election_id, player_id) do update set candidate_id = excluded.candidate_id, created_at = now();

end;
$function$;


/* the election's clock and its winner */
create or replace function public.cs_election_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    e record;
    v_win record;
    v_tie boolean;
begin

    select * into st from public.cs_state as s where s.id = 1;
    select * into e from public.cs_election as x where x.phase <> 'done' order by x.id desc limit 1;

    /* a term that has run out, or no Secretary at all: a campaign opens */
    if e.id is null then

        if (st.secretary_player is null or st.term_end is null or st.term_end <= now())
           and (st.last_election_at is null or st.last_election_at < now() - interval '2 minutes')
           and now() - coalesce(st.online_at, now()) < interval '150 seconds' then

            insert into public.cs_election (phase, campaign_end, vote_end)
            values ('campaign', now() + interval '8 minutes', now() + interval '16 minutes');

            update public.cs_state as s set last_election_at = now() where s.id = 1;

            perform public.cs_log('ELEIÇÃO: uma campanha para Secretário-Geral foi aberta. Entre em uma corrente do Partido, declare a candidatura (8 minutos) e então todos votam (8 minutos).');
        end if;

        return;

    end if;

    if e.phase = 'campaign' and now() >= e.campaign_end then

        if not exists (select 1 from public.cs_candidates as c where c.election_id = e.id) and now() < e.campaign_end + interval '5 minutes' then
            update public.cs_election as x set campaign_end = x.campaign_end + interval '5 minutes',
                                                vote_end = x.vote_end + interval '5 minutes'
            where x.id = e.id;
            perform public.cs_log('ELEIÇÃO: ninguém se candidatou ainda. A campanha foi prorrogada por 5 minutos.');
            return;
        end if;

        update public.cs_election as x set phase = 'voting' where x.id = e.id;
        perform public.cs_log('ELEIÇÃO: a votação está aberta. Todo jogador do Combine que entrou em uma corrente pode votar.');
        return;

    end if;

    if e.phase = 'voting' and now() >= e.vote_end then

        select c.player_id, c.name, c.current_id, count(v.player_id) as votes
        into v_win
        from public.cs_candidates as c
        left join public.cs_election_votes as v on v.candidate_id = c.player_id and v.election_id = e.id
        where c.election_id = e.id
        group by c.player_id, c.name, c.current_id
        order by count(v.player_id) desc, c.name
        limit 1;

        if v_win.player_id is null then
            update public.cs_election as x set phase = 'done', note = 'Nenhum candidato.' where x.id = e.id;
            perform public.cs_log('ELEIÇÃO: ninguém se apresentou. O cargo continua vago.');
            return;
        end if;

        update public.cs_state as s
        set secretary_player = v_win.player_id,
            secretary_name = v_win.name,
            secretary_current = v_win.current_id,
            term_no = s.term_no + 1,
            term_end = now() + interval '14 days',
            veto_used = false
        where s.id = 1;

        update public.cs_election as x
        set phase = 'done', winner_id = v_win.player_id, winner_name = v_win.name,
            note = 'Eleito com ' || v_win.votes || ' voto(s).'
        where x.id = e.id;

        perform public.cs_log('ELEIÇÃO: ' || v_win.name || ' é eleito Secretário-Geral do Combine (' || v_win.votes || ' voto(s)).');

        return;

    end if;

end;
$function$;


-- ---------------------------------------------------------
-- 11. directives the Party brings on its own
-- ---------------------------------------------------------

create or replace function public.cs_npc_directive()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    v_live integer;
    v_kind integer;
    v_try integer;
    v_planet text;
    v_target text;
    v_fleet_id text;
    v_fleet_name text;
    v_current integer;
    v_type text;
    v_title text;
    v_name text;
    v_fleets integer;
    v_ok boolean;
begin

    select * into st from public.cs_state as s where s.id = 1;

    if st.last_npc_at is not null and now() - st.last_npc_at < interval '240 seconds' then return; end if;

    update public.cs_state as s set last_npc_at = now() where s.id = 1;

    select count(*) into v_live from public.cs_directives as d where d.status in ('introduction', 'debate');
    if v_live >= 4 then return; end if;

    for v_try in 1..8 loop

        v_kind := 1 + floor(random() * 5)::integer;
        v_ok := false;
        v_fleet_id := null;
        v_fleet_name := null;
        v_planet := null; v_target := null; v_current := 1; v_name := null;

        if v_kind = 1 then

            select p.name into v_planet
            from public.planets as p
            where exists (select 1 from public.cities as c where c.planet_id = p.id and c.faction is distinct from 'Combine')
              and not exists (select 1 from public.cs_authorizations as a where a.kind = 'war' and a.planet = p.name and not a.used)
            order by random() limit 1;

            if v_planet is not null then
                v_ok := true; v_type := 'military_campaign'; v_current := 3;
                v_title := 'Campanha militar contra ' || v_planet;
            end if;

        elsif v_kind = 2 then

            if st.quota < 2 and not exists (select 1 from public.cs_directives as d
                                            where d.dtype = 'production_quota' and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'production_quota'; v_current := 1;
                v_title := 'Plano de produção: elevar a cota';
            end if;

        elsif v_kind = 3 then

            v_target := (array['Freedom Authority', 'Independents'])[1 + floor(random() * 2)::integer];
            if not exists (select 1 from public.cs_directives as d
                           where d.dtype = 'diplomacy' and d.target_faction = v_target and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'diplomacy'; v_current := 1;
                v_title := 'Pacto fraterno com os ' || v_target;
            end if;

        elsif v_kind = 4 then

            if not exists (select 1 from public.cs_directives as d
                           where d.dtype = 'fleet_construction' and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'fleet_construction'; v_current := 2;
                v_title := 'Cota de nova frota';
            end if;

        else

            select count(*) into v_fleets from public.fleets as f
            where f.faction = 'Combine' and coalesce(f.status::text, '') not in ('building', 'engaged');

            if v_fleets >= 4 then
                select f.id::text, f.name into v_fleet_id, v_fleet_name from public.fleets as f
                where f.faction = 'Combine' and coalesce(f.status::text, '') not in ('building', 'engaged')
                  and not exists (select 1 from public.cs_directives as d
                                  where d.dtype = 'fleet_revocation' and d.fleet_id = f.id::text and d.status in ('introduction', 'debate'))
                order by random() limit 1;

                if v_fleet_id is not null then
                    v_ok := true; v_type := 'fleet_revocation'; v_current := 2;
                    v_title := 'Reatribuir e desmontar a frota "' || coalesce(v_fleet_name, 'sem nome') || '"';
                end if;
            end if;

        end if;

        if v_ok then
            /* the current that brought it signs it, in its own name */
            select c.name into v_name from public.cs_currents as c where c.id = v_current;
            v_name := coalesce(v_name, 'O Partido');
            insert into public.cs_directives (dtype, title, sponsor_current, source, proposer_name, proposer_player, planet, fleet_id, target_faction)
            values (v_type, v_title, v_current, 'npc', v_name, null, v_planet, v_fleet_id, v_target);
            perform public.cs_log('DIRETIVA: ' || v_name || ' leva "' || v_title || '" ao Soviete.');
            return;
        end if;

    end loop;

end;
$function$;


-- ---------------------------------------------------------
-- 12. the tick the screen calls
-- ---------------------------------------------------------

create or replace function public.cs_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    g record;
    d record;
    v_income bigint;
begin

    if auth.uid() is null then return; end if;
    if not exists (select 1 from public.game_control as x where x.id = 1 and x.started) then return; end if;
    if public.game_frozen() then return; end if;

    update public.cs_state as s set online_at = now() where s.id = 1;
    select * into st from public.cs_state as s where s.id = 1;

    /* 1. the clock: a directive moves on when its phase is over */
    for d in
        select x.* from public.cs_directives as x
        where x.status in ('introduction', 'debate')
          and case when x.status = 'introduction' then x.debate_at <= now() else x.vote_at <= now() end
        order by x.id
    loop
        if d.status = 'introduction' then
            update public.cs_directives as x set status = 'debate' where x.id = d.id;
            perform public.cs_log('DEBATE: o Soviete começa a debater "' || d.title || '".');
        else
            perform public.cs_resolve(d.id);
        end if;
    end loop;

    /* 2. the plenum moves */
    perform public.cs_debate_tick();

    /* 3. the Party brings its own directives */
    perform public.cs_npc_directive();

    /* 4. the General Secretary */
    perform public.cs_election_tick();

    /* 5. the production quota pays out every 15 minutes */
    if st.quota > 0 and st.online_at is not null then

        if st.last_quota_at is null then
            update public.cs_state as s set last_quota_at = now() where s.id = 1;
        elsif st.last_quota_at <= now() - interval '15 minutes' then

            v_income := 0;
            while st.last_quota_at <= now() - interval '15 minutes' loop
                v_income := v_income + 300 + floor(random() * 201)::integer;
                st.last_quota_at := st.last_quota_at + interval '15 minutes';
            end loop;

            if v_income > 0 then
                update public.faction_treasury as ft set credits = ft.credits + v_income * st.quota where ft.faction = 'Combine';
                perform public.cs_log('PLANO: ' || (v_income * st.quota) || ' créditos produzidos pelos mundos do Combine.');
            end if;

            update public.cs_state as s set last_quota_at = st.last_quota_at where s.id = 1;
        end if;

    end if;

end;
$function$;


-- ---------------------------------------------------------
-- 13. the Soviet's teeth
--     (a Combine attack and a Combine fleet need a directive)
-- ---------------------------------------------------------

create or replace function public.cs_can_attack(p_planet text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then return true; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    /* only the Combine is held to the Soviet */
    if coalesce(v_faction, '') <> 'Combine' then return true; end if;

    return exists (
        select 1 from public.cs_authorizations as a
        where a.kind = 'war' and a.planet = p_planet and not a.used
    );

end;
$function$;


/* does the Soviet hold an unspent fleet quota for this player? (the screen
   asks this before it opens the fleet card, so the answer is friendly) */
create or replace function public.cs_can_build_fleet()
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then return false; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if coalesce(v_faction, '') <> 'Combine' then return true; end if;

    return exists (
        select 1 from public.cs_authorizations as a
        where a.kind = 'fleet' and (a.player_id = me or a.player_id is null) and not a.used
    );

end;
$function$;


/* the same fleet routine as before, with the Soviet's quota demanded from the
   Combine (the price of the fleet itself does not change) */
create or replace function public.create_fleet(fleet_name text, fleet_faction text, fleet_origin text, fleet_squads jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
    current_player uuid;
    v_faction text;
    v_credits bigint;
    v_built integer;
    v_price integer;
    new_fleet_id uuid;
    v_auth integer;
begin

    current_player := auth.uid();

    if current_player is null then
        raise exception 'Not authenticated';
    end if;

    select p.faction into v_faction
    from public.players as p where p.id = current_player;

    if v_faction is null then
        raise exception 'Player account not found';
    end if;

    perform public.collect_faction_income();

    select ft.credits, ft.fleets_built
    into v_credits, v_built
    from public.faction_treasury as ft
    where ft.faction = v_faction
    for update;

    if v_credits is null then
        raise exception 'Faction treasury not found';
    end if;

    v_price := 500 * (1 + v_built);

    /* Freedom Authority: Congress must have authorised the fleet (and was paid for it) */
    if v_faction = 'Freedom Authority' then

        select a.id into v_auth from public.cg_authorizations as a
        where a.kind = 'fleet'
          and (a.player_id = current_player or a.player_id is null)
          and not a.used
        order by a.id limit 1 for update;

        if v_auth is null then
            raise exception 'Congress has not authorized a new fleet: put "Authorize New Fleet Construction" before Congress first';
        end if;

        update public.cg_authorizations as a
        set used = true, used_at = now(), player_id = coalesce(a.player_id, current_player)
        where a.id = v_auth;

        v_price := 0;
    end if;

    /* Combine: the Supreme Soviet must have approved a fleet quota */
    if v_faction = 'Combine' then

        select a.id into v_auth from public.cs_authorizations as a
        where a.kind = 'fleet'
          and (a.player_id = current_player or a.player_id is null)
          and not a.used
        order by a.id limit 1 for update;

        if v_auth is null then
            raise exception 'The Supreme Soviet has not authorised a new fleet: put a "Cota de nova frota" directive before it first';
        end if;

        update public.cs_authorizations as a
        set used = true, used_at = now(), player_id = coalesce(a.player_id, current_player)
        where a.id = v_auth;

    end if;

    if v_credits < v_price then
        raise exception 'Not enough credits: the next fleet costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price,
        fleets_built = ft.fleets_built + 1
    where ft.faction = v_faction;

    insert into public.fleets (
        player_id, name, faction, origin, destination,
        status, departure_time, arrival_time, squads
    )
    values (
        current_player, fleet_name, fleet_faction, fleet_origin, null,
        'building', null, now() + interval '1 minute', fleet_squads
    )
    returning id into new_fleet_id;

    return new_fleet_id;

end;
$function$;


-- ---------------------------------------------------------
-- 14. row level security, so nothing leaks between players
-- ---------------------------------------------------------

alter table public.cs_currents enable row level security;
alter table public.cs_commissars enable row level security;
alter table public.cs_state enable row level security;
alter table public.cs_directives enable row level security;
alter table public.cs_privileges enable row level security;
alter table public.cs_votes enable row level security;
alter table public.cs_log enable row level security;
alter table public.cs_authorizations enable row level security;
alter table public.cs_membership enable row level security;
alter table public.cs_election enable row level security;
alter table public.cs_candidates enable row level security;
alter table public.cs_election_votes enable row level security;
alter table public.cs_debate_sides enable row level security;
alter table public.cs_debate_standing enable row level security;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cs_currents) as currents,
    (select count(*) from public.cs_commissars where active) as commissars,
    public.cs_majority() as majority,
    public.cs_qualified() as qualified,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cs_overview', 'cs_tick', 'cs_submit', 'cs_privilege', 'cs_resolve',
                             'cs_debate_view', 'cs_debate_tick', 'cs_can_attack')) as functions,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'create_fleet') as fleet_rule;
