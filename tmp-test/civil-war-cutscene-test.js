/* The civil war resumes: a Freedom or Combine city attacked by the other
   authority opens an event card, and PROCEED plays the film before the
   battle starts.

   The page rule itself is lifted out of planet.html and run here, so the
   factions that do and do not resume the war are proven, not grepped.

   Run: node tmp-test/civil-war-cutscene-test.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

/* ---------------------------------------------------------------
   the rule, taken straight out of the page
--------------------------------------------------------------- */
const rule = (function () {

    const from = PAGE.indexOf("const CIVIL_WAR_FACTIONS");
    const to = PAGE.indexOf("function civilWarSeen");

    if (from === -1 || to === -1 || to <= from) { return null; }

    const src = PAGE.slice(from, to);

    try { return new Function(src + "\nreturn resumesTheCivilWar;")(); }
    catch (e) { return null; }

}());

console.log("== who resumes the civil war");

ok("the page carries the rule", typeof rule === "function");

if (typeof rule === "function") {

    ok("a Freedom fleet on a Combine city resumes it",
        rule("Freedom Authority", "Combine") === true);
    ok("a Combine fleet on a Freedom city resumes it",
        rule("Combine", "Freedom Authority") === true);
    ok("a city of the same authority does not",
        rule("Freedom Authority", "Freedom Authority") === false &&
        rule("Combine", "Combine") === false);
    ok("the independents are somebody else's war",
        rule("Freedom Authority", "Independents") === false &&
        rule("Independents", "Combine") === false);
    ok("a missing faction is not a civil war",
        rule(null, "Combine") === false &&
        rule("Combine", undefined) === false &&
        rule("", "") === false);
    ok("stray spaces do not fool it",
        rule(" Combine ", "Freedom Authority") === true);

}

console.log("\n== the event");

ok("the planet page owns the card", /overlay\.id = "civil-war-event"/.test(PAGE));
ok("the card says what is resuming",
    /RESUMING THE GALACTIC CIVIL WAR/.test(PAGE) && /tr\(title\)/.test(PAGE));
ok("it offers PROCEED underneath", /"PROCEED"/.test(PAGE) && /card\.button\.addEventListener\("click"/.test(PAGE));
ok("proceeding closes the card and lets the attack go on",
    /card\.overlay\.remove\(\);\s*\n\s*resolve\(\);/.test(PAGE));

const order = (() => {

    const event = PAGE.indexOf("await civilWarEvent();");
    const seen = PAGE.indexOf("civilWarRemember();");
    const film = PAGE.indexOf("await civilWarFilm();");

    return { event: event, seen: seen, film: film };

})();

ok("the card comes before the film",
    order.event !== -1 && order.film !== -1 && order.event < order.film, order);
ok("the war is remembered only after the player proceeds",
    order.seen > order.event && order.seen < order.film, order);

console.log("\n== the film");

ok("it plays the civil war cutscene",
    /const CIVIL_WAR_VIDEO = "assets\/cutscenes\/civil-war\.mp4";/.test(PAGE) &&
    /video\.src = CIVIL_WAR_VIDEO;/.test(PAGE));

const CUTSCENE = path.join(ROOT, "assets/cutscenes/civil-war.mp4");
const cutscene = fs.existsSync(CUTSCENE) ? fs.readFileSync(CUTSCENE) : null;

ok("the film is really shipped beside the page",
    !!cutscene && cutscene.length > 1000000,
    cutscene ? cutscene.length : "missing");
ok("it is an mp4 the browsers know",
    !!cutscene && cutscene.slice(4, 8).toString("latin1") === "ftyp");
ok("its index sits at the front, so it starts without waiting",
    !!cutscene && cutscene.indexOf("moov") > 0 &&
    cutscene.indexOf("moov") < cutscene.indexOf("mdat"));
ok("it plays by itself, sound and all", /video\.autoplay = true;/.test(PAGE) &&
    /video\.playsInline = true;/.test(PAGE));
ok("a browser that refuses sound still gets to see it",
    /video\.muted = true;/.test(PAGE) && /video\.controls = true;/.test(PAGE));
ok("skipping ends it", /skip\.addEventListener\("click", finish\)/.test(PAGE) && /"SKIP"/.test(PAGE));
ok("so does the last frame", /video\.addEventListener\("ended", finish\)/.test(PAGE));
ok("a missing file does not strand the player in the dark",
    /video\.addEventListener\("error", finish\)/.test(PAGE));
ok("the film is only reachable by proceeding",
    (PAGE.match(/civilWarFilm\(\)/g) || []).length === 2);

console.log("\n== it holds the attack, not the other way round");

const hook = PAGE.indexOf("await civilWarBegins(playerFaction, city.faction);");
const battle = PAGE.indexOf('"battle.html" +');

ok("the city attack waits for the event",
    hook !== -1 && battle !== -1 && hook < battle);
ok("the rule is asked before anything is shown",
    /async function civilWarBegins\(attacker, defender\) \{\s*\n\s*if \(!resumesTheCivilWar\(attacker, defender\)\) \{ return; \}/.test(PAGE));

console.log("\n== once per player");

ok("the browser remembers it, with the stamp of the war it saw",
    /const CIVIL_WAR_SEEN = "gf\.civil-war-cutscene";/.test(PAGE) &&
    /window\.localStorage\.getItem\(CIVIL_WAR_SEEN\)/.test(PAGE) &&
    /window\.localStorage\.setItem\(CIVIL_WAR_SEEN,/.test(PAGE) &&
    /stamp: civilWarStamp\(\)/.test(PAGE));
ok("the stamp is the host's reset clock, so a reset brings the cutscene back",
    /function civilWarStamp\(\)/.test(PAGE) && /status\.started/.test(PAGE) &&
    /String\(said\.stamp\) === civilWarStamp\(\)/.test(PAGE));
ok("a browser without storage simply sees it again",
    /catch \(e\) \{ return false; \}/.test(PAGE) && /catch \(e\) \{ \/\*/.test(PAGE));

console.log("\n== in Portuguese");

const words = [
    ["GALACTIC EVENT", "EVENTO GALÁCTICO"],
    ["RESUMING THE GALACTIC CIVIL WAR", "RETOMANDO A GUERRA CIVIL GALÁCTICA"],
    ["PROCEED", "PROSSEGUIR"],
    ["SKIP", "PULAR"]
];

for (const [en, pt] of words) {
    ok('"' + en + '" is translated',
        I18N.indexOf('"' + en + '": "' + pt + '"') !== -1);
}

ok("the whole card reads in Portuguese",
    /"A Freedom Authority e a Combine não marcham sobre as cidades uma da outra/.test(I18N));

/* ---------------------------------------------------------------
   the flow itself, in a real DOM: card, PROCEED, film, and the
   attack going on afterwards
--------------------------------------------------------------- */
const { JSDOM } = require("jsdom");

async function flow() {

    const dom = new JSDOM(
        "<!doctype html><html><body></body></html>",
        { url: "https://e.test/planet", runScripts: "outside-only", pretendToBeVisual: true }
    );

    const w = dom.window;

    w.tr = function (text) { return text; };

    /* jsdom does not play video */
    w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function () { };

    const from = PAGE.indexOf("const CIVIL_WAR_VIDEO");
    const to = PAGE.indexOf("/* =========================================================\n   ATTACK");

    ok("the page block can be lifted out whole", from !== -1 && to > from);

    w.eval(PAGE.slice(from, to) + "\nwindow.civilWarBegins = civilWarBegins;");

    const pause = function () { return new Promise(function (r) { setTimeout(r, 10); }); };

    const first = w.civilWarBegins("Freedom Authority", "Combine");
    await pause();

    const card = w.document.getElementById("civil-war-event");

    ok("the player sees the event", !!card);
    ok("it says the civil war is resuming",
        !!card && card.textContent.indexOf("RESUMING THE GALACTIC CIVIL WAR") !== -1);
    ok("PROCEED sits underneath it",
        !!card && !!card.querySelector("button") && card.querySelector("button").textContent === "PROCEED");
    ok("nothing plays before the player proceeds", !w.document.getElementById("civil-war-cutscene"));

    card.querySelector("button").click();
    await pause();

    ok("the card goes and the film arrives",
        !w.document.getElementById("civil-war-event") && !!w.document.getElementById("civil-war-cutscene"));

    const video = w.document.querySelector("#civil-war-cutscene video");

    ok("the film is the civil war cutscene",
        !!video && /assets\/cutscenes\/civil-war\.mp4$/.test(video.getAttribute("src")));

    video.dispatchEvent(new w.Event("ended"));
    await first;

    ok("the last frame returns the player to the attack",
        !w.document.getElementById("civil-war-cutscene"));

    /* the second attack of the war is fought, not filmed again */
    const second = w.civilWarBegins("Freedom Authority", "Combine");
    await pause();

    const again = !!w.document.getElementById("civil-war-event");
    await second;

    ok("the war only resumes once for a player", !again);

    /* the host resets the game: the new stamp arms the cutscene again */
    w.gameStatus = { started: 100 };

    const afterReset = w.civilWarBegins("Freedom Authority", "Combine");
    await pause();

    const resetCard = w.document.getElementById("civil-war-event");
    ok("the host's reset brings the cutscene back", !!resetCard);

    if (resetCard) {
        resetCard.querySelector("button").click();
        await pause();
        w.document.querySelector("#civil-war-cutscene video").dispatchEvent(new w.Event("ended"));
    }
    await afterReset;

    /* and it is once per war, not once per attack */
    const sameWar = w.civilWarBegins("Combine", "Freedom Authority");
    await pause();

    const twice = !!w.document.getElementById("civil-war-event");
    await sameWar;

    ok("the same war is not filmed twice", !twice);

    /* a second reset arms it once more */
    w.gameStatus = { started: 200 };

    const resetAgain = w.civilWarBegins("Combine", "Freedom Authority");
    await pause();

    const thirdCard = w.document.getElementById("civil-war-event");
    ok("every reset brings it back", !!thirdCard);

    if (thirdCard) {
        thirdCard.querySelector("button").click();
        await pause();
        w.document.querySelector("#civil-war-cutscene video").dispatchEvent(new w.Event("ended"));
    }
    await resetAgain;

    /* a city of the other side, or of nobody, is not this event */
    const third = w.civilWarBegins("Freedom Authority", "Independents");
    await pause();

    const elsewhere = !!w.document.getElementById("civil-war-event");
    await third;

    ok("an independent city does not trigger it", !elsewhere);

    /* a film that will not load must still let the attack through */
    w.localStorage.removeItem("gf.civil-war-cutscene");

    const fourth = w.civilWarBegins("Combine", "Freedom Authority");
    await pause();

    const broken = w.document.getElementById("civil-war-event");
    if (broken) {

        broken.querySelector("button").click();
        await pause();

        w.document.querySelector("#civil-war-cutscene video").dispatchEvent(new w.Event("error"));
    }

    let crashed = false;
    try { await fourth; } catch (e) { crashed = true; }

    ok("a film that cannot play does not block the battle", !crashed && !w.document.getElementById("civil-war-cutscene"));

}

flow().then(function () {

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}).catch(function (error) {

    fail++;
    console.log("  FAIL the flow crashed  -> " + error.message);
    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(1);

});
