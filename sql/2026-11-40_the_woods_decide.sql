-- 2026-11-40 - the woods decide, and the camps take recruits
--
-- Two things the militia needed to be a real enemy rather than a bar
-- with a picture on it:
--
--   * a band is broken by winning in the woods, not by pressing a
--     button in the halls. rebel_assault_result() is what the battle
--     page calls when the shooting stops: a win breaks one band (the
--     oldest, as unrest_fight does), a loss costs the garrison blood
--     and leaves every band standing.
--
--   * every new band draws its recruits out of the garrison of the
--     world it rose on. The trigger below takes rebel_recruit_share()
--     of the troops in orbit the moment a band appears and puts those
--     men in the band, so a revolt nobody faces slowly bleeds the
--     occupation dry.
--
-- Safe to run twice: it only replaces functions and its own trigger.


-- ---------------------------------------------------------
-- 1. how many of the garrison a band takes with it
-- ---------------------------------------------------------

create or replace function public.rebel_recruit_share()
returns numeric
language sql
immutable
as $function$
    select 0.05::numeric
$function$;


-- ---------------------------------------------------------
-- 2. the band recruits itself out of the garrison
-- ---------------------------------------------------------

create or replace function public.rebel_steal_recruits()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_faction text;
    v_taken numeric := 0;
begin

    begin
        v_faction := public.crowd_world(new.planet);
    exception when others then
        return new;
    end;

    if v_faction is null then
        return new;
    end if;

    begin
        v_taken := public.crowd_hurt_garrison(v_faction, new.planet, public.rebel_recruit_share());
    exception when others then
        v_taken := 0;
    end;

    if coalesce(v_taken, 0) > 0 then

        update public.planet_rebels as r
        set soldiers = r.soldiers + round(v_taken)
        where r.id = new.id;

        begin
            if v_faction = 'Combine' then
                perform public.cs_log('RECRUTAS: o bando de ' || new.planet || ' levou ' ||
                                      round(v_taken) || ' homens da guarnicao para a milicia.');
            else
                perform public.cg_log('RECRUTAS: o bando de ' || new.planet || ' levou ' ||
                                      round(v_taken) || ' homens da guarnicao para a milicia.');
            end if;
        exception when others then null;
        end;

    end if;

    return new;

end;
$function$;

drop trigger if exists rebel_steal_recruits on public.planet_rebels;

create trigger rebel_steal_recruits
after insert on public.planet_rebels
for each row execute function public.rebel_steal_recruits();


-- ---------------------------------------------------------
-- 3. the battle page settles the fight in the woods
-- ---------------------------------------------------------

create or replace function public.rebel_assault_result(p_planet text, p_won boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_faction text := public.crowd_world(p_planet);
    v_bands integer;
    v_men numeric;
    v_g jsonb;
    v_troops numeric;
    v_broken integer := 0;
    v_lost numeric := 0;
    v_left integer;
    v_men_left numeric;
    v_delta integer := 0;
    v_word text;
    r record;
begin

    select count(*), coalesce(sum(rb.soldiers), 0) into v_bands, v_men
    from public.planet_rebels as rb where rb.planet = p_planet;

    if v_bands = 0 then
        raise exception 'No militia stands in the woods of %', p_planet;
    end if;

    v_g := public.planet_garrison(v_faction, p_planet);
    v_troops := coalesce((v_g ->> 'soldiers')::numeric, 0);

    if coalesce((v_g ->> 'fleets')::integer, 0) <= 0 or v_troops <= 0 then
        raise exception 'No troops of ours stand in orbit of %: bring a fleet before you go into the woods', p_planet;
    end if;

    if p_won then

        /* a win breaks one band, the oldest of them, as the halls break them */

        for r in select rb.id, rb.soldiers from public.planet_rebels as rb
                 where rb.planet = p_planet
                 order by rb.raised_at, rb.id
                 limit 1
        loop
            delete from public.planet_rebels as rb where rb.id = r.id;
            v_broken := 1;
        end loop;

        /* and the woods cost blood even in victory */

        v_lost := least(v_troops, round(v_men * 0.10));

    else

        v_lost := least(v_troops, round(v_men * 0.25));

    end if;

    perform public.crowd_hurt_garrison(v_faction, p_planet,
                                       least(1, v_lost / greatest(1, v_troops)));

    select count(*), coalesce(sum(rb.soldiers), 0) into v_left, v_men_left
    from public.planet_rebels as rb where rb.planet = p_planet;

    if p_won and v_left = 0 then
        update public.planet_unrest as u
        set unrest = greatest(0, u.unrest - 15),
            last_fight_at = now()
        where u.planet = p_planet;
        v_delta := -15;
    else
        update public.planet_unrest as u
        set last_fight_at = now()
        where u.planet = p_planet;
    end if;

    v_word := case when p_won then ' foi quebrada nos bosques'
                   else ' expulsou as tropas dos bosques' end;

    begin
        if v_faction = 'Combine' then
            perform public.cs_log('MATA: a milicia de ' || p_planet || v_word || ': ' ||
                                  round(v_lost) || ' soldados perdidos, ' ||
                                  v_left || ' bando(s) restantes.');
        else
            perform public.cg_log('MATA: a milicia de ' || p_planet || v_word || ': ' ||
                                  round(v_lost) || ' soldados perdidos, ' ||
                                  v_left || ' bando(s) restantes.');
        end if;
    exception when others then null;
    end;

    return jsonb_build_object('planet', p_planet,
                              'won', p_won,
                              'killed', round(v_men - v_men_left),
                              'lost', round(v_lost),
                              'broken', v_broken,
                              'bands', v_left,
                              'men', round(v_men_left),
                              'delta', v_delta);

end;
$function$;
