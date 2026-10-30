/* The militia camps on the globe: a world in revolt camps in the open country,
   one camp for every band, as far from its cities as the ground allows, and
   the camps go away when the bands are broken. The three functions are cut
   out of planet.html and run against a stubbed unrest_state().

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/militia-camps-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); }

/* one function, brace for brace, out of a page */
function grab(source, name) {

    let start = source.indexOf("function " + name + "(");

    if (start < 0) { return null; }

    /* keep the async that belongs to it */
    if (source.slice(Math.max(0, start - 6), start) === "async ") { start -= 6; }

    let depth = 0;

    for (let i = source.indexOf("{", start); i < source.length; i++) {

        if (source[i] === "{") { depth++; }
        else if (source[i] === "}") {
            depth--;
            if (!depth) { return source.slice(start, i + 1); }
        }

    }

    return null;

}

function page(options) {

    options = options || {};

    const dom = new JSDOM(
        '<!doctype html><html><body>' +
        '<div id="planet-globe"><div id="cities">' +
        '<div class="city" style="left:25%;top:35%"><div class="city-marker"></div></div>' +
        '<div class="city" style="left:55%;top:55%"><div class="city-marker"></div></div>' +
        '<div class="city" style="left:75%;top:30%"><div class="city-marker"></div></div>' +
        '</div></div>' +
        '</body></html>',
        { url: "http://localhost/planet.html?name=" + (options.planet || "Krieg"),
          runScripts: "dangerously", pretendToBeVisual: true }
    );

    const w = dom.window;
    const doc = w.document;
    const notices = [];

    w.t = function (s) { return s; };
    w.escapeText = function (s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };
    w.gameNotice = function (message, title) { notices.push({ message: message, title: title }); };
    w.cityContainer = doc.getElementById("cities");
    w.planetName = options.planet || "Krieg";
    w.playerFaction = "Combine";
    w.planetFleets = options.fleets || [];
    w.planetCities = [1, 2, 3].map(function (n) {
        return { id: n, name: "C" + n, faction: "Combine", garrison_level: 1 };
    });
    w.supabaseClient = {
        rpc: async function (fn) {
            if (fn === "rebel_band_size") { return { data: 1500, error: null }; }
            if (fn !== "unrest_state") { return { data: null, error: { message: "unknown call" } }; }
            if (options.broken) { return { data: null, error: { message: "function public.unrest_state() does not exist" } }; }
            return { data: { worlds: options.worlds || [] }, error: null };
        }
    };

    /* the page's own camp state, declarations and all, so the cut-out
       functions never find a variable missing */
    const declStart = PAGE.indexOf("let rebelCamps = {");
    const declTail = "let campRise = 0;";
    const declEnd = PAGE.indexOf(declTail, declStart) + declTail.length;

    if (declStart < 0 || declEnd < declTail.length) { throw new Error("the camp state is not in planet.html"); }

    const code = [
        PAGE.slice(declStart, declEnd),
        grab(PAGE, "tr"),
        grab(PAGE, "loadRebelCamps"),
        grab(PAGE, "campPositions"),
        grab(PAGE, "fleetForTheWoods"),
        grab(PAGE, "militiaBattleUrl"),
        "let campNoticeTimer = null;",
        grab(PAGE, "campNotice"),
        grab(PAGE, "renderMilitiaCamps")
    ].join("\n\n");

    w.eval(code);

    return { dom: dom, doc: doc, w: w, notices: notices, camps: function () { return Array.prototype.slice.call(doc.querySelectorAll(".militia-camp")); } };

}

function at(el) {
    return [parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0];
}

function dist(a, b) {
    return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]));
}

const CITIES = [[25, 35], [55, 55], [75, 30]];

function world(bands, men, garrison) {
    return { planet: "Krieg", faction: "Combine", unrest: 62, mood: "RIOTING", revolts: 0, mine: true,
             garrison: garrison || { fleets: 1, soldiers: 9500 },
             fight: { bands: bands, men: men, garrison: true, ready_in: 0 } };
}

(async function main() {

    try {

        console.log("\n== a quiet world has no camps");

        const quiet = page({ worlds: [{ planet: "Krieg", faction: "Combine", unrest: 22, fight: null }] });

        await quiet.w.loadRebelCamps();
        quiet.w.renderMilitiaCamps();

        ok("nothing is drawn", quiet.camps().length === 0, quiet.camps().length);
        ok("and the cities are untouched", quiet.doc.querySelectorAll("#cities .city").length === 3);

        quiet.dom.window.close();

        console.log("\n== one camp for every band");

        const p = page({ worlds: [world(2, 1000)] });

        await p.w.loadRebelCamps();
        p.w.renderMilitiaCamps();

        const camps = p.camps();

        ok("two bands, two camps", camps.length === 2, camps.length);
        ok("each has a fire on the ground", camps.every(function (c) { return !!c.querySelector(".camp-fire"); }));
        ok("and is labelled a militia camp", camps.every(function (c) { return /MILITIA CAMP/.test(c.textContent); }),
            camps.map(function (c) { return c.textContent.trim(); }));
        ok("each is a real position on the globe", camps.every(function (c) { return /%$/.test(c.style.left) && /%$/.test(c.style.top); }),
            camps.map(function (c) { return c.style.left + " / " + c.style.top; }));

        console.log("\n== in the country, not in the towns");

        const nearestCity = camps.map(function (c) { return Math.min.apply(null, CITIES.map(function (city) { return dist(at(c), city); })); });

        ok("no camp stands on a city", nearestCity.every(function (d) { return d > 10; }), nearestCity);
        ok("and neither in the middle of the towns", camps.every(function (c) {
            return Math.abs(at(c)[0] - 50) + Math.abs(at(c)[1] - 50) > 12;
        }), camps.map(function (c) { return at(c); }));
        ok("both are inside the globe", camps.every(function (c) {
            const a = at(c); return a[0] > 8 && a[0] < 92 && a[1] > 8 && a[1] < 92;
        }), camps.map(function (c) { return at(c); }));
        ok("and the two camps stand apart", dist(at(camps[0]), at(camps[1])) > 8, dist(at(camps[0]), at(camps[1])));

        console.log("\n== the camps show what they took");

        const took = page({ worlds: [world(2, 3500)] });

        await took.w.loadRebelCamps();
        took.w.renderMilitiaCamps();

        const tookCamps = took.camps();
        const details = tookCamps.map(function (c) {
            const d = c.querySelector(".camp-detail");
            return d ? d.textContent : "";
        });

        ok("every camp counts its own men", details.every(function (d) { return /1,750 men/.test(d); }), details);
        ok("and the recruits it holds", details.every(function (d) { return /250 recruits/.test(d); }), details);
        ok("the recruits add up to what the garrison lost",
            details.reduce(function (n, d) {
                const m = /(\d[\d,]*) recruits/.exec(d);
                return n + (m ? Number(m[1].replace(/,/g, "")) : 0);
            }, 0) === 500, details);
        ok("the garrison the men came out of is on the camp", /9,500/.test(tookCamps[0].title), tookCamps[0].title);

        took.dom.window.close();

        const clean = page({ worlds: [world(2, 3000)] });

        await clean.w.loadRebelCamps();
        clean.w.renderMilitiaCamps();

        const cleanDetails = clean.camps().map(function (c) {
            const d = c.querySelector(".camp-detail");
            return d ? d.textContent : "";
        });

        ok("a world whose bands took nobody shows no recruits",
            cleanDetails.every(function (d) { return /1,500 men/.test(d) && d.indexOf("recruits") === -1; }), cleanDetails);

        clean.dom.window.close();

                console.log("\n== the same world camps in the same places");

        p.w.renderMilitiaCamps();

        const again = p.camps();

        ok("drawing twice does not double the camps", again.length === 2, again.length);
        ok("and they have not moved", again.every(function (c, i) { return c.style.left === camps[i].style.left; }),
            again.map(function (c) { return c.style.left; }));

        console.log("\n== pressing a camp sends the troops into the woods");

        const moved = [];

        p.w.goToWoods = function (url) { moved.push(url); };

        camps[0].dispatchEvent(new p.w.Event("click"));

        ok("with no fleet in orbit nothing moves", moved.length === 0, moved);

        const why = p.doc.getElementById("camp-notice");

        ok("and a brief notice says why", !!why && /No fleet of ours is in orbit/.test(why.textContent),
            why && why.textContent);
        ok("it still counts the bands and the men",
            /2 bands/.test(why.textContent) && /1,000 men/.test(why.textContent), why.textContent);

        console.log("\n== with a fleet in orbit the camp opens the battle");

        p.w.planetFleets = [
            { id: "elsewhere", status: "stationed", origin: "Kara", squads: [{ type: "Rifle", amount: 3 }] },
            { id: "f1", status: "stationed", origin: "Krieg", squads: [{ type: "Rifle", amount: 3 }] }
        ];

        p.w.renderMilitiaCamps();

        p.camps()[0].dispatchEvent(new p.w.Event("click"));

        ok("one press, one march", moved.length === 1, moved);
        ok("the woods open", /^battle\.html\?rebel=1/.test(moved[0]), moved[0]);
        ok("on this world", /planet=Krieg/.test(moved[0]), moved[0]);
        ok("named as the militia camp", /city=Militia%20Camp/.test(moved[0]), moved[0]);
        ok("with the militia as the enemy", /defender=Militia/.test(moved[0]), moved[0]);
        ok("and our own side as the attacker", /attacker=Combine/.test(moved[0]), moved[0]);
        ok("carrying the fleet of ours at the planet, not another world's",
            /fleet=f1/.test(moved[0]) && !/fleet=elsewhere/.test(moved[0]), moved[0]);

        console.log("\n== four camps are as many as a world shows");

        const many = page({ worlds: [world(9, 4500)] });

        await many.w.loadRebelCamps();
        many.w.renderMilitiaCamps();

        ok("the camps stop at four", many.camps().length === 4, many.camps().length);

        many.dom.window.close();

        console.log("\n== a new band is news");

        const rise = page({ worlds: [world(1, 500)] });

        await rise.w.loadRebelCamps();
        rise.w.renderMilitiaCamps();

        ok("one band, one camp", rise.camps().length === 1, rise.camps().length);
        ok("the first look at a world is not news", !rise.doc.getElementById("camp-notice"));

        const fireBefore = parseFloat(rise.camps()[0].querySelector(".camp-fire").style.width);

        ok("the fire has a size of its own", fireBefore > 0, fireBefore);

        rise.w.supabaseClient = {
            rpc: async function () { return { data: { worlds: [world(2, 1000)] }, error: null }; }
        };

        await rise.w.loadRebelCamps();
        rise.w.renderMilitiaCamps();

        const after = rise.camps();
        const fireAfter = parseFloat(after[0].querySelector(".camp-fire").style.width);

        ok("the second band raises a second camp", after.length === 2, after.length);
        ok("the fires have grown", fireAfter > fireBefore, fireBefore + " -> " + fireAfter);
        ok("the camp that has just risen comes up out of the ground",
            after[after.length - 1].classList.contains("camp-new"),
            after.map(function (c) { return c.className; }));
        ok("the camp already standing flares", after[0].querySelector(".camp-fire").classList.contains("flare"),
            after[0].querySelector(".camp-fire").className);

        const bar = rise.doc.getElementById("camp-notice");

        ok("a brief notice appears", !!bar && bar.classList.contains("show"), bar && bar.className);
        ok("it says a band has risen", /A new militia band has risen in the woods of/.test(bar.textContent), bar.textContent);
        ok("on this world", /Krieg/.test(bar.textContent), bar.textContent);
        ok("with the count", /2 bands/.test(bar.textContent) && /1,000 men/.test(bar.textContent), bar.textContent);

        rise.w.renderMilitiaCamps();

        ok("it is said once, not on every redraw",
            rise.camps().every(function (c) { return !c.classList.contains("camp-new"); }),
            rise.camps().map(function (c) { return c.className; }));

        console.log("\n== a rise of two bands lights two camps");

        rise.w.supabaseClient = {
            rpc: async function () { return { data: { worlds: [world(4, 2000)] }, error: null }; }
        };

        await rise.w.loadRebelCamps();
        rise.w.renderMilitiaCamps();

        ok("two new camps come up",
            rise.camps().filter(function (c) { return c.classList.contains("camp-new"); }).length === 2,
            rise.camps().map(function (c) { return c.className; }));
        ok("and the notice counts them", /New militia bands have risen/.test(bar.textContent), bar.textContent);

        rise.dom.window.close();

        console.log("\n== and when the bands are broken");

        p.w.supabaseClient = {
            rpc: async function () { return { data: { worlds: [{ planet: "Krieg", unrest: 31, fight: null }] }, error: null }; }
        };

        await p.w.loadRebelCamps();
        p.w.renderMilitiaCamps();

        ok("the camps come off the globe", p.camps().length === 0, p.camps().length);
        ok("the cities stay", p.doc.querySelectorAll("#cities .city").length === 3);

        console.log("\n== another world's rebels are not ours");

        const other = page({ worlds: [{ planet: "Kara", fight: { bands: 3, men: 1500 } }] });

        await other.w.loadRebelCamps();
        other.w.renderMilitiaCamps();

        ok("Kara's camps are not drawn on Krieg", other.camps().length === 0, other.camps().length);

        other.dom.window.close();

        console.log("\n== before the patch is run");

        const broken = page({ broken: true });

        await broken.w.loadRebelCamps();
        broken.w.renderMilitiaCamps();

        ok("no camps, and no crash", broken.camps().length === 0, broken.camps().length);

        broken.dom.window.close();

        console.log("\n== the page reads the camps with the cities");

        const loadCities = PAGE.slice(PAGE.indexOf("async function loadCities()"), PAGE.indexOf("function renderPlanet()"));

        ok("the camps are read when the cities are", /await loadRebelCamps\(\);/.test(loadCities));
        ok("and drawn with them", /renderMilitiaCamps\(\);/.test(PAGE.slice(PAGE.indexOf("function renderPlanet()"), PAGE.indexOf("function playerOwnsPlanet()"))));
        ok("a new band redraws even without a city change", /rebelCamps\]\)/.test(PAGE));

        console.log("\n== in Portuguese");

        ok("the camp is named", /"MILITIA CAMP": "ACAMPAMENTO DA MIL\u00cdCIA"/.test(I18N));
        ok("where they camp is said", /"A band of militia camps in the woods outside the towns, out of the cities' reach\.": "Um bando de mil\u00edcia acampa na mata fora das cidades, longe do alcance delas\."/.test(I18N));
        ok("and who sends the troops", /"The halls decide the assault: the Congress holds the order to fight them\.": "As casas decidem o assalto: o Congresso tem a ordem de combat\u00ea-los\."/.test(I18N));
        ok("the rise is announced", /"A new militia band has risen in the woods of": "Um novo bando de mil\u00edcia se levantou na mata de"/.test(I18N));
        ok("and several rises too", /"New militia bands have risen in the woods of": "Novos bandos de mil\u00edcia se levantaram na mata de"/.test(I18N));
        ok("the camp shows recruits", /"recruits": "recrutas"/.test(I18N));
        ok("and the garrison it bleeds", /"garrison": "guarnição"/.test(I18N));

        await wait(10);

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
