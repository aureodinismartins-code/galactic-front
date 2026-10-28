/* Dump the Soviet page's visible text in each tab, both languages, so the
   leftovers can be read. Run: NODE_PATH=/tmp/h/node_modules node tmp-test/soviet-dump.js pt */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PAGE = HTML.slice(HTML.lastIndexOf("<script>") + 8, HTML.lastIndexOf("</script>"));

const now = Date.now(), iso = s => new Date(now + s * 1000).toISOString();

const currents = [
    { id: 1, key: "proletarian", name: "Vanguarda Proletária", color: "#c0272d", seats: 42, loyalty: 62, priorities: ["production_quota", "diplomacy"], description: "Conselhos de operários e soldados: o plano vem de baixo e a guerra é de todos" },
    { id: 2, key: "apparatus", name: "Aparato do Partido", color: "#c08a2e", seats: 33, loyalty: 55, priorities: ["fleet_construction", "fleet_revocation"], description: "Engenheiros, planejadores e burocratas: tudo se mede em toneladas e em ordens cumpridas" },
    { id: 3, key: "red_command", name: "Comando Vermelho", color: "#7a1f1f", seats: 25, loyalty: 74, priorities: ["military_campaign", "knightmare_construction"], description: "O exército fala no plenário, e fala alto" }
];

const commissars = [];
for (let i = 1; i <= 100; i++) {
    commissars.push({ id: i, name: "Comissário " + i, faction: i <= 42 ? 1 : i <= 75 ? 2 : 3, region: "Oblast Central", area: null, seat: i, loyalty: 40 + (i % 40), planet: null, suspect: i === 7 });
}

const ov = {
    now: new Date(now).toISOString(), credits: 12000, seats: 100, majority: 51, supermajority: 60,
    currents, commissars,
    directives: [
        { id: 5, title: "Cota de nova frota", type: "fleet_construction", sponsor: 2, status: "debate", debate_at: iso(-60), vote_at: iso(240), mine: true, by_secretary: false, proposer: "Comrade Volkov", yes: 0, no: 0, abstain: 0, required: 60, planet: null, fleet: null, target: null, result: null, privileges: [{ member: 12, amount: 500, stance: "yes" }], forecast: [] },
        { id: 4, title: "Campanha militar contra Veyrona", type: "military_campaign", sponsor: 3, status: "passed", debate_at: iso(-900), vote_at: iso(-600), mine: false, by_secretary: true, proposer: "Comando Vermelho", yes: 61, no: 30, abstain: 9, required: 51, planet: "Veyrona", fleet: null, target: null, result: { effect: "Campanha aprovada contra Veyrona: as frotas do Combine podem atacá-lo.", defections: ["Comissário 9: Aparato do Partido → Comando Vermelho"], removed: ["Comissário 90"] }, privileges: [], forecast: [] }
    ],
    targets: [{ planet: "Veyrona", owners: "Independents", declared: true }, { planet: "Krieg", owners: "Combine", declared: false }],
    my_fleets: [{ id: "f1", name: "Frota Um" }],
    authorizations: { fleet: 1, knightmare: 0, war: ["Veyrona"] },
    state: { popularity: 61, tax_level: 1, relations: { "Freedom Authority": -20, Independents: 10 }, credits: 12000 },
    president: { name: "Comrade Volkov", faction: 3, term_no: 1, term_end: iso(86400), veto_used: false, me: true },
    election: { phase: "campaign", campaign_end: iso(300), vote_end: iso(900), candidates: [{ player_id: "p1", name: "Comrade Volkov", faction: 3, mine: true }], voted: 0, voters: 2, my_vote: null },
    parties: [{ faction: 1, players: [] }, { faction: 2, players: ["Comrade Orlova"] }, { faction: 3, players: ["Comrade Volkov"] }],
    my_party: 3,
    party_members: [{ faction: 3, name: "Comrade Volkov" }],
    last_election: { winner: "Comrade Orlova", result: { note: "Eleito com 2 voto(s)." } },
    log: [
        { at: iso(-300), text: "DIRETIVA: Comrade Volkov leva \"Cota de nova frota\" ao Soviete." },
        { at: iso(-280), text: "PARTIDO: Comrade Orlova entra em Aparato do Partido." },
        { at: iso(-200), text: "APROVADA: \"Campanha militar contra Veyrona\" (61 sim, 30 não, 9 abstenções; 51 necessários). Campanha aprovada contra Veyrona: as frotas do Combine podem atacá-lo." }
    ]
};

const debate = {
    proposals: [{
        id: 5, status: "debate", yes: 50, no: 37, undecided: 13,
        sides: Object.fromEntries(commissars.map(m => [String(m.id), m.id <= 50 ? "yes" : m.id <= 87 ? "no" : "undecided"])),
        factions: { "1": { yes: 30, no: 8, undecided: 4 }, "2": { yes: 12, no: 15, undecided: 6 }, "3": { yes: 8, no: 14, undecided: 3 } }
    }]
};

const lang = process.argv[2] || "pt";
const dom = new JSDOM(HTML.replace(/<script[\s\S]*?<\/script>/gi, ""), { url: "https://example.test/combine.html", runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem("gf_lang", lang);
w.eval(I18N);
w.supabaseClient = {
    rpc: n => Promise.resolve({
        data: n === "cs_overview" ? JSON.parse(JSON.stringify(ov)) : n === "cs_debate_view" ? JSON.parse(JSON.stringify(debate))
            : { yes: 3, no: 1, abstain: 0, bribed: 1, votes: [{ title: "Cota de nova frota", vote: "yes", bribed: false, status: "passed", at: iso(-100) }] },
        error: null
    })
};
w.eval(PAGE);

const stamp = s => String(s).replace(/\s+/g, " ").trim();

setTimeout(() => {
    const doc = w.document;
    const seat = doc.querySelector('#hemi .seat[data-i="11"]');
    if (seat) { seat.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); }
    setTimeout(() => {
        console.log("[header] " + stamp(doc.getElementById("top").textContent));
        console.log("[legend] " + stamp(doc.getElementById("legend").textContent));
        console.log("[member] " + stamp(doc.getElementById("member").textContent));
        for (const t of ["directives", "secretary", "new", "news"]) {
            const b = doc.querySelector('.tab[data-t="' + t + '"]');
            if (b) { b.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); }
            console.log("\n[" + t + "] " + stamp(doc.getElementById("tabbody").textContent));
        }
        process.exit(0);
    }, 250);
}, 250);
