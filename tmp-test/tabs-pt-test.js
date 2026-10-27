/* Do the three remaining Congress tabs read Portuguese when PT is selected?
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/tabs-pt-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "congress.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test/congress.html",
    runScripts: "dangerously",
    pretendToBeVisual: true
});
const w = dom.window;
w.localStorage.setItem("gf_lang", "pt");
w.eval(I18N);

w.$ = id => w.document.getElementById(id);
w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
w.fmt = n => Number(n || 0).toLocaleString();
w.mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
w.skew = 0;
w.secondsLeft = ts => Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 1000));
w.toast = () => {};
w.T = s => w.t(s);
w.draft = { sponsor: "old_guard", planet: "", fleet: "", target: "Combine", type: "fleet_construction" };
w.warTarget = "Veyrona";

const factions = [
    { id: 1, key: "old_guard", name: "The Old Guard", color: "#c8a24a", seats: 40, loyalty: 62, priorities: ["military_action"], description: "Traditional e militarista" },
    { id: 2, key: "greens", name: "The Greens", color: "#5bff9a", seats: 30, loyalty: 55, priorities: [], description: "Foco ambiental" },
    { id: 3, key: "progressives", name: "Progressives", color: "#c85a4a", seats: 20, loyalty: 66, priorities: ["fleet_construction"], description: "Reformas" }
];

w.ov = {
    now: new Date().toISOString(),
    seats: 176, majority: 88, supermajority: 118,
    factions: factions,
    members: [], proposals: [], targets: [{ planet: "Veyrona", owners: "Independents", declared: false }],
    my_fleets: [], parties: [{ faction: 1, players: ["Ana"] }], my_party: 1,
    planets: [{ name: "Veyrona", x: 20, y: 30, owner: "Independents" }],
    occupations: [{ planet: "Veyrona", stage: 1, stage_name: "ocupado", seats: 2, seats_target: 4, stability: 40, threshold: 60, progress: 2, duration: 9 }],
    authorizations: { fleet: 1, knightmare: 0, war: [] },
    state: { popularity: 61, tax_level: 1, relations: { Combine: -10, Independents: 20 } },
    president: { name: "Ana", faction: 1, me: true, term_no: 3, term_end: new Date(Date.now() + 86400000).toISOString(), veto_used: false },
    election: {
        phase: "voting", campaign_end: new Date(Date.now() + 60000).toISOString(),
        vote_end: new Date(Date.now() + 600000).toISOString(),
        candidates: [{ player_id: "p1", name: "Ana", faction: 1, mine: true }, { player_id: "p2", name: "Rui", faction: 2, mine: false }],
        voted: 2, voters: 5, my_vote: null
    }
};

w.propState = { credits: 4820, cooldown: 600, fleets: 2, factions: { "1": { runs: 2, spent: 3500, last_at: new Date(Date.now() - 120000).toISOString() } } };

/* the two chairs, and the unrest of a taken world */
w.speaker = {
    mine: true,
    speaker: { name: "Bia Costa", party: "Progressives", term_no: 1,
        term_end: new Date(Date.now() + 600000).toISOString(), veto_used: false, me: true },
    election: null,
    last: null
};
w.unrest = { turn: 300, revolt_at: 100,
    worlds: [{ planet: "Veyrona", faction: "Freedom Authority", unrest: 62, mood: "RIOTING", revolts: 1 }] };

const slice = (a, b) => HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a)));
w.eval(HTML.slice(HTML.indexOf("function factionById"), HTML.indexOf("\n", HTML.indexOf("function factionById"))));
w.eval(slice("/* ---- mini map of the galaxy", "/* ---- new proposal ----"));
w.eval(slice("/* ---- the Congress Leader: the player the players elected ---- */", "function wireLeader()"));
w.eval(slice("/* ---- the party: yours to join or change at any time, election or not ---- */", "function wireParty()"));
w.eval(slice("/* ---- occupied worlds ---- */", "function wireOccupied()"));
w.eval(slice("/* ---- authority ---- */", "function wireAuthority()"));
/* the kind of bill table and the screen that offers it share a scope */
w.eval(slice("const TYPES", "let ov = null;") + "\n" + slice("/* ---- new proposal ---- */", "function wireNew()"));
w.eval(slice("/* ---- propaganda ---- */", "function wirePropaganda()"));

(async function main() {

await new Promise(r => setTimeout(r, 40));   /* i18n starts on DOMContentLoaded */

/* put each tab on the page so the static sentences are translated too,
   exactly as they are when the tab is opened */
async function render(html) {
    const box = w.document.createElement("div");
    box.id = "tab-" + Math.random().toString(36).slice(2);
    box.innerHTML = html;
    w.document.body.appendChild(box);
    await new Promise(r => setTimeout(r, 60));
    const text = box.textContent.replace(/\s+/g, " ");
    box.remove();
    return text;
}

const leader = await render(w.leaderHtml());
const party = await render(w.partyHtml());

const occupied = await render(w.occupiedHtml());
const authority = await render(w.authorityHtml());
const proposal = await render(w.newHtml());
const propaganda = await render(w.propagandaHtml());

console.log("the two chairs, in Portuguese");
check("the faction leader's chair", leader.indexOf("PRESIDENTE DA FREEDOM AUTHORITY") !== -1 &&
    leader.indexOf("O líder da facção") !== -1, leader.slice(0, 200));
check("mandate line", leader.indexOf("mandato 3") !== -1 && leader.indexOf("o mandato termina em") !== -1, leader.slice(0, 240));
check("the faction leader's powers", leader.indexOf("5 propostas no Congresso") !== -1, leader.slice(0, 400));
check("the Congress's own chair is the Speaker", leader.indexOf("ORADOR DO CONGRESSO") !== -1 &&
    leader.indexOf("Bia Costa") !== -1 && leader.indexOf("a casa e detém o seu veto") !== -1, leader.slice(-320));
check("candidacy badge", leader.indexOf("VOTAÇÃO") !== -1);
check("votes cast", leader.indexOf("2 de 5 membros de partido já votaram") !== -1, leader.slice(0, 400));
check("candidate marker", leader.indexOf("(você)") !== -1);
check("vote button", leader.indexOf("SEU VOTO") !== -1 || leader.indexOf("VOTAR") !== -1);

console.log("the party tab in Portuguese");
check("the party is joined at any time, not only in an election",
    party.indexOf("a qualquer momento") !== -1 && party.indexOf("Seu partido") !== -1, party.slice(0, 300));
check("party member counts", party.indexOf("Jogadores: Ana") !== -1, party.slice(0, 500));
check("where the player sits", party.indexOf("Você senta com") !== -1, party.slice(-200));

console.log("the occupied-worlds tab in Portuguese");
check("delegates seated", occupied.indexOf("2 de 4 delegados sentados") !== -1, occupied.slice(0, 200));
check("stability", occupied.indexOf("ESTABILIDADE 40 / necessários 60") !== -1);
check("stage names", occupied.indexOf("OCUPADO") !== -1 && occupied.indexOf("ADMINISTRAÇÃO CIVIL") !== -1);
check("stage progress", occupied.indexOf("PROGRESSO DO ESTÁGIO 2 / 9 turnos") !== -1);
check("relief button", occupied.indexOf("PROPOR AJUDA (+10 estabilidade)") !== -1, occupied.slice(-160));
check("the unrest bar", occupied.indexOf("AGITAÇÃO 62 / 100") !== -1 && occupied.indexOf("EM MOTIM") !== -1,
    occupied.slice(0, 400));

console.log("the authority tab in Portuguese");
check("target", authority.indexOf("Alvo: Veyrona") !== -1 && authority.indexOf("controlada por Independents") !== -1, authority.slice(0, 300));
check("priority note", authority.indexOf("a guerra é uma das prioridades deles") !== -1);
check("standing", authority.indexOf("POPULARIDADE 61%") !== -1 && authority.indexOf("NÍVEL DE IMPOSTOS 1 de 2") !== -1, authority.slice(0, 400));
check("relations", authority.indexOf("relações:") !== -1);
check("faction seats", authority.indexOf("(40 cadeiras)") !== -1);
check("the war room's rule", authority.indexOf("Só os jogadores apresentam uma declaração de guerra") !== -1, authority.slice(0, 400));
check("the war map legend", authority.indexOf("guerra declarada · azul = Freedom Authority") !== -1);

console.log("the new-proposal tab in Portuguese");
check("the kinds of bill", proposal.indexOf("Missão diplomática") !== -1 && proposal.indexOf("Recolhimento e desativação") !== -1, proposal.slice(0, 300));
check("the description of the chosen kind", proposal.indexOf("Aprova uma nova frota militar") !== -1, proposal.slice(0, 400));
check("a priority of the sponsor", proposal.indexOf("esta é uma das prioridades deles") !== -1);
check("a bill is free", proposal.indexOf("CUSTO: grátis") !== -1 && !/CUSTO:[^·]*[0-9]/.test(proposal), proposal.slice(-300));

console.log("the propaganda tab in Portuguese");
check("the faction line", propaganda.indexOf("40 delegados · 62% lealdade · 2 campanhas · 3,500 créditos gastos") !== -1, propaganda.slice(0, 500));
check("the campaign buttons", propaganda.indexOf("CAMPANHA 1,000") !== -1);

const english = ["Player", "Target:", "held by", "seats", "loyalty", "delegates seated",
    "STABILITY", "STAGE PROGRESS", "PROPOSE", "POPULARITY", "TAX LEVEL", "term ", "of ",
    "left", "VOTING", "YOUR VOTE", "not a priority", "delegates ", "campaign", "credits spent",
    "war declared", "Only players write", "Diplomatic Mission", "Military Asset"];
const all = { leader, party, occupied, authority, proposal, propaganda };
let leftovers = [];
Object.keys(all).forEach(function (k) {
    english.forEach(function (word) {
        if (all[k].indexOf(word) !== -1) { leftovers.push(k + ": " + word); }
    });
});
check("no English left in the three tabs", leftovers.length === 0, leftovers.join(" | "));

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);

})();
