-- =========================================================
-- GALACTIC FRONT — Portuguese, second pass: server text
--
-- Run this in the Supabase SQL editor, after
-- 2026-10-25_offline_income_and_freeze.sql.
-- Safe to run more than once.
--
-- The browser dictionary (i18n.js) can only translate text that
-- exists in the page. Everything the DATABASE writes is invisible
-- to it: Congress log lines, proposal titles, proposal results,
-- war log notes and the four faction descriptions.
--
-- This migration translates those at the moment they are stored,
-- with triggers, so no game function is redefined and no logic
-- changes:
--   cg_log.text        -> translated on insert/update
--   cg_proposals.title -> translated on insert/update
--   cg_proposals.result.effect -> translated on insert/update
--   war_log.note       -> translated on insert/update
--   cg_factions.description -> Portuguese for every party
--
-- Rows that already exist are translated once at the end.
-- Anything that does not match a known sentence is left exactly
-- as it is, so nothing can be broken by a wording change.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the sentence translator
-- ---------------------------------------------------------

create or replace function public.pt_text(p_text text)
returns text
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
    t text := p_text;
    m text[];
begin
    if t is null or t = '' then
        return t;
    end if;

    /* occupation stage names */
    if t = 'occupied' then return 'ocupado'; end if;
    if t = 'civilian administration' then return 'administração civil'; end if;
    if t = 'protected' then return 'protegido'; end if;
    if t = 'integrated' then return 'integrado'; end if;

    /* ---------- proposal titles ---------- */
    if t ~ '^Declaration of War on .+$' then
        return regexp_replace(t, '^Declaration of War on (.+)$', 'Declaração de Guerra contra \1');
    end if;

    if t = 'Authorize New Fleet Construction' then
        return 'Autorizar a construção de uma nova frota';
    end if;

    if t = 'Authorize New Fleet Construction (state initiative)' then
        return 'Autorizar a construção de uma nova frota (iniciativa do Estado)';
    end if;

    if t = 'Authorize Knightmare Squad Formation' then
        return 'Autorizar a formação de um esquadrão Knightmare';
    end if;

    if t = 'Authorize Knightmare Squad Formation (state initiative)' then
        return 'Autorizar a formação de um esquadrão Knightmare (iniciativa do Estado)';
    end if;

    if t = 'Emergency Economic Relief' then
        return 'Ajuda econômica de emergência';
    end if;

    if t ~ '^Emergency Economic Relief for .+$' then
        return regexp_replace(t, '^Emergency Economic Relief for (.+)$', 'Ajuda econômica de emergência para \1');
    end if;

    if t ~ '^Diplomatic Mission to the .+$' then
        return regexp_replace(t, '^Diplomatic Mission to the (.+)$', 'Missão diplomática para os \1');
    end if;

    if t = 'Taxation Increase Proposal' then
        return 'Proposta de aumento de impostos';
    end if;

    if t ~ '^Military Asset Recall: fleet ".*"$' then
        return regexp_replace(t, '^Military Asset Recall: fleet "(.*)"$', 'Recolhimento de ativo militar: frota "\1"');
    end if;

    /* ---------- proposal results (cg_execute) ---------- */
    if t ~ '^Congress has declared war on .+: Freedom Authority fleets may attack it\.$' then
        return regexp_replace(t, '^Congress has declared war on (.+): Freedom Authority fleets may attack it\.$',
            'O Congresso declarou guerra contra \1: as frotas da Freedom Authority podem atacá-lo.');
    end if;

    if t = 'A new fleet is authorised: build it from the galaxy map.' then
        return 'Uma nova frota foi autorizada: construa-a no mapa galáctico.';
    end if;

    if t = 'A Knightmare squad is authorised: recruit it into a fleet (the Knightmare Facility chain is still required).' then
        return 'Um esquadrão Knightmare foi autorizado: recrute-o em uma frota (a cadeia da Instalação Knightmare ainda é necessária).';
    end if;

    if t = 'Economic relief for all occupied worlds: stability +10.' then
        return 'Ajuda econômica para todos os mundos ocupados: estabilidade +10.';
    end if;

    if t ~ '^Economic relief for .+: stability \+10\.$' then
        return regexp_replace(t, '^Economic relief for (.+): stability \+10\.$', 'Ajuda econômica para \1: estabilidade +10.');
    end if;

    if t ~ '^Envoys sent to the .+: relations improve\.$' then
        return regexp_replace(t, '^Envoys sent to the (.+): relations improve\.$', 'Enviados à \1: as relações melhoram.');
    end if;

    if t = 'Taxes raised: 300-500 credits every 15 minutes per tax level; the Authority loses popularity.' then
        return 'Impostos aumentados: 300-500 créditos a cada 15 minutos por nível de imposto; a Autoridade perde popularidade.';
    end if;

    if t ~ '^The fleet ".*" is decommissioned: 500 credits of salvage\.$' then
        return regexp_replace(t, '^The fleet "(.*)" is decommissioned: 500 credits of salvage\.$',
            'A frota "\1" foi desativada: 500 créditos de sucata.');
    end if;

    if t = 'The fleet could not be recalled (it no longer exists or is in battle).' then
        return 'A frota não pôde ser recolhida (ela não existe mais ou está em batalha).';
    end if;

    if t ~ '^Congress approved, but the Authority could not pay [0-9]+ credits\.$' then
        return regexp_replace(t, '^Congress approved, but the Authority could not pay ([0-9]+) credits\.$',
            'O Congresso aprovou, mas a Autoridade não conseguiu pagar \1 créditos.');
    end if;

    if t = 'The President vetoed this proposal.' then
        return 'O Presidente vetou esta proposta.';
    end if;

    /* ---------- congress log ---------- */
    if t ~ '^PROPOSAL: .+ puts ".*" before Congress\.$' then
        m := regexp_match(t, '^PROPOSAL: (.+) puts "(.*)" before Congress\.$');
        return format('PROPOSTA: %s leva "%s" ao Congresso.', m[1], public.pt_text(m[2]));
    end if;

    if t ~ '^PROPOSAL: .+ propose ".*"\.$' then
        m := regexp_match(t, '^PROPOSAL: (.+) propose "(.*)"\.$');
        return format('PROPOSTA: %s propõe "%s".', m[1], public.pt_text(m[2]));
    end if;

    if t ~ '^(PASSED|REJECTED|NO FUNDS): ".*" \(.*\)\.?.*$' then
        m := regexp_match(t, '^(PASSED|REJECTED|NO FUNDS): "(.*)" \(([0-9]+) yes, ([0-9]+) no, ([0-9]+) abstain; ([0-9]+) needed\)\.? ?(.*)$');
        if m is not null then
            return format('%s: "%s" (%s sim, %s não, %s abstenções; %s necessários). %s',
                case m[1] when 'PASSED' then 'APROVADA' when 'REJECTED' then 'REJEITADA' else 'SEM FUNDOS' end,
                public.pt_text(m[2]), m[3], m[4], m[5], m[6], public.pt_text(m[7]));
        end if;
    end if;

    if t ~ '^SCANDAL: delegate .+ exposed for corruption and removed\. .+ takes the seat\.$' then
        m := regexp_match(t, '^SCANDAL: delegate (.*) exposed for corruption and removed\. (.*) takes the seat\.$');
        return format('ESCÂNDALO: o delegado %s foi flagrado em corrupção e removido. %s assume a cadeira.', m[1], m[2]);
    end if;

    if t ~ '^SCANDAL: a bribery network is exposed\. .+$' then
        m := regexp_match(t, '^SCANDAL: a bribery network is exposed\. (.*) is removed, (.*) takes the seat\.$');
        return format('ESCÂNDALO: uma rede de subornos foi exposta. %s é removido, %s assume a cadeira.', m[1], m[2]);
    end if;

    if t ~ '^VETO: President .+ vetoes ".*"\.$' then
        m := regexp_match(t, '^VETO: President (.*) vetoes "(.*)"\.$');
        return format('VETO: o Presidente %s veta "%s".', m[1], public.pt_text(m[2]));
    end if;

    if t = 'The President has left the Freedom Authority: the office is vacant.' then
        return 'O Presidente deixou a Freedom Authority: o cargo está vago.';
    end if;

    if t ~ '^TAXES: [0-9]+ credits collected from the member worlds\.$' then
        return regexp_replace(t, '^TAXES: ([0-9]+) credits collected from the member worlds\.$',
            'IMPOSTOS: \1 créditos arrecadados dos mundos membros.');
    end if;

    if t ~ '^CAPTURED: .+ falls to the Freedom Authority and is placed under military occupation\.$' then
        return regexp_replace(t, '^CAPTURED: (.+) falls to the Freedom Authority and is placed under military occupation\.$',
            'CAPTURADO: \1 cai sob a Freedom Authority e entra em ocupação militar.');
    end if;

    if t ~ '^LOST: .+ is no longer held by the Authority\. Its delegates leave Congress\.$' then
        return regexp_replace(t, '^LOST: (.+) is no longer held by the Authority\. Its delegates leave Congress\.$',
            'PERDIDO: \1 não está mais sob o controle da Autoridade. Seus delegados deixam o Congresso.');
    end if;

    if t ~ '^OCCUPATION: .+ advances to .+\.$' then
        m := regexp_match(t, '^OCCUPATION: (.+) advances to (.+)\.$');
        return format('OCUPAÇÃO: %s avança para %s.', m[1], public.pt_text(m[2]));
    end if;

    if t ~ '^CONGRESS: .+ sends a delegate \([0-9]+ of [0-9]+ seats\)\.$' then
        m := regexp_match(t, '^CONGRESS: (.+) sends a delegate \(([0-9]+) of ([0-9]+) seats\)\.$');
        return format('CONGRESSO: %s envia um delegado (%s de %s cadeiras).', m[1], m[2], m[3]);
    end if;

    if t = 'Congress convenes: 176 delegates from 88 areas in 10 regions.' then
        return 'O Congresso se reúne: 176 delegados de 88 áreas em 10 regiões.';
    end if;

    if t ~ '^ELECTION: .+$' then
        if t = 'ELECTION: a presidential election is called. Join a party, then declare your candidacy (8 minutes), then all players vote (8 minutes).' then
            return 'ELEIÇÃO: uma eleição presidencial foi convocada. Entre em um partido, declare sua candidatura (8 minutos) e então todos os jogadores votam (8 minutos).';
        end if;
        if t = 'ELECTION: nobody has declared yet. The campaign is extended by 5 minutes.' then
            return 'ELEIÇÃO: ninguém se candidatou ainda. A campanha foi prorrogada por 5 minutos.';
        end if;
        if t = 'ELECTION: voting is open. Every Freedom Authority player who has joined a party may vote.' then
            return 'ELEIÇÃO: a votação está aberta. Todo jogador da Freedom Authority que entrou em um partido pode votar.';
        end if;
        m := regexp_match(t, '^ELECTION: (.*) is elected President of the Freedom Authority \((.*)\)\. ?(.*)$');
        if m is not null then
            return format('ELEIÇÃO: %s é eleito Presidente da Freedom Authority (%s). %s', m[1], m[2], m[3]);
        end if;
        return regexp_replace(t, '^ELECTION: ', 'ELEIÇÃO: ');
    end if;

    if t ~ '^.+ declares for President\.$' then
        return regexp_replace(t, '^(.+) declares for President\.$', '\1 declara candidatura à Presidência.');
    end if;

    if t ~ '^.+ joins (The Old Guard|The Greens|Progressives|Independents)\.$' then
        return regexp_replace(t, '^(.+) joins (The Old Guard|The Greens|Progressives|Independents)\.$', '\1 entra em \2.');
    end if;

    /* ---------- war log ---------- */
    if t ~ '^The assault on .+ succeeded\.$' then
        return regexp_replace(t, '^The assault on (.+) succeeded\.$', 'O assalto a \1 teve sucesso.');
    end if;

    if t ~ '^The assault on .+ was repelled\.$' then
        return regexp_replace(t, '^The assault on (.+) was repelled\.$', 'O assalto a \1 foi repelido.');
    end if;

    return t;
end;
$function$;


-- ---------------------------------------------------------
-- 2. the four faction descriptions
-- ---------------------------------------------------------

create or replace function public.pt_cg_faction()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
    new.description := case new.key
        when 'old_guard' then
            'Tradicional e militarista, com uma abordagem conservadora da expansão e do governo'
        when 'greens' then
            'Foco ambiental e diplomático, contrário à expansão agressiva'
        when 'progressives' then
            'Reformas progressistas e investimento em tecnologia e infraestrutura civil'
        when 'independents' then
            'Membros sem alinhamento, imprevisíveis, influenciados por argumentos ou subornos'
        else new.description
    end;
    return new;
end;
$function$;

drop trigger if exists pt_cg_faction_bi on public.cg_factions;
create trigger pt_cg_faction_bi
    before insert or update on public.cg_factions
    for each row execute function public.pt_cg_faction();


-- ---------------------------------------------------------
-- 3. store translated text as it is written
-- ---------------------------------------------------------

create or replace function public.pt_cg_log()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
    new.text := public.pt_text(new.text);
    return new;
end;
$function$;

drop trigger if exists pt_cg_log_bi on public.cg_log;
create trigger pt_cg_log_bi
    before insert or update on public.cg_log
    for each row execute function public.pt_cg_log();


create or replace function public.pt_cg_proposal()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
    new.title := public.pt_text(new.title);

    if new.result is not null and new.result ? 'effect' then
        new.result := jsonb_set(
            new.result,
            '{effect}',
            to_jsonb(public.pt_text(new.result ->> 'effect'))
        );
    end if;

    return new;
end;
$function$;

drop trigger if exists pt_cg_proposal_biu on public.cg_proposals;
create trigger pt_cg_proposal_biu
    before insert or update on public.cg_proposals
    for each row execute function public.pt_cg_proposal();


create or replace function public.pt_war_log()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
    new.note := public.pt_text(new.note);
    return new;
end;
$function$;

drop trigger if exists pt_war_log_bi on public.war_log;
create trigger pt_war_log_bi
    before insert or update on public.war_log
    for each row execute function public.pt_war_log();


-- ---------------------------------------------------------
-- 4. translate what is already stored
--
-- These tables carry the game_guard trigger, which refuses writes
-- while the game is under maintenance (or not started yet). The
-- backfill is not gameplay, so the triggers are disabled for the
-- duration of these statements and re-enabled immediately after.
-- DDL is transactional here, so an error rolls the disable back
-- instead of leaving a table unprotected.
-- ---------------------------------------------------------

alter table public.cg_log disable trigger user;
alter table public.war_log disable trigger user;
alter table public.cg_proposals disable trigger user;
alter table public.cg_factions disable trigger user;

update public.cg_log as l
set text = public.pt_text(l.text)
where l.text is not null
  and public.pt_text(l.text) is distinct from l.text;

update public.war_log as w
set note = public.pt_text(w.note)
where w.note is not null
  and public.pt_text(w.note) is distinct from w.note;

update public.cg_proposals as p
set title = public.pt_text(p.title)
where p.title is not null
  and public.pt_text(p.title) is distinct from p.title;

update public.cg_proposals as p
set result = jsonb_set(p.result, '{effect}', to_jsonb(public.pt_text(p.result ->> 'effect')))
where p.result is not null
  and p.result ? 'effect'
  and public.pt_text(p.result ->> 'effect') is distinct from (p.result ->> 'effect');

update public.cg_factions as f
set description = case f.key
        when 'old_guard' then 'Tradicional e militarista, com uma abordagem conservadora da expansão e do governo'
        when 'greens' then 'Foco ambiental e diplomático, contrário à expansão agressiva'
        when 'progressives' then 'Reformas progressistas e investimento em tecnologia e infraestrutura civil'
        when 'independents' then 'Membros sem alinhamento, imprevisíveis, influenciados por argumentos ou subornos'
        else f.description
    end
where f.key in ('old_guard', 'greens', 'progressives', 'independents');

alter table public.cg_log enable trigger user;
alter table public.war_log enable trigger user;
alter table public.cg_proposals enable trigger user;
alter table public.cg_factions enable trigger user;


-- ---------------------------------------------------------
-- 5. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cg_factions as f
      where f.description like '%militarista%' or f.description like '%ambiental%') as factions_translated,
    (select count(*) from public.cg_log as l where l.text like '%PROPOSTA:%' or l.text like '%IMPOSTOS:%') as log_lines_translated,
    (select count(*) from pg_trigger
      where tgname in ('pt_cg_log_bi', 'pt_cg_proposal_biu', 'pt_war_log_bi', 'pt_cg_faction_bi')) as triggers_installed;
