/* Does a bill card build itself in Portuguese when PT is selected?
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/card-pt-test.js */

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

const start = HTML.indexOf("function proposalsHtml() {");
const end = HTML.indexOf("\nfunction wireProposals()", start);

async function build(lang) {

    const dom = new JSDOM("<!doctype html><html><body><div id=\"tabbody\"></div></body></html>", {
        url: "https://example.test/congress.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });
    const w = dom.window;
    w.localStorage.setItem("gf_lang", lang);
    w.eval(I18N);
    await new Promise(r => setTimeout(r, 30));   /* i18n starts on DOMContentLoaded */

    w.$ = id => w.document.getElementById(id);
    w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    w.fmt = n => Number(n || 0).toLocaleString();
    w.mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    w.skew = 0;
    w.secondsLeft = ts => Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 1000));
    w.T = s => (typeof w.t === "function" ? w.t(s) : s);
    w.TYPES = { fleet_construction: { name: "Authorize New Fleet Construction", votes: "supermajority", cost: 2000, desc: "" } };
    w.selProposal = null;
    w.debate = null;   /* no live debate in these fixtures */
w.propState = { fleets: 3 };
    w.ov = {
        seats: 176, majority: 88, supermajority: 118, president: null, targets: [], my_fleets: [],
        factions: [
            { id: 1, name: "The Old Guard", color: "#c8a24a", seats: 40, loyalty: 62 },
            { id: 3, name: "Progressives", color: "#7a8cff", seats: 60, loyalty: 79 }
        ],
        proposals: [{
            id: 7, type: "fleet_construction", title: "Autorizar a construção de uma nova frota",
            status: "introduction", sponsor: 3, cost: 2000, proposer: "111Augimang", mine: false,
            by_president: false,
            debate_at: new Date(Date.now() + 162000).toISOString(),
            vote_at: new Date(Date.now() + 462000).toISOString(),
            forecast: [{ faction: 1, p: 51 }, { faction: 3, p: 79 }],
            bribes: [], yes: 0, no: 0, abstain: 0
        }]
    };

    w.eval(HTML.slice(HTML.indexOf("function factionById"), HTML.indexOf("\n", HTML.indexOf("function factionById"))));
    w.eval(HTML.slice(HTML.indexOf("/* which live bill the dome is showing"), HTML.indexOf("function renderLegend()")));   /* liveDebateFor helper */
w.eval(HTML.slice(start, end));

    const body = w.document.getElementById("tabbody");
    body.innerHTML = w.proposalsHtml();
    await new Promise(r => setTimeout(r, 60));   /* the page translator picks up new nodes */
    return body.textContent.replace(/\s+/g, " ");
}

(async function main() {

console.log("a bill card in Portuguese");

const pt = await build("pt");

check("the vote system is Portuguese", pt.indexOf("maioria qualificada") !== -1, pt.slice(0, 160));
check("the bill is free in Portuguese", pt.indexOf("grátis") !== -1, pt.slice(0, 200));
check("no price is shown", pt.indexOf("2,000 créditos") === -1 && pt.indexOf("2.000 créditos") === -1);
check("the proposer line is Portuguese", pt.indexOf("por 111Augimang") !== -1);
check("the sponsor line is Portuguese", pt.indexOf("apresentada por Progressives") !== -1);
check("the countdown is Portuguese", pt.indexOf("O debate abre em") !== -1);
check("the requirement is Portuguese", pt.indexOf("precisa de 118 de 176 votos") !== -1, pt);
check("the forecast is Portuguese", pt.indexOf("Previsão: cerca de") !== -1);
check("the fleet note is Portuguese", pt.indexOf("Estas barras já incluem a regra das primeiras frotas.") !== -1);
check("the price note is gone", pt.indexOf("Levar esta proposta ao Congresso") === -1);
check("the buttons are Portuguese",
    pt.indexOf("SELECIONAR PARA SUBORNAR DELEGADOS") !== -1, pt.slice(-200));
check("the status badge is Portuguese", pt.indexOf("APRESENTAÇÃO") !== -1);

console.log("and in English it stays English");

const en = await build("en");
check("English cards are unchanged", en.indexOf("supermajority") !== -1 && en.indexOf("Debate opens in") !== -1 &&
    en.indexOf("needs 118 of 176 votes") !== -1, en.slice(0, 220));
check("the stored Portuguese title is shown in English",
    en.indexOf("Authorize New Fleet Construction") !== -1, en.slice(0, 120));

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);

})();
