/* The slave routes on the galactic map: the lanes are drawn from the planets'
   real positions, thicker with more crossings, the busiest three carry a glow
   and their count, and nothing is drawn when the server answers nothing.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/traderoutes-page-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "traderoutes.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 30); }); }

const ROUTES = {
    me: "Combine",
    best: 12,
    routes: [
        { from: "Tuskara", to: "Krieg", trips: 12, slaves: 12000, weight: 1, major: true,
          x1: 44, y1: 92, x2: 70, y2: 85 },
        { from: "Krieg", to: "Ultramars", trips: 3, slaves: 2400, weight: 0.25, major: false,
          x1: 70, y1: 85, x2: 10, y2: 19 }
    ]
};

const BOXES = {
    "Tuskara": { x: 220, y: 460, r: 18 },
    "Krieg": { x: 350, y: 425, r: 16 },
    "Ultramars": { x: 50, y: 95, r: 16 }
};

async function open(options) {

    options = options || {};

    const dom = new JSDOM(
        '<!doctype html><html><body><div id="galaxy-map">' +
        '<div id="planet-layer" style="position:absolute;width:600px;height:600px"></div>' +
        '</div></body></html>',
        { url: "http://localhost/galaxy.html", runScripts: "dangerously", pretendToBeVisual: true }
    );

    const w = dom.window;

    /* the map hands the page its own geometry */
    w.planetDrawBox = function (name) { return BOXES[name] || null; };
    w.playerFaction = options.faction || "Combine";

    /* jsdom lays nothing out, so the map's own size is given to it */
    const layerEl = w.document.getElementById("planet-layer");
    Object.defineProperty(layerEl, "clientWidth", { value: 600 });
    Object.defineProperty(layerEl, "clientHeight", { value: 600 });

    const ctx = {
        lineWidth: 1,
        strokeStyle: "",
        fillStyle: "",
        font: "",
        textAlign: "",
        textBaseline: "",
        lineDashOffset: 0,
        segments: [],
        labels: [],
        dashes: [],
        setTransform: function () {},
        clearRect: function () { this.segments = []; this.labels = []; },
        save: function () {},
        restore: function () {},
        beginPath: function () { this._last = null; },
        moveTo: function (x, y) { this._last = [x, y]; },
        lineTo: function (x, y) {
            this.segments.push({
                from: this._last,
                to: [x, y],
                width: this.lineWidth,
                colour: this.strokeStyle,
                dash: this.dashes[this.dashes.length - 1]
            });
        },
        stroke: function () {},
        setLineDash: function (d) { this.dashes.push(d); },
        fillText: function (text, x, y) { this.labels.push({ text: text, x: x, y: y }); }
    };

    w.HTMLCanvasElement.prototype.getContext = function () { return ctx; };

    const calls = [];

    w.supabaseClient = {
        rpc: async function (fn, args) {
            calls.push({ fn: fn, args: args });
            if (options.broken) {
                return { data: null, error: { message: "function public.tusken_trade_routes() does not exist" } };
            }
            if (fn === "tusken_trade_routes") {
                return {
                    data: options.faction === undefined || options.faction === "Combine"
                        ? ROUTES
                        : { me: options.faction, best: 0, routes: [] },
                    error: null
                };
            }
            return { data: null, error: { message: "unknown call" } };
        }
    };

    const script = w.document.createElement("script");
    script.textContent = SOURCE;
    w.document.body.appendChild(script);

    await wait(60);

    return { dom: dom, doc: w.document, ctx: ctx, calls: calls, w: w };

}

(async function main() {

    try {

        console.log("\n== the lanes of the faction");

        const p = await open();

        const read = p.calls.filter(function (c) { return c.fn === "tusken_trade_routes"; })[0];

        ok("the map asks the server for the lanes", !!read);
        ok("a canvas is laid over the worlds", !!p.doc.getElementById("trade-canvas"));
        ok("it cannot take a click", /pointer-events:\s*none/.test(
            p.doc.getElementById("trade-canvas").getAttribute("style") || ""),
            p.doc.getElementById("trade-canvas").getAttribute("style"));
        ok("and sits under the worlds", p.doc.getElementById("planet-layer").firstElementChild.id === "trade-canvas");

        /* two lanes: the major is drawn twice (glow and line) */
        ok("every lane is drawn, the major twice", p.ctx.segments.length === 3,
            p.ctx.segments.map(function (s) { return s.width; }));

        const widths = p.ctx.segments.map(function (s) { return s.width; }).sort(function (a, b) { return a - b; });

        ok("the busiest lane is the thickest line", widths[widths.length - 2] === 3.4, widths);
        ok("its glow is the widest mark on the map", widths[widths.length - 1] === 7.4, widths);
        ok("a three-crossing lane is thinner", widths[0] === 2, widths);

        ok("the colour is the faction's own",
            p.ctx.segments.every(function (s) { return s.colour.indexOf("213,43,43") !== -1; }),
            p.ctx.segments.map(function (s) { return s.colour; }));

        ok("the busiest lane carries its crossings", p.ctx.labels.length === 1 &&
            p.ctx.labels[0].text === "12", p.ctx.labels);
        const majorLine = p.ctx.segments.filter(function (s) { return s.width === 3.4; })[0];

        ok("the count sits above the middle of the lane",
            p.ctx.labels[0] &&
            Math.abs(p.ctx.labels[0].x - (majorLine.from[0] + majorLine.to[0]) / 2) < 0.001 &&
            Math.abs(p.ctx.labels[0].y - ((majorLine.from[1] + majorLine.to[1]) / 2 - 7)) < 0.001,
            p.ctx.labels[0]);

        const lines = p.ctx.segments.filter(function (s) { return s.width === 3.4 || s.width === 2; });

        ok("the lanes meet the discs, not their centres",
            lines.every(function (s) {
                const box = s.width === 3.4 ? BOXES.Tuskara : BOXES.Krieg;
                const gap = Math.hypot(s.from[0] - box.x, s.from[1] - box.y);
                return Math.abs(gap - box.r) < 0.001;
            }), lines.map(function (s) { return s.from; }));

        ok("the dashes march, and the big lane has its own rhythm",
            p.ctx.segments.some(function (s) { return Array.isArray(s.dash) && s.dash[0] === 9; }),
            p.ctx.segments.map(function (s) { return s.dash; }));

        console.log("\n== the other side");

        const free = await open({ faction: "Freedom Authority" });

        ok("a faction with no lanes draws nothing", free.ctx.segments.length === 0,
            free.ctx.segments.length);
        ok("it still asks the server", free.calls.some(function (c) { return c.fn === "tusken_trade_routes"; }));

        console.log("\n== when the patch has not been run");

        const broken = await open({ broken: true });

        ok("no lanes are invented", broken.ctx.segments.length === 0, broken.ctx.segments.length);
        ok("and the map is left as it was", !!broken.doc.getElementById("trade-canvas"));

        console.log("\n== a faction of nobody");

        const none = await open({ faction: "Independents" });
        none.w.TRADE_ROUTES = none.w.TRADE_ROUTES || null;

        ok("an independent player draws no lanes at all",
            none.ctx.segments.length === 0 && !none.doc.getElementById("trade-canvas"),
            none.ctx.segments.length);

        console.log("\n== setting the lanes by hand");

        p.w.TRADE_ROUTES.set([{ from: "Krieg", to: "Ultramars", trips: 1, weight: 0.1, major: false }]);

        ok("the handle redraws at once", p.ctx.segments.length === 1, p.ctx.segments.length);
        ok("a single-crossing lane is a thin line", p.ctx.segments[0].width === 1.1,
            p.ctx.segments[0].width);

        p.w.TRADE_ROUTES.set(null);
        ok("and empties on command", p.ctx.segments.length === 0);

        p.dom.window.close();
        free.dom.window.close();
        broken.dom.window.close();
        none.dom.window.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
