/* The supply net and the fog of war, as galaxy.html actually runs them.

   A. the net has no screen and no button any more: it is drawn, it is
      the only thing drawn, and every hop meets its planet on the rim —
      measured from the planet's own drawn rectangle, which is what
      stopped the lines floating beside the worlds;

   B. the fog: worlds you hold see wide, fleets see narrow, a lost
      contact is remembered for two minutes as a ghost, and a contact
      the database itself reports is never hidden.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/supply-fog-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}
function near(a, b, slack) { return Math.abs(a - b) <= (slack || 0.6); }

/* ---------- the pieces of the page under test ---------- */

const SUP_START = "/* =========================================================\n   SUPPLY NETWORK";
const supStart = HTML.indexOf(SUP_START);
const supEnd = HTML.indexOf("</script>", supStart);
const SUP = supStart === -1 ? "" : HTML.slice(supStart, supEnd);

const BOX_START = "function planetDrawBox(name) {";
const boxStart = HTML.indexOf(BOX_START);
const boxEnd = HTML.indexOf("/* =========================================\n   FLEET LOCATION", boxStart);
const BOX = boxStart === -1 ? "" : HTML.slice(boxStart, boxEnd);

const FOG_START = "const VISION_WORLD = 20;";
const fogStart = HTML.indexOf(FOG_START);
const fogEnd = HTML.indexOf("async function loadFleets() {", fogStart);
const FOG = fogStart === -1 ? "" : HTML.slice(fogStart, fogEnd);

const STATE = {
    me: "Combine",
    worlds: [
        { planet: "Ultramars", parent: null, x: 10, y: 19, income: 100, capital: true },
        { planet: "Kara", parent: "Ultramars", x: 20, y: 40, income: 50, capital: false }
    ],
    links: [
        { from: "Kara", to: "Ultramars", open: true },
        { from: "Krieg", to: "Kara", open: false }
    ],
    worlds_full: [
        { planet: "Kara", open: true, blockers: [] },
        { planet: "Krieg", open: false, blockers: [{ x: 70, y: 85 }] }
    ]
};

function rect(left, top, width, height) {
    return {
        left: left, top: top, right: left + width, bottom: top + height,
        width: width, height: height, x: left, y: top
    };
}

/* a 1000 x 500 planet layer with two drawn planets in it */
function mountMap(w, planets, layerBox) {

    const layer = w.document.createElement("div");
    layer.id = "planet-layer";
    w.document.body.appendChild(layer);

    Object.defineProperty(layer, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(layer, "clientHeight", { value: 500, configurable: true });
    layer.getBoundingClientRect = () => (layerBox || rect(0, 0, 1000, 500));

    for (const [name, box] of Object.entries(planets)) {

        const el = w.document.createElement("div");
        el.className = "planet";
        el.dataset.name = name;
        el.getBoundingClientRect = () => box;
        Object.defineProperty(el, "offsetWidth", { value: box.width, configurable: true });
        layer.appendChild(el);

    }

    return layer;
}

/* ---------- A. the supply net ---------- */

async function mountSupply(faction, planets, layerBox) {

    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });

    const w = dom.window;

    w.localStorage.setItem("gf_lang", "en");
    w.eval(I18N);

    w.playerFaction = faction;
    w.escapeHTML = v => String(v == null ? "" : v);

    const calls = [];
    w.supabaseClient = {
        rpc(name) {
            calls.push(name);
            if (name === "supply_state") { return Promise.resolve({ data: STATE, error: null }); }
            return Promise.resolve({ data: null, error: null });
        }
    };

    mountMap(w, planets || {}, layerBox);

    /* jsdom has no canvas; record what would have been painted */
    const strokes = [];
    const ctx = {
        beginPath() { this.current = []; },
        moveTo(x, y) { this.current = [[x, y]]; },
        lineTo(x, y) {
            if (!this.current) { this.current = []; }
            this.current.push([x, y]);
            if (this.current.length === 2) { strokes.push(this.current.slice()); }
        },
        stroke() {},
        save() {}, restore() {},
        setTransform() {}, clearRect() {}, setLineDash() {}, arc() {},
        lineWidth: 1, strokeStyle: ""
    };

    w.HTMLCanvasElement.prototype.getContext = function () { return ctx; };

    w.eval(BOX);
    w.eval(SUP);

    const tick = () => new Promise(r => setTimeout(r, 20));
    await tick();
    await tick();
    await tick();

    return { w, dom, calls, strokes, tick, layer: w.document.getElementById("planet-layer") };
}

async function runSupply() {

    console.log("the net is in the page and has no screen of its own");
    check("it was found", SUP.length > 1500, SUP.length);
    check("no SUPPLY LINES button anywhere in the map", !/sup-open/.test(HTML));
    check("no supply tab either", !/sup-tab/.test(HTML));
    check("and no panel markup is built", !/SUPPLY LINES/.test(SUP));

    console.log("\nthe lines are drawn from the planets' own rectangles");
    {
        /* the layer sits 60px down the page; each planet is drawn at the
           centre of its 18px box, so the centre is the box's middle */
        const planets = {
            Kara: rect(200, 260, 18, 18),        /* centre  209, 269 */
            Ultramars: rect(100, 150, 18, 18)    /* centre  109, 159 */
        };

        const { w, strokes, calls, layer } = await mountSupply("Combine", planets, rect(0, 60, 1000, 500));

        check("the database was asked for the net", calls.includes("supply_state"));
        check("a canvas was put under the planets", !!w.document.getElementById("supply-canvas"));
        check("it is the first child, so it paints below them", layer.firstChild.id === "supply-canvas");

        check("one hop was painted, the other has no planet on the map", strokes.length === 1, strokes.length);

        const [start, end] = strokes[0] || [[0, 0], [0, 0]];

        /* the layer starts 60px down, so Kara's disc is centred at
           (209,209) and Ultramars' at (109,99); the hop leaves and lands
           11px in from each centre */
        const dx = 109 - 209;
        const dy = 99 - 209;
        const len = Math.hypot(dx, dy);

        check("the line starts on Kara's rim, not its centre",
            near(start[0], 209 + dx / len * 11) && near(start[1], 209 + dy / len * 11),
            JSON.stringify(start));

        check("and it ends on Ultramars' rim",
            near(end[0], 109 - dx / len * 11) && near(end[1], 99 - dy / len * 11),
            JSON.stringify(end));

        check("so it is not floating beside the world",
            near(Math.hypot(start[0] - 209, start[1] - 209), 11), JSON.stringify(start));

        check("nothing is painted as a circle any more", !/ctx\.arc\(/.test(SUP));

        check("the readout counts what was drawn", w.SUPPLY_STATUS.drawn === 1, JSON.stringify(w.SUPPLY_STATUS));
        check("the hop on the map is open, so nothing is counted cut", w.SUPPLY_STATUS.cut === 0);

        w.close();
    }

    console.log("\na planet that is not on the map is not guessed at");
    {
        const { w, strokes } = await mountSupply("Combine", { Kara: rect(200, 260, 18, 18) });
        check("the hop to a missing world is skipped", strokes.length === 0, strokes.length);
        w.close();
    }

    console.log("\nthe map is redrawn when it moves");
    check("on load", /window\.addEventListener\("load", draw\)/.test(SUP));
    check("on resize", /window\.addEventListener\("resize", draw\)/.test(SUP));
    check("and when the layer changes size", /ResizeObserver/.test(SUP));

    console.log("\nthe cross marks where the enemy actually is");
    check("in the layer's own pixels", /cross\(ctx, Number\(b\.x\) \/ 100 \* w, Number\(b\.y\) \/ 100 \* h\)/.test(SUP));
    check("not in some third coordinate space", !/Math\.max\(h, layer\.offsetHeight/.test(SUP));

    console.log("\nthe two main factions run a net, nobody else");
    for (const f of ["Independents", ""]) {
        const { w } = await mountSupply(f, { Kara: rect(0, 0, 18, 18) });
        check('"' + (f || "no faction") + '" draws no net', !w.document.getElementById("supply-canvas"));
        w.close();
    }

    console.log("\nplanetDrawBox is the one answer to where a world is");
    {
        const { w } = await mountSupply("Combine", { Kara: rect(200, 260, 18, 18) }, rect(0, 60, 1000, 500));
        const box = w.planetDrawBox("Kara");
        check("its centre is the middle of the drawn disc", near(box.x, 209) && near(box.y, 209),
            JSON.stringify(box));
        check("and its radius comes from the disc", near(box.r, 11), JSON.stringify(box));
        check("a world that is not on the map has no box", w.planetDrawBox("Nowhere") === null);
        w.close();
    }
}

/* ---------- B. the fog of war ---------- */

const POS = {
    Ultramars: [10, 19],
    Krieg: [70, 85],
    Kara: [20, 40],
    Faraway: [95, 5]
};

function fogWindow() {

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously"
    });

    const w = dom.window;

    w.playerFaction = "Combine";
    w.playerID = "me";
    w.getPlanetPosition = name => POS[name] || [50, 50];
    w.getFleetPosition = function (fleet) {
        if (fleet.space_x != null) { return [Number(fleet.space_x), Number(fleet.space_y)]; }
        return POS[fleet.origin] || [50, 50];
    };
    w.fleets = [];
    w.escapeHTML = v => String(v == null ? "" : v);

    for (const [name, owner] of [["Ultramars", "Combine"], ["Krieg", "Combine"], ["Kara", "Independents"]]) {
        const el = w.document.createElement("div");
        el.className = "planet";
        el.dataset.name = name;
        el.dataset.owner = owner;
        w.document.body.appendChild(el);
    }

    /* let/const inside an eval do not survive it, so the block hands back
       a handle on the two lists the page shares with its other scripts */
    w.eval(FOG + "\n;window.__fog = {" +
        "setFleetSource: v => { fleetSource = v; }," +
        "getFleetSource: () => fleetSource," +
        "clearReported: () => { reportedContacts = new Set(); }," +
        "report: id => { reportedContacts.add(String(id)); }" +
        "};");

    return w;
}

function runFog() {

    console.log("the fog block is in the map page");
    check("it was found", FOG.length > 500, FOG.length);
    check("vision is layered: worlds wide, fleets narrow",
        /const VISION_WORLD = 20;/.test(FOG) && /const VISION_FLEET = 12;/.test(FOG));

    const w = fogWindow();

    console.log("\nwhat is watching");
    const anchors = w.visionAnchors();
    check("only the worlds we hold look out, with the wide circle",
        anchors.filter(a => a.r === 20).length === 2, JSON.stringify(anchors));
    check("the independent world is not ours to look with",
        !anchors.some(a => a.x === POS.Kara[0] && a.y === POS.Kara[1]));

    /* a patrol far from every world we hold, so only its own bubble counts */
    w.fleets = [{ id: "ours", player_id: "me", faction: "Combine", name: "Our Watch", status: "stationed", origin: "Faraway" }];
    const withFleet = w.visionAnchors();
    check("a fleet of ours adds its own narrow bubble", withFleet.some(a => a.r === 12), JSON.stringify(withFleet));

    console.log("\nthe two ranges are real distances");
    const anchors2 = w.visionAnchors();
    const at = (x, y) => ({ id: "e", faction: "Freedom Authority", status: "in_space", space_x: x, space_y: y });

    check("an enemy eleven units from our patrol is seen", w.fleetInVision(at(95, 5 + 11), anchors2) === true);
    check("thirteen units off is not", w.fleetInVision(at(95, 5 + 13), anchors2) === false);

    check("but a world of ours sees nineteen units out",
        w.fleetInVision(at(10, 19 + 19), anchors2) === true, JSON.stringify(anchors2));
    check("and no further than twenty",
        w.fleetInVision(at(10, 19 + 21), anchors2) === false, JSON.stringify(anchors2));

    check("our own fleet is always drawn", w.fleetInVision(w.fleets[0], anchors2) === true);
    check("a fleet of ours under the other flag is the enemy",
        w.fleetInVision({ id: "d", player_id: "me", faction: "Freedom Authority", status: "in_space", space_x: 60, space_y: 60 }, anchors2) === false);
    check("a fleet with no faction is never hidden",
        w.fleetInVision({ id: "x", faction: "", status: "in_space", space_x: 2, space_y: 2 }, anchors2) === true);
    check("a fleet with no position is never invented",
        w.fleetInVision({ id: "p", faction: "Freedom Authority", status: "travelling" }, []) === false);

    console.log("\nwhat a world changing hands does");
    const raider = { id: "r", faction: "Freedom Authority", status: "in_space", space_x: 20, space_y: 40 + 15 };
    check("a raider over an independent world is fog", w.fleetInVision(raider, anchors2) === false);

    w.document.querySelectorAll(".planet").forEach(function (el) {
        if (el.dataset.name === "Kara") { el.dataset.owner = "Combine"; }
    });
    check("the moment that world is ours, it is in sight",
        w.fleetInVision(raider, w.visionAnchors()) === true);

    console.log("\nthe whole list is kept, the fog is applied on top");
    w.__fog.setFleetSource([
        { id: "own", faction: "Combine", status: "stationed", origin: "Krieg" },
        { id: "seen", faction: "Freedom Authority", status: "in_space", space_x: 10, space_y: 30 },
        { id: "dark", faction: "Freedom Authority", status: "in_space", space_x: 60, space_y: 60 }
    ]);
    w.__fog.clearReported();
    w.applyFog();

    const ids = w.fleets.map(f => f.id).join(",");
    check("our ships and the contact in sight are drawn", ids === "own,seen", ids);
    check("the far one is fog", !w.fleets.some(f => f.id === "dark"));
    check("the unfogged list is still whole", w.__fog.getFleetSource().length === 3,
        w.__fog.getFleetSource().length);

    w.__fog.report("dark");
    w.applyFog();
    check("a contact the database reports is never hidden", w.fleets.some(f => f.id === "dark"),
        w.fleets.map(f => f.id).join(","));

    console.log("\na lost contact is remembered for two minutes");
    {
        const w2 = fogWindow();
        const t0 = 1000000;
        w2.Date.now = () => t0;

        w2.__fog.setFleetSource([{ id: "raider", faction: "Freedom Authority", name: "Raider", status: "in_space", space_x: 10, space_y: 30 }]);
        w2.applyFog();
        check("in sight it is a real marker", w2.fleets.length === 1 && w2.lastSeenGhosts().length === 0);

        /* it slips out of the wide circle */
        w2.__fog.getFleetSource()[0].space_x = 95;
        w2.__fog.getFleetSource()[0].space_y = 5;
        w2.applyFog();

        const ghosts = w2.lastSeenGhosts();
        check("out of sight it becomes a ghost", ghosts.length === 1, JSON.stringify(ghosts));
        check("at the place it was last seen", ghosts[0] && ghosts[0].x === 10 && ghosts[0].y === 30,
            JSON.stringify(ghosts[0]));
        check("with the time it has left on the clock", ghosts[0] && ghosts[0].left === 120000,
            ghosts[0] && ghosts[0].left);
        check("and it is no longer a live contact", !w2.fleets.some(f => f.id === "raider"));

        w2.Date.now = () => t0 + 60000;
        check("a minute later it is still there", w2.lastSeenGhosts().length === 1);
        check("with a minute left", w2.lastSeenGhosts()[0].left === 60000);

        w2.Date.now = () => t0 + 120001;
        check("after two minutes it is forgotten", w2.lastSeenGhosts().length === 0);

        w2.close();
    }

    console.log("\nback in sight it stops being a ghost");
    {
        const w3 = fogWindow();
        const t0 = 2000000;
        w3.Date.now = () => t0;
        w3.__fog.setFleetSource([{ id: "raider", faction: "Freedom Authority", status: "in_space", space_x: 10, space_y: 30 }]);
        w3.applyFog();
        w3.__fog.getFleetSource()[0].space_x = 95;
        w3.__fog.getFleetSource()[0].space_y = 5;
        w3.applyFog();
        check("lost, it is a ghost", w3.lastSeenGhosts().length === 1);

        w3.__fog.getFleetSource()[0].space_x = 10;
        w3.__fog.getFleetSource()[0].space_y = 30;
        w3.applyFog();
        check("found again, the ghost is gone", w3.lastSeenGhosts().length === 0);
        check("and the real marker is back", w3.fleets.length === 1);

        w3.close();
    }

    console.log("\nthe page is wired to it");
    check("the loader keeps every fleet before the fog",
        /fleetSource = \(refreshed \|\| \[\]\)/.test(HTML));
    check("the fog is applied on top of that list", /applyFog\(\);/.test(HTML));
    check("the server's own reading is added to it", /visible_enemy_fleets/.test(HTML));
    check("and those contacts are protected from the fog", /reportedContacts\.add\(String\(f\.id\)\)/.test(HTML));
    check("a change of owners re-runs the fog",
        /owners !== lastOwnerReading/.test(HTML) && /lastOwnerReading = owners;/.test(HTML));
    check("no enemy fleet is ever pushed without a position",
        /if \(!at \|\| !isFinite\(at\[0\]\) \|\| !isFinite\(at\[1\]\)\) \{ continue; \}/.test(HTML));

    check("the readout says how many are in sight", /ENEMY IN SIGHT/.test(HTML));
    check("and how many were lost", /LAST SEEN CONTACT/.test(HTML));
    check("the ghosts are drawn dashed", /fleet-marker\.ghost/.test(HTML));

    w.close();
}

(async function main() {
    try {
        await runSupply();
        console.log("\n" + "-".repeat(50) + "\n");
        runFog();
    }
    catch (e) {
        console.log("\nCRASH: " + String((e && e.stack) || e).slice(0, 1200));
        process.exit(1);
    }
    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);
})();
