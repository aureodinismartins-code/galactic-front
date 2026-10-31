/* The Freedom Authority election event and its film.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/elections-ui-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const SCRIPT = fs.readFileSync(path.join(ROOT, "elections.js"), "utf8");
const GALAXY = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

const PAIR = {
    ready: true,
    stamp: 7,
    president: "Aureo",
    speaker: "Boris",
    freedom: true,
    combine: false,
    soviet_ready: false,
    commissar: "",
    at: new Date().toISOString()
};

function boot(pair, remembered) {

    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", function() {});

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html", runScripts: "dangerously", virtualConsole: virtualConsole
    });

    const w = dom.window;
    w.T = (text) => text;

    if (remembered) {
        w.localStorage.setItem("gf.fa-elections", JSON.stringify({ stamp: String(remembered), at: Date.now() }));
    }

    const calls = [];

    w.supabaseClient = {
        rpc: function(name, args) {
            calls.push(name);
            return Promise.resolve({ data: pair, error: null });
        }
    };

    w.eval(SCRIPT);

    return { w, calls };

}

(async function main() {

    try {

        console.log("\n== the event");

        const run = boot(PAIR, null);
        await tick(750);

        const w = run.w;
        const card = w.document.getElementById("gf-elections-event");

        ok("a Freedom Authority member is told", !!card);
        ok("it says what happened", /THE FREEDOM AUTHORITY ELECTIONS/.test(card.textContent), card && card.textContent);
        ok("with the President's name", /Aureo/.test(card.textContent));
        ok("and the Speaker's", /Boris/.test(card.textContent));
        ok("as one line", /won the presidential race, with/.test(card.textContent));
        ok("nothing plays before the player proceeds", !w.document.getElementById("gf-elections-cutscene"));

        const proceed = card.querySelector('[data-gf="proceed"]');
        ok("there is a way on", !!proceed);

        proceed.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        ok("the card makes way for the film", !w.document.getElementById("gf-elections-event"));
        const film = w.document.getElementById("gf-elections-cutscene");
        ok("the film plays", !!film);
        ok("and it is the President arriving at the Congress",
            !!film && /assets\/cutscenes\/president-arrives-at-congress\.mp4$/.test(
                film.querySelector("video").getAttribute("src")),
            film && film.querySelector("video").getAttribute("src"));

        film.querySelector("video").dispatchEvent(new w.Event("ended"));
        await tick(60);
        ok("when it ends the map is back", !w.document.getElementById("gf-elections-cutscene"));

        ok("the war is remembered as seen",
            JSON.parse(w.localStorage.getItem("gf.fa-elections")).stamp === "7",
            w.localStorage.getItem("gf.fa-elections"));

        console.log("\n== who sees it");

        const again = boot(PAIR, 7);
        await tick(750);
        ok("the same war does not raise it twice", !again.w.document.getElementById("gf-elections-event"));

        const nobody = boot(Object.assign({}, PAIR, { freedom: false }), null);
        await tick(750);
        ok("a commander with no side is shown nothing", !nobody.w.document.getElementById("gf-elections-event"));

        console.log("\n== the Soviet hears its own");

        const SOVIET = {
            ready: false, soviet_ready: true, stamp: 9, president: "Aureo",
            commissar: "Boris", freedom: false, combine: true
        };

        const soviet = boot(SOVIET, null);
        await tick(750);

        const sCard = soviet.w.document.getElementById("gf-elections-event");

        ok("a Combine commander is told", !!sCard);
        ok("in the Soviet's voice", !!sCard && /THE SUPREME SOVIET ELECTIONS/.test(sCard.textContent), sCard && sCard.textContent);
        ok("with the President's name", !!sCard && /Aureo/.test(sCard.textContent));
        ok("and the High Commissar's", !!sCard && /Boris/.test(sCard.textContent));
        ok("naming the office", !!sCard && /High Commissariat of the Soviet/.test(sCard.textContent));

        if (sCard) {
            sCard.querySelector('[data-gf="proceed"]')
                .dispatchEvent(new soviet.w.MouseEvent("click", { bubbles: true }));
            await tick(80);
        }

        const sFilm = soviet.w.document.getElementById("gf-elections-cutscene");

        ok("and its own film", !!sFilm &&
            /assets\/cutscenes\/the-combine-takes-the-congress\.mp4$/.test(
                sFilm.querySelector("video").getAttribute("src")),
            sFilm && sFilm.querySelector("video").getAttribute("src"));
        ok("remembered under the Soviet's own key",
            !!soviet.w.localStorage.getItem("gf.combine-elections") &&
            JSON.parse(soviet.w.localStorage.getItem("gf.combine-elections")).stamp === "9",
            soviet.w.localStorage.getItem("gf.combine-elections"));
        ok("leaving the Congress's memory alone", !soviet.w.localStorage.getItem("gf.fa-elections"));

        const waiting = boot(Object.assign({}, PAIR, { ready: false }), null);
        await tick(750);
        ok("nothing is raised while a chair is still empty", !waiting.w.document.getElementById("gf-elections-event"));

        console.log("\n== a film that will not play");

        const broken = boot(PAIR, null);
        await tick(750);

        const brokenCard = broken.w.document.getElementById("gf-elections-event");
        brokenCard.querySelector('[data-gf="proceed"]').dispatchEvent(new broken.w.MouseEvent("click", { bubbles: true }));
        await tick(60);

        const brokenFilm = broken.w.document.getElementById("gf-elections-cutscene");
        ok("a missing film still opens the scene", !!brokenFilm);
        if (brokenFilm) {
            brokenFilm.querySelector("video").dispatchEvent(new broken.w.Event("error"));
            await tick(60);
        }
        ok("and closes it rather than trapping the player",
            !broken.w.document.getElementById("gf-elections-cutscene"));

        console.log("\n== the pages carry it");

        ok("every screen loads the event", /<script src="elections.js\?v=2"><\/script>/.test(GALAXY));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

}());
