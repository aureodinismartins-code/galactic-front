/* Does the Supreme Soviet screen render its tabs, its plenum and its
   directives, in Portuguese and in English, with three currents?
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/soviet-page-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PAGE = HTML.slice(HTML.lastIndexOf("<script>") + 8, HTML.lastIndexOf("</script>"));

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + String(extra).slice(0, 300) + "]" : "")); }
}

const now = Date.now();
const iso = s => new Date(now + s * 1000).toISOString();

const currents = [
    { id: 1, key: "proletarian", name: "Vanguarda Proletária", color: "#c0272d", seats: 42, loyalty: 62, priorities: ["production_quota", "diplomacy"], description: "Conselhos de operários e soldados" },
    { id: 2, key: "apparatus", name: "Aparato do Partido", color: "#c08a2e", seats: 33, loyalty: 55, priorities: ["fleet_construction", "fleet_revocation"], description: "Engenheiros e planejadores" },
    { id: 3, key: "red_command", name: "Comando Vermelho", color: "#7a1f1f", seats: 25, loyalty: 74, priorities: ["military_campaign", "knightmare_construction"], description: "O exército" }
];

const commissars = [];
for (let i = 1; i <= 100; i++) {
    commissars.push({
        id: i, name: "Comissário " + i,
        faction: i <= 42 ? 1 : i <= 75 ? 2 : 3,
        region: "Oblast Central", area: null, seat: i,
        loyalty: 40 + (i % 40), planet: null, suspect: i === 7
    });
}

const overview = {
    now: new Date(now).toISOString(),
    credits: 12000,
    seats: 100,
    majority: 51,
    supermajority: 60,
    currents,
    commissars,
    directives: [
        {
            id: 5, title: "Cota de nova frota", type: "fleet_construction", sponsor: 2,
            status: "debate", debate_at: iso(-60), vote_at: iso(240), mine: true, by_secretary: false,
            proposer: "Comrade Volkov", yes: 0, no: 0, abstain: 0, required: 60,
            planet: null, fleet: null, target: null, result: null,
            privileges: [{ member: 12, amount: 500, stance: "yes" }],
            forecast: [{ faction: 1, p: 30 }, { faction: 2, p: 70 }, { faction: 3, p: 35 }]
        },
        {
            id: 4, title: "Campanha militar contra Veyrona", type: "military_campaign", sponsor: 3,
            status: "passed", debate_at: iso(-900), vote_at: iso(-600), mine: false, by_secretary: true,
            proposer: "Comando Vermelho", yes: 61, no: 30, abstain: 9, required: 51,
            planet: "Veyrona", fleet: null, target: null,
            result: { effect: "Campanha aprovada contra Veyrona: as frotas do Combine podem atacá-lo.", defections: [], removed: ["Comissário 90"] },
            privileges: [], forecast: []
        }
    ],
    targets: [
        { planet: "Krieg", owners: "Combine", declared: false },
        { planet: "Liberty City", owners: "Contested", declared: false },
        { planet: "Veyrona", owners: "Independents", declared: true },
        { planet: "Ultramars", owners: "Freedom Authority", declared: false }
    ],
    my_fleets: [{ id: "f1", name: "Frota Um" }],
    authorizations: { fleet: 1, knightmare: 0, war: ["Veyrona"] },
    fleets: { total: 2, mine: 1, building: 0, quotas: 1, max: 3, next_price: 500 },
    worlds: [
        { planet: "Krieg", held: 2, total: 2, others: "", income: 220, whole: true, declared: false, live: false,
          stage: 1, stability: 40, progress: 2, threshold: 40, integrated: false, relief_wait: 0 },
        { planet: "Liberty City", held: 1, total: 3, others: "Freedom Authority", income: 150, whole: false, declared: false, live: false,
          stage: null, stability: null, progress: null, threshold: null, integrated: false, relief_wait: null }
    ],
    planets: [
        { name: "Krieg", x: 70, y: 85, owner: "Combine", fleets: [{ name: "Frota Um", squads: 6 }] },
        { name: "Liberty City", x: 60, y: 30, owner: "Contested", fleets: [] },
        { name: "Veyrona", x: 30, y: 40, owner: "Independents", fleets: [] },
        { name: "Ultramars", x: 10, y: 19, owner: "Freedom Authority", fleets: [] }
    ],
    state: { popularity: 61, tax_level: 1, relations: { "Freedom Authority": -20, Independents: 10 }, credits: 12000 },
    president: { name: "Comrade Volkov", faction: 3, term_no: 1, term_end: iso(86400), veto_used: false, me: true },
    election: {
        phase: "campaign", campaign_end: iso(300), vote_end: iso(900),
        candidates: [{ player_id: "p1", name: "Comrade Volkov", faction: 3, mine: true }],
        voted: 0, voters: 2, my_vote: null
    },
    parties: [
        { faction: 1, players: [] }, { faction: 2, players: [] },
        { faction: 3, players: ["Comrade Volkov"] }
    ],
    my_party: 3,
    party_members: [{ faction: 3, name: "Comrade Volkov" }],
    last_election: { winner: "Comrade Orlova", result: { note: "Eleito com 2 voto(s)." } },
    log: [
        { at: iso(-300), text: "DIRETIVA: Comrade Volkov leva \"Cota de nova frota\" ao Soviete." },
        { at: iso(-280), text: "APROVADA: \"Campanha militar contra Veyrona\" (61 sim, 30 não, 9 abstenções; 51 necessários). Campanha aprovada contra Veyrona: as frotas do Combine podem atacá-lo." }
    ]
};

const debate = {
    proposals: [{
        id: 5, status: "debate", yes: 50, no: 37, undecided: 13,
        sides: Object.fromEntries(commissars.map(m => [String(m.id), m.id <= 50 ? "yes" : m.id <= 87 ? "no" : "undecided"])),
        factions: {
            "1": { yes: 30, no: 8, undecided: 4 },
            "2": { yes: 12, no: 15, undecided: 6 },
            "3": { yes: 8, no: 14, undecided: 3 }
        }
    }]
};

function makePage(lang, patch) {

    /* the page's own script waits until the stubs below are in place */
    const dom = new JSDOM(HTML.replace(/<script[\s\S]*?<\/script>/gi, ""), {
        url: "https://example.test/combine.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });

    const w = dom.window;
    w.localStorage.setItem("gf_lang", lang);
    w.GC_NO_BANNER = true;
    w.eval(I18N);

    /* the first relief lands, and the world then has to wait five minutes */
    let reliefSent = false;

    w.supabaseClient = {
        rpc: function(name) {
            if (name === "cs_overview") {
                const data = JSON.parse(JSON.stringify(overview));
                if (patch) { Object.assign(data, patch); }
                if (reliefSent) {
                    const k = (data.worlds || []).find(x => x.planet === "Krieg");
                    if (k) { k.stability = 50; k.relief_wait = 300; }
                }
                return Promise.resolve({ data: data, error: null });
            }
            if (name === "cs_relief") {
                reliefSent = true;
                return Promise.resolve({ data: { planet: "Krieg", stability: 50, stage: 1, threshold: 40, wait: 300 }, error: null });
            }
            if (name === "diplomacy_state") {
                return Promise.resolve({ data: {
                    now: new Date(now).toISOString(), me: "Combine", other: "Freedom Authority",
                    credits: 4820, cost: 500, wait: 300,
                    relations: { authority: 20, combine: 60, need: 50, dividend: 10, truce: true },
                    planets: [
                        { planet: "Veyrona", relation: 30, envoys: 3, wait: 120, theirs: 10 },
                        { planet: "Vraks", relation: 0, envoys: 0, wait: 0, theirs: 0 }
                    ]
                }, error: null });
            }
            if (name === "cs_debate_view") { return Promise.resolve({ data: JSON.parse(JSON.stringify(debate)), error: null }); }
            if (name === "cs_agitprop_state") {
                return Promise.resolve({ data: {
                    now: new Date(now).toISOString(), cooldown: 600, min: 1000, max: 10000, credits: 12000,
                    currents: {
                        "1": { last_at: iso(-300), runs: 1, spent: 1000 },
                        "2": { last_at: null, runs: 0, spent: 0 },
                        "3": { last_at: null, runs: 0, spent: 0 }
                    }
                }, error: null });
            }
            if (name === "cs_agitprop") {
                return Promise.resolve({ data: { current: 2, spent: 1000, heat: 5, flipped: 1, turned: "Comissário 90 (Comando Vermelho)", seats: 34, credits: 11000 }, error: null });
            }
            if (name === "cs_commissar_history") {
                return Promise.resolve({ data: { yes: 3, no: 1, abstain: 0, bribed: 1, votes: [{ title: "Cota de nova frota", vote: "yes", bribed: false, status: "passed", at: new Date(now).toISOString() }] }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        }
    };

    w.eval(PAGE);
    return w;

}

const strip = s => s.replace(/\s+/g, " ").trim();

const deadline = setTimeout(function() { console.log("TIMEOUT: the page test did not finish"); process.exit(1); }, 22000);

(async function main() {

  try {

    /* ---------- Portuguese ---------- */
    const w = makePage("pt");
    await new Promise(r => setTimeout(r, 120));

    const doc = w.document;
    const text = () => strip(doc.body.textContent);

    console.log("the screen in Portuguese");
    check("the title", text().indexOf("SOVIETE SUPREMO DO COMBINE") !== -1, text().slice(0, 120));
    check("the plenum heading", text().indexOf("O PLENO") !== -1);
    check("the header stats", text().indexOf("CONFIANÇA") !== -1 && text().indexOf("COTA") !== -1 && text().indexOf("ALTO COMISSÁRIO") !== -1);

    const tabs = [...doc.querySelectorAll(".tab")].map(el => el.textContent);
    check("the eleven tabs", tabs.join(" / ") === "DIRETIVAS / ALTO COMISSÁRIO / PARTIDO / NOVA DIRETIVA / AGITPROP / MUNDOS OCUPADOS / COMISSÕES / PODER SOVIÉTICO / NOTÍCIAS / PRIMEIRA PÁGINA / GUIA", tabs.join(" / "));
    check("the header shows the fleet quota",
        text().indexOf("FROTAS") !== -1 && text().indexOf("2 / 3") !== -1, text().slice(0, 220));

    const seats = doc.querySelectorAll("#hemi .seat");
    check("a hundred commissars in the dome", seats.length === 100, seats.length);

    const rings = doc.querySelectorAll("#hemi circle[pointer-events='none']");
    check("every decided commissar has a ring", rings.length === 87, rings.length);

    const legend = strip(doc.getElementById("legend").textContent);
    check("the legend names the three currents",
        legend.indexOf("Vanguarda Proletária") !== -1 && legend.indexOf("Aparato do Partido") !== -1 &&
        legend.indexOf("Comando Vermelho") !== -1, legend.slice(0, 200));
    check("with their seats", legend.indexOf("42") !== -1 && legend.indexOf("33") !== -1 && legend.indexOf("25") !== -1, legend.slice(0, 220));
    check("the legend shows the live tally", legend.indexOf("SIM 50") !== -1 && legend.indexOf("NÃO 37") !== -1 && legend.indexOf("INDECISOS 13") !== -1, legend.slice(-160));

    const card = strip(doc.getElementById("tabbody").textContent);
    check("the directive card is Portuguese", card.indexOf("DEBATE") !== -1 && card.indexOf("três quintos") !== -1 && card.indexOf("grátis") !== -1, card.slice(0, 200));
    check("the card shows the real tally, not a forecast",
        card.indexOf("SIM 50") !== -1 && card.indexOf("o plenário ainda se mexe") !== -1 && card.indexOf("Previsão") === -1, card.slice(0, 300));
    check("the per-current bars count sides", /Vanguarda Proletária30\/42/.test(card), card.slice(0, 400));
    check("the privileges already granted are listed", card.indexOf("Seus privilégios: 1 (500 créditos)") !== -1, card.slice(-260));
    check("a live quota directive states the ceiling it would raise",
        card.indexOf("FROTAS AGORA: 2 / 3") !== -1 && card.indexOf("um SIM eleva o máximo para 4") !== -1, card.slice(0, 600));
    check("the selection button", card.indexOf("SELECIONAR PARA CONCEDER PRIVILÉGIOS") !== -1, card.slice(-200));
    check("a decided directive explains itself", card.indexOf("Campanha aprovada contra Veyrona") !== -1 && card.indexOf("Escândalo: Comissário 90") !== -1, card.slice(-400));

    /* privileges need a directive selected first, as a player would do it */
    doc.querySelector('.sel-btn[data-d="5"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const selected = strip(doc.getElementById("tabbody").textContent);
    check("the directive is selected for privileges", selected.indexOf("SELECIONADA PARA PRIVILÉGIOS") !== -1, selected.slice(-200));

    /* the member card */
    const seat = doc.querySelector('#hemi .seat[data-i="11"]');
    seat.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const member = strip(doc.getElementById("member").textContent);
    check("a commissar's card", member.indexOf("Comissário 12") !== -1 && member.indexOf("DISCIPLINA") !== -1, member.slice(0, 160));
    check("his current is named", member.indexOf("Vanguarda Proletária") !== -1, member.slice(0, 200));
    check("the privilege controls", member.indexOf("PRIVILÉGIOS PARA:") !== -1 && member.indexOf("CONCEDER") !== -1, member.slice(0, 400));
    check("the chance and the risk", member.indexOf("Chance de os privilégios mudarem o voto:") !== -1 && member.indexOf("risco de escândalo:") !== -1, member);
    check("the voting record", member.indexOf("HISTÓRICO DE VOTOS") !== -1 && member.indexOf("SIM 3") !== -1, member.slice(-260));

    /* the other tabs */
    async function open(name) {
        doc.querySelector('.tab[data-t="' + name + '"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 60));
        return strip(doc.getElementById("tabbody").textContent);
    }

    const ag = await open("propaganda");
    check("the agitprop tab", ag.indexOf("Os escritórios de agitprop") !== -1 && ag.indexOf("TESOURO") !== -1, ag.slice(0, 300));
    check("every current is offered a campaign",
        ag.indexOf("Vanguarda Proletária") !== -1 && ag.indexOf("Aparato do Partido") !== -1 &&
        ag.indexOf("Comando Vermelho") !== -1 && ag.indexOf("CAMPANHA") !== -1, ag.slice(0, 600));
    check("a running campaign shows its clock", ag.indexOf("Ainda há uma campanha para esta corrente em curso:") !== -1, ag.slice(0, 700));
    check("the campaign that ran is counted", ag.indexOf("1 campanha") !== -1 && ag.indexOf("créditos gastos") !== -1, ag.slice(0, 700));

    const buttons = [...doc.querySelectorAll(".prop-btn")];
    check("four purses for each current, the busy one closed",
        buttons.length === 12 && buttons.filter(b => !b.disabled).length === 8, buttons.length + " buttons, " +
            buttons.filter(b => b.disabled).length + " closed");

    buttons.find(b => b.dataset.f === "2" && b.dataset.amt === "1000")
        .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const toastText = strip(doc.getElementById("toast").textContent);
    check("a campaign reports what it did",
        toastText.indexOf("Campanha de agitprop:") !== -1 && toastText.indexOf("comissário mudou de corrente") !== -1,
        toastText);

    const sec = await open("secretary");
    check("the High Commissar tab", sec.indexOf("Alto Comissário do Combine") !== -1 && sec.indexOf("Comrade Volkov") !== -1, sec.slice(0, 220));
    check("the powers of the office", sec.indexOf("pode manter 5 diretivas") !== -1);
    check("the election", sec.indexOf("Eleição do Alto Comissário") !== -1 && sec.indexOf("CAMPANHA") !== -1 &&
        sec.indexOf("VOCÊ É CANDIDATO") !== -1, sec.slice(0, 900));

    const party = await open("party");
    check("the Party tab is open at any time",
        party.indexOf("Sua corrente do Partido") !== -1 && party.indexOf("a qualquer momento") !== -1, party.slice(0, 320));
    check("the three currents, with their players",
        party.indexOf("Jogadores: Comrade Volkov") !== -1 && party.indexOf("Vanguarda Proletária") !== -1 &&
        party.indexOf("Aparato do Partido") !== -1 && party.indexOf("Comando Vermelho") !== -1, party.slice(0, 700));
    check("and where the player sits now", party.indexOf("Você senta com") !== -1, party.slice(-240));

    check("the last election in Portuguese", sec.indexOf("Última eleição") !== -1 && sec.indexOf("Eleito com 2 voto") !== -1, sec.slice(-200));

    const neu = await open("new");
    check("the directive form", neu.indexOf("O QUE O SOVIETE DEVE DECIDIR?") !== -1, neu.slice(0, 200));
    const options = [...doc.querySelectorAll("#n-type option")].map(o => o.textContent);
    check("the kinds of directive", options.indexOf("Campanha militar contra um planeta") !== -1 && options.indexOf("Cota de nova frota") !== -1, options.join(" | "));
    check("and no pact between two sides at war", options.indexOf("Pacto fraterno") === -1, options.join(" | "));
    check("the description of the chosen kind", neu.indexOf("Eleva o máximo em uma frota") !== -1, neu.slice(0, 300));
    check("a quota directive says what the ceiling becomes",
        neu.indexOf("FROTAS AGORA: 2 / 3") !== -1 && neu.indexOf("eleva o máximo para 4") !== -1, neu.slice(0, 400));
    check("a directive is free", neu.indexOf("CUSTO: grátis") !== -1 && neu.indexOf("VOTOS NECESSÁRIOS: 60 de 100 (três quintos)") !== -1, neu.slice(-400));
    check("the sponsoring current", neu.indexOf("QUAL CORRENTE APRESENTA A DIRETIVA?") !== -1 && neu.indexOf("esta é uma das prioridades deles") !== -1, neu.slice(-500));

    /* the planet picker for a campaign */
    doc.getElementById("n-type").value = "military_campaign";
    doc.getElementById("n-type").dispatchEvent(new w.Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const war = strip(doc.getElementById("tabbody").textContent);
    check("a campaign asks for a planet", war.indexOf("PLANETA A ATACAR") !== -1 && war.indexOf("Veyrona") !== -1, war.slice(0, 300));
    check("and a majority, not three fifths", war.indexOf("51 de 100 (maioria simples)") !== -1, war.slice(-400));

    const worlds = await open("worlds");
    /* the tab is laid out like the Authority's occupied tab: the map, then one
       card per world. No stat tiles and no wall of explanation above them. */
    check("the occupied worlds tab opens on the map, as the Authority's does",
        !!doc.querySelector("#tabbody svg.minimap") &&
        doc.querySelectorAll("#tabbody .tokens").length === 0 &&
        !!doc.querySelector("#tabbody").firstElementChild &&
        doc.querySelector("#tabbody").firstElementChild.classList.contains("card"),
        worlds.slice(0, 260));
    check("a world held whole shows its administration", worlds.indexOf("Krieg ADMINISTRAÇÃO MILITAR") !== -1 &&
        worlds.indexOf("2 de 2 cidades em mãos") !== -1, worlds.slice(0, 420));
    check("the four stages are drawn with the current one marked",
        doc.querySelectorAll("#tabbody .steps > div").length === 4 &&
        worlds.indexOf("OCUPADO") !== -1 && worlds.indexOf("COLETIVIZADO") !== -1 &&
        worlds.indexOf("INCORPORADO À UNIÃO") !== -1, worlds.slice(0, 500));
    check("with its stability against the stage's threshold",
        worlds.indexOf("ESTABILIDADE 40 / necessários 40") !== -1 && worlds.indexOf("PROGRESSO DO ESTÁGIO 2 / 5") !== -1, worlds.slice(0, 700));
    check("and relief sent straight to it, with no directive",
        worlds.indexOf("CONCEDER AJUDA (+10 estabilidade)") !== -1 &&
        doc.querySelector('#tabbody .relief-btn[data-p="Krieg"]') !== null, worlds.slice(-300));
    check("and nothing is explained above the cards",
        doc.querySelectorAll("#tabbody > .sub").length === 0, worlds.slice(0, 900));
    check("a contested world names the other holder and offers a campaign",
        worlds.indexOf("Liberty City DISPUTADO") !== -1 && worlds.indexOf("também em mãos de Freedom Authority") !== -1 &&
        worlds.indexOf("LEVAR UMA CAMPANHA AO SOVIETE") !== -1, worlds.slice(0, 700));

    const worldsMap = doc.querySelector("#tabbody svg.minimap");
    check("the occupied worlds come with a mini map", !!worldsMap, worlds.slice(0, 200));
    check("one dot for every planet, one ring for every world held",
        worldsMap && worldsMap.querySelectorAll(".mm-p").length === 4 &&
        worldsMap.querySelectorAll("circle[stroke-width='3']").length === 2,
        worldsMap ? worldsMap.querySelectorAll(".mm-p").length + " dots, " +
            worldsMap.querySelectorAll("circle[stroke-width='3']").length + " rings" : "no map");
    check("the map shows the administration stage, as the Congress map does",
        worldsMap && /2\/4/.test(worldsMap.textContent), worldsMap ? worldsMap.textContent.slice(0, 120) : "");
    check("and the legend explains the stages",
        worlds.indexOf("administração militar") !== -1 && worlds.indexOf("coletivizado") !== -1 &&
        worlds.indexOf("incorporado à União") !== -1 && worlds.indexOf("tracejado") !== -1, worlds.slice(-400));

    const tipBox = doc.getElementById("tip");
    doc.querySelector('#tabbody .mm-p[data-p="Krieg"]').dispatchEvent(new w.MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 20 }));
    check("hovering a world names the fleets of ours standing there",
        tipBox.style.display === "block" && tipBox.textContent.indexOf("Frota Um") !== -1 &&
        tipBox.textContent.indexOf("esquadrões") !== -1 && tipBox.textContent.indexOf("2 de 2 cidades em mãos") !== -1,
        tipBox.textContent);
    check("and its stage and stability",
        tipBox.textContent.indexOf("ADMINISTRAÇÃO MILITAR") !== -1 && tipBox.textContent.indexOf("ESTABILIDADE 40 / 40") !== -1,
        tipBox.textContent);
    check("it says who owns the world", tipBox.textContent.indexOf("Combine") !== -1, tipBox.textContent);

    doc.querySelector('#tabbody .mm-p[data-p="Ultramars"]').dispatchEvent(new w.MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 20 }));
    check("a planet with none of ours says so",
        tipBox.textContent.indexOf("Nenhuma frota nossa aqui") !== -1, tipBox.textContent);

    doc.querySelector('#tabbody .mm-p[data-p="Ultramars"]').dispatchEvent(new w.MouseEvent("mouseleave", { bubbles: true }));
    check("and the tooltip goes away", tipBox.style.display === "none", tipBox.style.display);

    doc.querySelector('.camp-btn[data-p="Liberty City"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const fromWorld = doc.getElementById("n-planet") ? doc.getElementById("n-planet").value : "";
    check("the campaign button carries the world to the form", fromWorld === "Liberty City", fromWorld);

    await open("worlds");
    doc.querySelector('#tabbody .relief-btn[data-p="Krieg"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    check("relief is granted from the world's card, and says so",
        strip(doc.getElementById("toast").textContent).indexOf("Ajuda enviada a Krieg: estabilidade 50 / 40.") !== -1,
        strip(doc.getElementById("toast").textContent));
    const afterRelief = strip(doc.getElementById("tabbody").textContent);
    check("the world then waits five minutes before the next relief",
        doc.querySelector('#tabbody .relief-btn[data-p="Krieg"]').disabled === true &&
        afterRelief.indexOf("enviada de novo em") !== -1 &&
        !!doc.querySelector("#tabbody .relief-cd"), afterRelief.slice(-400));

    await open("new");
    const typeOptions = [...doc.querySelectorAll("#n-type option")].map(o => o.value);
    check("consolidation is gone from the directives the Soviet votes on",
        typeOptions.indexOf("consolidation") === -1 && typeOptions.indexOf("diplomacy") === -1 && typeOptions.length === 5,
        typeOptions.join(","));

    const authority = await open("authority");
    check("the Soviet's authority tab", authority.indexOf("FROTAS EM SERVIÇO") !== -1 &&
        authority.indexOf("2 / 3") !== -1 && authority.indexOf("COTAS EM ESPERA") !== -1, authority.slice(0, 260));
    check("it states the maximum the Soviet permits",
        authority.indexOf("O Soviete permite 3 frotas: 2 em serviço e 1 cota(s) ainda não gasta(s).") !== -1, authority.slice(0, 500));
    check("and the price of the next fleet", authority.indexOf("A próxima frota custa 500 créditos") !== -1, authority.slice(0, 500));
    check("the quota button waits while a quota is already before the Soviet",
        authority.indexOf("JÁ HÁ UMA COTA NO SOVIETE") !== -1 && doc.getElementById("quota-go").disabled === true,
        authority.slice(-200));
    check("the war room lists the fronts", authority.indexOf("Sala de guerra") !== -1 &&
        authority.indexOf("Veyrona") !== -1 && authority.indexOf("APROVADA") !== -1, authority.slice(400, 900));
    check("the standing of the Party", authority.indexOf("PLANO DE PRODUÇÃO") !== -1 &&
        authority.indexOf("As três correntes") !== -1 && authority.indexOf("Vanguarda Proletária") !== -1, authority.slice(-500));

    const warMap = doc.querySelector("#tabbody svg.minimap");
    check("the war room has a mini map of the fronts", !!warMap, authority.slice(0, 200));
    check("every planet is on it", warMap && warMap.querySelectorAll(".mm-p").length === 4,
        warMap ? warMap.querySelectorAll(".mm-p").length : "no map");
    check("an approved campaign is crosshaired", warMap && warMap.querySelectorAll("path").length >= 1,
        warMap ? warMap.innerHTML.slice(0, 200) : "");
    check("the legend explains the map", authority.indexOf("clique num planeta") !== -1 &&
        authority.indexOf("seu alvo") !== -1 && authority.indexOf("GUERRA") !== -1, authority.slice(-320));

    doc.querySelector('#tabbody .mm-p[data-p="Ultramars"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    check("clicking a planet takes a campaign against it to the form",
        doc.getElementById("n-planet") && doc.getElementById("n-planet").value === "Ultramars",
        doc.getElementById("n-planet") ? doc.getElementById("n-planet").value : "no form");
    await open("authority");

    const news = await open("news");
    check("the record", news.indexOf("DIRETIVA: Comrade Volkov leva") !== -1 && news.indexOf("APROVADA:") !== -1, news.slice(0, 200));

    /* nothing English left */
    const english = ["Player", "Target:", "held by", "seats", "loyalty", "delegates", "STABILITY", "PROPOSE",
        "POPULARITY", "TAX LEVEL", "of ", "left", "VOTING", "YOUR VOTE", "not a priority", "credits spent",
        "DIRECTIVES", "SECRETARY", "GENERAL", "NEWS", "THE PLENUM", "CONFIDENCE", "QUOTA",
        "Proletarian", "Apparatus", "Red Command", "twothirds"];
    const leftovers = english.filter(word => text().indexOf(word) !== -1);
    check("no English left on the screen", leftovers.length === 0, leftovers.join(" | "));

    w.close();

    /* ---------- English ---------- */
    const e = makePage("en");
    await new Promise(r => setTimeout(r, 120));

    const en = strip(e.document.body.textContent);
    console.log("the same screen in English");
    check("the page is English", en.indexOf("SUPREME SOVIET OF THE COMBINE") !== -1 && en.indexOf("THE PLENUM") !== -1);
    check("the new tabs are read back in English",
        en.indexOf("OCCUPIED WORLDS") !== -1 && en.indexOf("SOVIET POWER") !== -1, en.slice(0, 400));
    check("the fleet quota is read back in English", en.indexOf("FLEETS") !== -1 && en.indexOf("2 / 3") !== -1, en.slice(0, 300));
    check("the currents are read back in English",
        en.indexOf("The Proletarian Vanguard") !== -1 && en.indexOf("The Party Apparatus") !== -1 && en.indexOf("Red Command") !== -1, en.slice(0, 500));
    check("the database's Portuguese is read back", en.indexOf("New fleet quota") !== -1, en.slice(0, 400));
    check("and so is what a directive did", en.indexOf("Campaign approved against Veyrona") !== -1, en.slice(-600));

    e.document.querySelector('.tab[data-t="news"]').dispatchEvent(new e.window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const newsEn = strip(e.document.getElementById("tabbody").textContent);
    check("and so are its log lines", newsEn.indexOf("DIRECTIVE: Comrade Volkov puts") !== -1 && newsEn.indexOf("PASSED:") !== -1, newsEn.slice(0, 500));
    e.document.querySelector('.tab[data-t="worlds"]').dispatchEvent(new e.window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const worldsEn = strip(e.document.getElementById("tabbody").textContent);
    check("the worlds are English too",
        worldsEn.indexOf("MILITARY ADMIN") !== -1 &&
        worldsEn.indexOf("STABILITY 40 / needed 40") !== -1 && worldsEn.indexOf("PUT A CAMPAIGN BEFORE THE SOVIET") !== -1 &&
        worldsEn.indexOf("GRANT RELIEF (+10 stability)") !== -1, worldsEn.slice(0, 500));

    e.document.querySelector('.tab[data-t="authority"]').dispatchEvent(new e.window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const authEn = strip(e.document.getElementById("tabbody").textContent);
    check("and so is the authority",
        authEn.indexOf("FLEETS IN SERVICE") !== -1 && authEn.indexOf("The Soviet permits 3 fleets") !== -1 &&
        authEn.indexOf("A QUOTA IS ALREADY BEFORE THE SOVIET") !== -1, authEn.slice(0, 500));
    check("no Portuguese left in the new tabs",
        !/PODER SOVIÉTICO|MUNDOS TOMADOS|FROTAS EM SERVIÇO|COTAS EM ESPERA|As três correntes|Sala de guerra|ADMINISTRAÇÃO MILITAR|COLETIVIZADO/i.test(worldsEn + " " + authEn),
        (worldsEn + " " + authEn).slice(0, 300));

    check("no Portuguese left", !/Cota de nova frota|APROVADA|Diretiva|Vanguarda|Aparato|Eleito com/i.test(en + " " + newsEn), newsEn.slice(0, 300));

    e.close();

    /* ---------- no worlds held: the map is left out ---------- */
    const none = makePage("pt", { worlds: [] });
    await new Promise(r => setTimeout(r, 120));
    none.document.querySelector('.tab[data-t="worlds"]').dispatchEvent(new none.window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const empty = strip(none.document.getElementById("tabbody").textContent);
    check("with no worlds held the ministry carries the Authority's note",
        !none.document.querySelector("#tabbody svg.minimap") &&
        empty.indexOf("O Combine não tem nenhum mundo ocupado") !== -1 &&
        empty.indexOf("incorporado à União") !== -1 &&
        empty.indexOf("mais um comissário daquele planeta") !== -1, empty.slice(0, 240));
    check("and no tallies or cards are drawn with it",
        empty.indexOf("MUNDOS TOMADOS") === -1 && empty.indexOf("MUNDOS INTEIROS") === -1 &&
        empty.indexOf("CONCEDER AJUDA") === -1, empty.slice(0, 240));
    none.close();

    clearTimeout(deadline);
    console.log("\n" + (failures ? failures + " check(s) failed" : "all checks passed"));
    process.exit(failures ? 1 : 0);

  }
  catch (err) {
    clearTimeout(deadline);
    console.log("CRASH: " + (err && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : err));
    process.exit(1);
  }

})();
