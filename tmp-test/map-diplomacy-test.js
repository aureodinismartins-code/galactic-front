/* Run the DIPLOMACY tab of the galactic map (the script block appended to
   galaxy.html) in jsdom, with the database stubbed, and check what a player
   actually gets:

     - the button exists for the two main factions and for nobody else;
     - with no ceasefire, three offers (15 / 30 / 60 minutes) and the note
       that nothing can last longer than an hour;
     - an offer from the other side shows ACCEPT / REFUSE and calls the
       right function with the right arguments;
     - a running ceasefire shows its clock and says the front is frozen;
     - the independent worlds list their embassies, keep the cooldown and
       send envoys;
     - a database without the patches says which file to run;
     - in Portuguese, the same panel reads Portuguese.

   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/map-diplomacy-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;

function msgText(tab) {
    const el = tab.querySelector(".dip-msg");
    return el ? el.textContent.replace(/\s+/g, " ") : "";
}

function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

/* the block the map page appends for the tab */
const START = "/* =========================================================\n   DIPLOMACY — the embassies";
const start = HTML.indexOf(START);
const end = HTML.indexOf("</script>", start);
const BLOCK = start === -1 ? "" : HTML.slice(start, end);

const OPTS = {
    embassies: {
        now: new Date().toISOString(),
        me: "Freedom Authority",
        other: "Combine",
        credits: 4820,
        cost: 500,
        wait: 300,
        relations: { authority: 20, combine: 10, truce: false },
        prices: { envoy: 500, rebel: 800, coup: 1500 },
        waits: { envoy: 300, rebel: 600, coup: 1200, lock: 1800 },
        minimums: { rebel: 10, coup: 40 },
        planets: [
            { planet: "Veyrona", cities: 2, relation: 40, level: "friendly", tint: 0.25, next: 50,
              envoys: 4, wait: 0, theirs: 10, theirs_level: "neutral", patron: "me", leaned: 0.25,
              locked: 0, armed: 0, couped: 0, tinder: 0, gate: false },
            { planet: "Kharos", cities: 1, relation: 10, level: "neutral", tint: 0, next: 25,
              envoys: 1, wait: 180, theirs: 35, theirs_level: "friendly", patron: "them", leaned: 0.25,
              locked: 0, armed: 120, couped: 0, tinder: 15, gate: true }
        ]
    },
    ceasefire_none: {
        now: new Date().toISOString(), me: "Freedom Authority", mine: true,
        min_minutes: 5, max_minutes: 60, answer_window: 600, waiting: 0,
        active: null, offer: null, last: []
    },
    ceasefire_offer_mine: {
        me: "Freedom Authority", mine: true, min_minutes: 5, max_minutes: 60, answer_window: 600, waiting: 0,
        active: null,
        offer: { id: 7, minutes: 30, offered_side: "Freedom Authority", offered_by: "President Hale", mine: true, seconds: 540 },
        last: []
    },
    ceasefire_offer_theirs: {
        me: "Freedom Authority", mine: true, min_minutes: 5, max_minutes: 60, answer_window: 600, waiting: 0,
        active: null,
        offer: { id: 9, minutes: 30, offered_side: "Combine", offered_by: "Comrade Volkov", mine: false, seconds: 300 },
        last: []
    },
    ceasefire_active: {
        me: "Freedom Authority", mine: true, min_minutes: 5, max_minutes: 60, answer_window: 600, waiting: 1180,
        active: { id: 9, minutes: 20, offered_side: "Combine", signed_by: "President Hale", starts_at: null, ends_at: null, seconds: 1180 },
        offer: null,
        last: [{ status: "active", minutes: 20, offered_side: "Combine", offered_name: "Comrade Volkov", answered_name: "President Hale", at: null }]
    }
};

async function mount(faction, ceasefireKey, options) {
    options = options || {};

    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });

    const w = dom.window;

    w.localStorage.setItem("gf_lang", options.lang || "en");
    w.eval(I18N);

    w.playerFaction = faction;
    w.escapeHTML = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    w.confirm = options.confirm === false ? () => false : () => true;

    const calls = [];
    w.supabaseClient = {
        rpc(name, args) {
            calls.push({ name: name, args: args || {} });
            if (options.missing) {
                return Promise.resolve({ data: null, error: { message: "Could not find the function public." + name } });
            }
            if (name === "diplomacy_state") { return Promise.resolve({ data: OPTS.embassies, error: null }); }
            if (name === "ceasefire_state") { return Promise.resolve({ data: OPTS[ceasefireKey], error: null }); }
            if (name === "ceasefire_offer") { return Promise.resolve({ data: OPTS.ceasefire_offer_mine, error: null }); }
            if (name === "ceasefire_answer") { return Promise.resolve({ data: OPTS.ceasefire_active, error: null }); }
            if (name === "send_envoy") { return Promise.resolve({ data: { planet: args.p_planet, relation: 50, level: "allied", annexed: false }, error: null }); }
            if (name === "arm_rebels") { return Promise.resolve({ data: { planet: args.p_planet, action: "arm_rebels", tinder: 15, relation: 10, theirs: 35, cost: 800 }, error: null }); }
            if (name === "overthrow_government") { return Promise.resolve({ data: { planet: args.p_planet, action: "overthrow_government", tinder: 50, relation: 10, theirs: 35, cost: 1500, locked: 1800 }, error: null }); }
            return Promise.resolve({ data: null, error: null });
        }
    };

    w.eval(BLOCK);

    const tick = () => new Promise(r => setTimeout(r, 30));

    const btn = w.document.getElementById("dip-open");
    if (btn) {
        btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();
        await tick();
    }

    return { w, dom, calls, tick, tab: w.document.getElementById("dip-tab") };
}

(async function main() {
    try { await run(); }
    catch (e) {
        console.log("\nCRASH: " + String((e && e.message) || e).slice(0, 700));
        process.exit(1);
    }
    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);
})();

async function run() {

    console.log("the block is in the map page");
    check("the tab is appended to galaxy.html", BLOCK.length > 2000, BLOCK.length);
    check("and it is called DIPLOMACY", /DIPLOMACY/.test(BLOCK));

    console.log("\nnobody but the two main factions gets a seat");
    for (const f of ["Independents", ""]) {
        const { w } = await mount(f, "ceasefire_none");
        check('"' + (f || "no faction") + '" is not offered the tab', !w.document.getElementById("dip-open"));
        w.close();
    }

    console.log("\nthe Freedom Authority opens it with no ceasefire running");
    {
        const { w, tab, calls } = await mount("Freedom Authority", "ceasefire_none");

        check("the button is there for the Freedom Authority", !!w.document.getElementById("dip-open"));
        check("it asked for the embassies and the ceasefire", calls.some(c => c.name === "diplomacy_state") &&
            calls.some(c => c.name === "ceasefire_state"));
        check("the tab is open", tab.classList.contains("on"));

        const text = tab.textContent.replace(/\s+/g, " ");

        check("the other faction is there", /THE OTHER FACTION/.test(text), text.slice(0, 120));
        check("and no ceasefire is running", /NO CEASEFIRE/.test(text));
        check("the rule is spelled out: never longer than an hour", /cannot last longer than an hour/.test(text));
        check("the war is not signed away", /the other side has to sign it/.test(text));

        const offers = Array.from(tab.querySelectorAll("[data-cf-offer]")).map(el => el.dataset.cfOffer);
        check("three offers: 15, 30 and 60 minutes", offers.join("/") === "15/30/60", offers.join("/"));
        check("no clock is shown while nothing is running", !tab.querySelector("[data-dip-cd]"));

        console.log("\nthe independent worlds");
        check("the embassies are listed", /Veyrona/.test(text) && /Kharos/.test(text));
        check("with the reading between the two factions", /the other side is at 10/.test(text), text.slice(0, 200));
        check("the stage of each world is named", /FRIENDLY/.test(text) && /NEUTRAL/.test(text), text.slice(0, 300));
        check("and the next stage is named too", /next stage at 50/.test(text));
        check("which way a world leans is said out loud", /it leans to your side/.test(text));
        check("the treasury and the price of an embassy", /4,820/.test(text) && /500/.test(text));
        check("relations and envoys", /relations 40 \/ 100/.test(text) && /envoys sent 4/.test(text));

        const envoys = Array.from(tab.querySelectorAll(".dip-envoy"));
        check("two worlds have a button", envoys.length === 2, envoys.length);
        check("the one on cooldown is disabled", envoys.find(el => el.dataset.p === "Kharos").disabled === true);
        check("the one that is free is not", envoys.find(el => el.dataset.p === "Veyrona").disabled === false);

        console.log("\nthe buttons do what they say");
        calls.length = 0;
        tab.querySelector('[data-cf-offer="30"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const offer = calls.find(c => c.name === "ceasefire_offer");
        check("offering thirty minutes calls ceasefire_offer", !!offer && Number(offer.args.p_minutes) === 30,
            offer ? JSON.stringify(offer.args) : "not called");

        calls.length = 0;
        tab.querySelector('.dip-envoy[data-p="Veyrona"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const envoy = calls.find(c => c.name === "send_envoy");
        check("sending envoys calls send_envoy with the world", !!envoy && envoy.args.p_planet === "Veyrona",
            envoy ? JSON.stringify(envoy.args) : "not called");

        console.log("\nthe dirty tricks are on the table");

        const arms = Array.from(tab.querySelectorAll(".dip-arm"));
        const coups = Array.from(tab.querySelectorAll(".dip-coup"));

        check("every world offers its rebels", arms.length === 2, arms.length);
        check("a world already turning to the other side may be overthrown",
            coups.find(el => el.dataset.p === "Kharos").disabled === false);
        check("but one that is not turning yet may not",
            coups.find(el => el.dataset.p === "Veyrona").disabled === true);
        check("the price is shown, and no odds are rolled any more",
            /ARM THE REBELS \(800\)/.test(text) && !/%\)/.test(text),
            text.slice(text.indexOf("ARM THE REBELS") - 20, text.indexOf("ARM THE REBELS") + 60));
        check("the trouble already planted is named", /trouble already planted: 15/.test(text),
            text.slice(0, 260));
        check("a world whose rebels were armed an hour ago is on cooldown",
            arms.find(el => el.dataset.p === "Kharos").disabled === true);
        check("and a world that is not turning has its rifles turned down",
            arms.find(el => el.dataset.p === "Veyrona").disabled === true);

        calls.length = 0;
        tab.querySelector('.dip-arm[data-p="Veyrona"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const arm = calls.find(c => c.name === "arm_rebels");
        check("arming the rebels calls arm_rebels", !!arm && arm.args.p_planet === "Veyrona",
            arm ? JSON.stringify(arm.args) : "not called");
        check("and the result is reported", /the rebels are armed/.test(msgText(tab)), msgText(tab));

        calls.length = 0;
        tab.querySelector('.dip-coup[data-p="Kharos"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const coup = calls.find(c => c.name === "overthrow_government");
        check("a coup asks first, then calls overthrow_government", !!coup && coup.args.p_planet === "Kharos",
            coup ? JSON.stringify(coup.args) : "not called");
        check("and says the government is tottering and unrest was planted",
            /the government is tottering/.test(msgText(tab)) && /unrest 50/.test(msgText(tab)), msgText(tab));

        w.close();
    }

    console.log("\nan offer of our own waits for the other side");
    {
        const { w, tab } = await mount("Freedom Authority", "ceasefire_offer_mine");
        const text = tab.textContent.replace(/\s+/g, " ");

        check("it says the offer is on the table", /YOUR CEASEFIRE IS ON THE TABLE/.test(text), text.slice(0, 160));
        check("nobody can sign their own offer", !tab.querySelector("[data-cf-accept]"));
        check("the clock is counting", tab.querySelector('[data-dip-cd="offer"]').textContent === "9:00",
            tab.querySelector('[data-dip-cd="offer"]').textContent);
        check("and the ten minute rule is stated", /lapses ten minutes after it is made/.test(text));

        w.close();
    }

    console.log("\nan offer from the Combine can be signed or thrown away");
    {
        const { w, tab, calls } = await mount("Freedom Authority", "ceasefire_offer_theirs");
        const text = tab.textContent.replace(/\s+/g, " ");

        check("the panel says the other side offers", /THE OTHER SIDE OFFERS A CEASEFIRE/.test(text), text.slice(0, 160));
        check("thirty minutes are named", /30 MINUTES/.test(text));
        check("who offered", /Comrade Volkov/.test(text));

        calls.length = 0;
        tab.querySelector("[data-cf-accept]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const yes = calls.find(c => c.name === "ceasefire_answer");
        check("accepting answers the right offer", !!yes && Number(yes.args.p_id) === 9 && yes.args.p_accept === true,
            yes ? JSON.stringify(yes.args) : "not called");

        w.close();
    }
    {
        const { w, tab, calls } = await mount("Freedom Authority", "ceasefire_offer_theirs");
        calls.length = 0;
        tab.querySelector("[data-cf-refuse]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        const no = calls.find(c => c.name === "ceasefire_answer");
        check("refusing answers the same offer with no", !!no && Number(no.args.p_id) === 9 && no.args.p_accept === false,
            no ? JSON.stringify(no.args) : "not called");
        w.close();
    }

    console.log("\na ceasefire in force shows its clock");
    {
        const { w, tab } = await mount("Freedom Authority", "ceasefire_active");
        const text = tab.textContent.replace(/\s+/g, " ");

        check("the panel says it is in force", /CEASEFIRE IN FORCE/.test(text), text.slice(0, 160));
        check("with a clock", tab.querySelector('[data-dip-cd="active"]').textContent === "19:40",
            tab.querySelector('[data-dip-cd="active"]').textContent);
        check("who signed it", /signed by/.test(text) && /President Hale/.test(text));
        check("the front is frozen, on both sides", /no assault, no weapons, no reinforcements, on either side/.test(text));
        check("nothing is offered while it runs", !tab.querySelector("[data-cf-offer]"));
        check("the book remembers it", /THE BOOK/.test(text) && /SIGNED/.test(text));

        w.close();
    }

    console.log("\nthe Combine sees it from its own side");
    {
        const { w, tab } = await mount("Combine", "ceasefire_none");
        const text = tab.textContent.replace(/\s+/g, " ");
        check("the Combine gets the tab too", !!w.document.getElementById("dip-open"));
        check("and reads the other side's embassy line", /the other side is at 10/.test(text), text.slice(0, 200));
        check("its own pact wording", /joins the Union/.test(text));
        w.close();
    }

    console.log("\na coup that is called off is never sent");
    {
        const { w, tab, calls } = await mount("Freedom Authority", "ceasefire_none", { confirm: false });
        calls.length = 0;
        tab.querySelector('.dip-coup[data-p="Kharos"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        check("nothing is sent when the player says no", !calls.some(c => c.name === "overthrow_government"),
            calls.map(c => c.name).join(","));
        w.close();
    }

    console.log("\na database without the patches says so");
    {
        const { w, tab } = await mount("Freedom Authority", "ceasefire_none", { missing: true });
        const text = tab.textContent.replace(/\s+/g, " ");
        check("the ceasefire card names its file", /2026-11-02_temporary_ceasefire\.sql/.test(text), text.slice(0, 200));
        check("the embassy card names its file", /2026-10-31_leaders_parties_and_diplomacy\.sql/.test(text));
        w.close();
    }

    console.log("\nthe panel reads Portuguese");
    {
        const { w, tab } = await mount("Freedom Authority", "ceasefire_active", { lang: "pt" });
        const text = tab.textContent.replace(/\s+/g, " ");

        check("the title", /DIPLOMACIA/.test(text), text.slice(0, 80));
        check("the ceasefire is in force in Portuguese", /CESSAR-FOGO EM VIGOR/.test(text));
        check("the clock's words", /assinado por/.test(text), text.slice(0, 200));
        check("the offer buttons", /MINUTOS/.test(text));
        check("the embassies", /MUNDOS INDEPENDENTES/.test(text));
        check("sending envoys", /ENVIAR EMISSÁRIOS/.test(text));
        check("the stages are in Portuguese", /AMIGÁVEL/.test(text) && /NEUTRO/.test(text), text.slice(0, 400));
        check("the dirty tricks too", /ARMAR OS REBELDES/.test(text) && /DERRUBAR O GOVERNO/.test(text));
        check("and which way a world leans", /inclina-se para o seu lado/.test(text));
        check("and the way back", /VOLTAR AO MAPA/.test(text));
        w.close();
    }
}
