/* The slaver class in ships.js: a hull smaller than every line ship, drawn
   only for a transport fleet, three of them in a tight formation and at a
   smaller scale than any warship marker.

   Run: node tmp-test/slaver-art-test.js */

const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "ships.js"), "utf8");

const api = new Function(SOURCE + `
    return {
        SHIP_ART: SHIP_ART,
        SHIP_ART_BY_NAME: SHIP_ART_BY_NAME,
        SLAVER_CLASS: SLAVER_CLASS,
        LINE_SHIP_SIZES: LINE_SHIP_SIZES,
        SLAVER_FORMATION: SLAVER_FORMATION,
        fleetShipsSVG: fleetShipsSVG,
        isCargoFleet: isCargoFleet,
        shipComposition: shipComposition
    };
`)();

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function size(svg) {
    const m = /<svg class="fleet-ships[^"]*" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
    return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 };
}

const CARGO = { id: "f1", name: "Coffin Ships", squads: [], transport_fleet: true };
const LINE = { id: "f2", name: "Spear of Ultramar", squads: [
    { type: "Rifle", amount: 3 },
    { type: "MG", amount: 1 },
    { type: "Assault", amount: 1 }
] };
const ARMOURED = { id: "f3", name: "Hammer of Mars", squads: [
    { type: "Tank", amount: 2 },
    { type: "Rifle", amount: 4 }
] };

console.log("\n== the slaver hull");

const slaver = api.SHIP_ART_BY_NAME.slaver;

ok("the slaver is in the ship art", !!slaver);
ok("it has its own path", !!slaver && /^M[\d. ]+L/.test(slaver.d), slaver && slaver.d.slice(0, 20));
ok("its path is closed", !!slaver && /Z$/.test(slaver.d));

const lineShips = api.LINE_SHIP_SIZES || [];

ok("the line ships are all registered", lineShips.length === 5, lineShips.length);

const widestLine = Math.max.apply(null, lineShips.map(function(s) { return s.w; }));
const tallestLine = Math.max.apply(null, lineShips.map(function(s) { return s.h; }));
const smallestLine = Math.min.apply(null, lineShips.map(function(s) { return s.w; }));

ok("the slaver is narrower than every line ship",
    slaver && lineShips.every(function(s) { return slaver.w < s.w; }),
    { slaver: slaver && slaver.w, smallestLine: smallestLine });
ok("the slaver is lower than every line ship",
    slaver && lineShips.every(function(s) { return slaver.h < s.h; }),
    { slaver: slaver && slaver.h, tallestLine: tallestLine });
ok("it is the smallest hull in the file",
    slaver && api.SHIP_ART.every(function(a) { return a.name === "slaver" || (a.w >= slaver.w && a.h >= slaver.h); }));

console.log("\n== the class itself");

ok("the class names the hull", api.SLAVER_CLASS.hull === "slaver");
ok("it carries no gun", api.SLAVER_CLASS.guns === 0);
ok("and no divisions", api.SLAVER_CLASS.divisions === 0);
ok("its measurements match the art",
    api.SLAVER_CLASS.width === slaver.w && api.SLAVER_CLASS.height === slaver.h, api.SLAVER_CLASS);

console.log("\n== which fleets fly it");

ok("a transport fleet is a cargo fleet", api.isCargoFleet(CARGO) === true);
ok("the board's own word for it works too", api.isCargoFleet({ transport: true }) === true);
ok("a warship is not", api.isCargoFleet(LINE) === false);
ok("nor is anything else", api.isCargoFleet({}) === false && api.isCargoFleet(null) === false);

const cargoSvg = api.fleetShipsSVG(CARGO);
const lineSvg = api.fleetShipsSVG(LINE);
const armouredSvg = api.fleetShipsSVG(ARMOURED);

ok("the cargo marker is marked as cargo", /class="fleet-ships cargo"/.test(cargoSvg), cargoSvg.slice(0, 80));
ok("it flies three hulls", (cargoSvg.match(/<path /g) || []).length === 3,
    (cargoSvg.match(/<path /g) || []).length);
ok("they are the slaver hull", cargoSvg.indexOf(slaver.d) !== -1);
ok("and nothing from the line", cargoSvg.indexOf(api.SHIP_ART_BY_NAME.small1.d) === -1 &&
    cargoSvg.indexOf(api.SHIP_ART_BY_NAME.bigA.d) === -1);

ok("a warship still flies the small hulls", lineSvg.indexOf(api.SHIP_ART_BY_NAME.small1.d) !== -1 &&
    lineSvg.indexOf(slaver.d) === -1);
ok("and an armoured one still leads with the big ships",
    armouredSvg.indexOf(api.SHIP_ART_BY_NAME.bigA.d) !== -1 && armouredSvg.indexOf(slaver.d) === -1);

console.log("\n== how big it is drawn");

const cargoSize = size(cargoSvg);
const lineSize = size(lineSvg);
const armouredSize = size(armouredSvg);

ok("the cargo marker is narrower than a squadron", cargoSize.w < lineSize.w,
    { cargo: cargoSize.w, line: lineSize.w });
ok("and lower", cargoSize.h < lineSize.h, { cargo: cargoSize.h, line: lineSize.h });
ok("it is narrower than an armoured fleet too", cargoSize.w < armouredSize.w,
    { cargo: cargoSize.w, armoured: armouredSize.w });
ok("it is still a real marker, not a dot", cargoSize.w >= 20 && cargoSize.h >= 6, cargoSize);

ok("a wider marker request scales it up but keeps it small",
    size(api.fleetShipsSVG(CARGO, 200)).w <= 70, size(api.fleetShipsSVG(CARGO, 200)));

console.log("\n== the formation");

ok("three places are declared", api.SLAVER_FORMATION.length === 3, api.SLAVER_FORMATION.length);
ok("no two hulls share a place",
    new Set(api.SLAVER_FORMATION.map(function(p) { return p.join(","); })).size === 3);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
