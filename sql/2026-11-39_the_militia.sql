/* =========================================================
   2026-11-39  THE MILITIA

   The rebels of 11-38 are not a garrison: they are a militia,
   villagers with hunting rifles standing in the woods of their
   own world. This gives that unit a name and a company strength
   the whole game agrees on, so the dock and the battle screen
   count militia squads like every other squad.

   One company is five hundred men. A band of fifteen hundred is
   three companies, which is what the halls report.

   Safe to run again: it only replaces the two functions below.
========================================================= */

/* the full strength of one division of each kind, militia included */
create or replace function public.fleet_squad_size(p_type text)
returns integer
language sql
immutable
as $function$
    select case p_type
        when 'Rifle' then 1000
        when 'MG' then 750
        when 'Assault' then 1000
        when 'AT' then 600
        when 'Sniper' then 400
        when 'Tank' then 200
        when 'Artillery' then 250
        when 'Militia' then 500
        when 'Knightmare' then 3
        else 1000
    end
$function$;


/* how many men one militia company is */
create or replace function public.rebel_company()
returns integer
language sql
immutable
as $function$
    select 500
$function$;


/* a body of men in the streets, told in companies (never zero when men stand) */
create or replace function public.rebel_companies(p_men numeric)
returns integer
language sql
immutable
as $function$
    select case when coalesce(p_men, 0) <= 0 then 0
                else ceil(coalesce(p_men, 0) / public.rebel_company())::integer end
$function$;
