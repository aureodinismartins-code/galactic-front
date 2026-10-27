-- =========================================================
-- GALACTIC FRONT — a pacified world sends its people, and the
--                  Combine's fleet quota opens at three
--
-- Run in the Supabase SQL editor after 2026-11-09. Safe to run more than once.
--
-- Three rules:
--
--   * The Combine may field three fleets from the first minute of a war.
--     game_opening_quotas() hands the Soviet's own quotas to the fleet
--     book at the start of a game — and again after the reset button —
--     so the first three fleets never wait on a directive. An approved
--     quota directive still raises the ceiling, one fleet each.
--
--   * A world incorporated into the Union (stage 3 of the Soviet's
--     administration) sends one more commissar to the Soviet: the world
--     itself is their oblast, and they take their seat in a current
--     drawn at random.
--
--   * A world integrated into the Authority (stage 3 of the Congress's
--     occupation) sends two more delegates to Congress, seated in a
--     party drawn at random.
--
-- Both awards hang off triggers on the occupation books, so they fire
-- whichever tick advanced the stage — the server's own, a relief order
-- or the reset — and they fire once per world per pacification.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the fleet quota a war opens with
-- ---------------------------------------------------------

create or replace function public.cs_fleet_floor()
returns integer
language sql
immutable
as $function$ select 3 $function$;


/*
   The Soviet grants its own opening quotas. Called when a war starts and
   after the reset, it tops the Combine's fleet book up to three: three
   fleets in service plus the quotas still unspent. A commander who
   already owns three fleets gets nothing, so calling it twice in the
   same war changes nothing.
*/
create or replace function public.game_opening_quotas()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_fleets integer := 0;
    v_open integer := 0;
    v_grant integer;
    v_made integer := 0;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    /* a database without the Soviet's fleet book keeps the game's own
       rules and says so instead of failing */
    if to_regclass('public.cs_authorizations') is null or to_regclass('public.fleets') is null then
        return jsonb_build_object('granted', 0, 'floor', public.cs_fleet_floor());
    end if;

    select count(*) into v_fleets
    from public.fleets as f
    where f.faction = 'Combine'
      and coalesce(f.status::text, '') <> 'building';

    select count(*) into v_open
    from public.cs_authorizations as a
    where a.kind = 'fleet' and not a.used;

    v_grant := greatest(0, public.cs_fleet_floor() - v_fleets - v_open);

    while v_grant > 0 loop
        insert into public.cs_authorizations (kind, player_id) values ('fleet', null);
        v_grant := v_grant - 1;
        v_made := v_made + 1;
    end loop;

    if v_made > 0 then
        begin
            perform public.cs_log('PLANO: o Soviete abre a guerra com ' || public.cs_fleet_floor() ||
                                  ' cotas de frota (' || v_made || ' entregues agora).');
        exception when others then null;
        end;
    end if;

    return jsonb_build_object(
        'granted', v_made,
        'floor', public.cs_fleet_floor(),
        'fleets', v_fleets,
        'quotas', v_open + v_made
    );

end;
$function$;


-- ---------------------------------------------------------
-- 2. an incorporated world sends a commissar
-- ---------------------------------------------------------

create or replace function public.cs_pacified_award()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_current integer;
    v_current_name text;
    v_loyalty numeric := 55;
    v_seat integer := 0;
    v_name text;
    v_oblast text := coalesce(new.planet, 'Oblast Central');
    v_try integer := 0;
begin

    /* only the moment a world is incorporated into the Union */
    if coalesce(new.stage, 0) < 3 or coalesce(old.stage, 0) >= 3 then
        return new;
    end if;

    /* the currents are drawn from at random: the world's commissar takes
       whichever seat the plenary happens to give them */
    select c.id, c.name, coalesce(c.loyalty, 55)
    into v_current, v_current_name, v_loyalty
    from public.cs_currents as c
    order by random()
    limit 1;

    if v_current is null then return new; end if;

    select coalesce(max(m.seat), 0) into v_seat from public.cs_commissars as m;

    /* a name of the Party's own, and not one already sitting */
    loop
        v_try := v_try + 1;
        v_name := (array['Dmitri','Ivan','Yelena','Nadia','Sergei','Anya','Boris','Katya',
                         'Lev','Olga','Pyotr','Raisa','Sasha','Tamara','Viktor','Zoya',
                         'Anton','Galina','Roman','Irina','Nikolai','Vera','Fyodor','Larisa'])[1 + floor(random() * 24)::integer] || ' ' ||
                  (array['Volkov','Orlova','Kuznetsov','Sokolova','Medvedev','Belova','Raskolnikov','Mironova',
                         'Zaytsev','Polyakova','Trotsky','Kameneva','Dzerzhinsky','Krupskaya',
                         'Molotov','Zemlyachka','Kirov','Roshal','Ordzhonikidze','Vasileva'])[1 + floor(random() * 20)::integer];
        exit when v_try >= 8 or not exists (
            select 1 from public.cs_commissars as m where m.name = v_name and m.active
        );
    end loop;

    insert into public.cs_commissars (name, current_id, oblast, seat, loyalty,
                                      alignment_x, alignment_y, active)
    values (v_name, v_current, v_oblast, v_seat + 1, v_loyalty,
            round((random() * 2 - 1)::numeric, 2), round((random() * 2 - 1)::numeric, 2), true);

    begin
        perform public.cs_log('COMISSÁRIO: ' || v_oblast || ' incorporado à União envia ' || v_name ||
                              ' ao Soviete (' || coalesce(v_current_name, 'sem corrente') || ').');
    exception when others then null;
    end;

    return new;

end;
$function$;


do $do$
begin
    if to_regclass('public.cs_occupations') is not null
       and to_regclass('public.cs_commissars') is not null
       and to_regclass('public.cs_currents') is not null then
        execute 'drop trigger if exists cs_occupations_pacified on public.cs_occupations';
        execute 'create trigger cs_occupations_pacified after update of stage on public.cs_occupations ' ||
                'for each row execute function public.cs_pacified_award()';
    end if;
end
$do$;


-- ---------------------------------------------------------
-- 3. an integrated world sends two delegates
-- ---------------------------------------------------------

create or replace function public.cg_pacified_award()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_party integer;
    v_party_name text;
    v_seat integer := 0;
    v_name text;
    v_area integer;
    v_planet text := coalesce(new.planet, 'Unclaimed');
    i integer;
begin

    /* only the moment a world is integrated into the Authority */
    if coalesce(new.stage, 0) < 3 or coalesce(old.stage, 0) >= 3 then
        return new;
    end if;

    select coalesce(max(m.seat), 0) into v_seat from public.cg_members as m;

    /* two of them, each seated in a party drawn at random */
    for i in 1..2 loop

        select f.id, f.name into v_party, v_party_name
        from public.cg_factions as f
        order by random()
        limit 1;

        if v_party is null then return new; end if;

        v_name := (array['Amara','Bruno','Célia','Duarte','Elena','Fábio','Greta','Hugo',
                         'Inês','Jonas','Karina','Luís','Mira','Nuno','Olívia','Paulo'])[1 + floor(random() * 16)::integer] || ' ' ||
                  (array['Alves','Barros','Costa','Duarte','Esteves','Ferreira','Gomes','Henriques',
                         'Lopes','Marques','Nunes','Pereira','Rocha','Silva','Teixeira','Vieira'])[1 + floor(random() * 16)::integer];

        v_area := 1 + floor(random() * 9)::integer;

        /* the base game's own delegate table: the rich row is the one it
           reads, the short one is the fallback for an older shape */
        begin
            insert into public.cg_members (name, faction_id, region, area, seat, loyalty, active, planet)
            values (v_name, v_party, v_planet, v_area, v_seat + 1, 60, true, v_planet);
        exception when undefined_column then
            begin
                insert into public.cg_members (name, faction_id) values (v_name, v_party);
            exception when others then null;
            end;
        end;

        v_seat := v_seat + 1;

    end loop;

    begin
        perform public.cg_log('CONGRESSO: ' || v_planet ||
                              ' integrado à Autoridade envia dois delegados a mais ao Congresso.');
    exception when others then null;
    end;

    return new;

end;
$function$;


do $do$
begin
    if to_regclass('public.cg_occupations') is not null
       and to_regclass('public.cg_members') is not null
       and to_regclass('public.cg_factions') is not null then
        execute 'drop trigger if exists cg_occupations_pacified on public.cg_occupations';
        execute 'create trigger cg_occupations_pacified after update of stage on public.cg_occupations ' ||
                'for each row execute function public.cg_pacified_award()';
    end if;
end
$do$;


-- =========================================================
-- sanity output
-- =========================================================

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cs_fleet_floor', 'game_opening_quotas',
                             'cs_pacified_award', 'cg_pacified_award')) as new_functions,
    (select count(*) from information_schema.triggers
      where trigger_schema = 'public'
        and trigger_name in ('cs_occupations_pacified', 'cg_occupations_pacified')) as new_triggers,
    public.cs_fleet_floor() as fleet_floor;
