/* =========================================================
   SHIP ART
   The silhouettes are traced one to one from the reference
   picture (two large ships, three small ones). In the art the
   pointed tail is the BOW: ships fly towards the right
   when drawn unrotated. "x, y" is the place each ship holds in
   the reference formation (original pixels).

   Recruited units are normal (small) ships; units that need a
   factory (Tank, Artillery) and the elite Arstartes are big ships.

   THE SLAVER CLASS (2026-11-31): a transport fleet is drawn with
   its own hull, the smallest in the game — a short, blunt, unarmed
   hauler, narrower and lower than small1/2/3, with no gun barrel
   and no bridge tower. Three of them fly the marker, in a tighter
   formation and at a smaller scale than any line fleet, so a
   cargo fleet is never mistaken for a warship or a squadron. It
   carries no divisions at all: it cannot fight, and is taken by
   any warship that meets it.
========================================================= */
const SHIP_ART = [{"name": "slaver", "w": 34.0, "h": 12.0, "x": 0.0, "y": 0.0, "d": "M6.0 0.4 L13.0 2.6 L22.0 3.0 L29.0 2.8 L32.6 5.4 L33.4 8.6 L30.4 11.2 L17.0 11.6 L11.4 10.2 L6.8 11.2 L2.6 9.8 L0.4 7.0 L0.8 3.6 L6.0 0.4 Z"}, {"name": "bigA", "w": 97.8, "h": 35.0, "x": 44.0, "y": 35.8, "d": "M27.0 0.2 L32.8 4.2 L37.2 6.0 L57.8 9.0 L62.5 10.8 L71.5 10.4 L82.0 11.0 L83.8 12.2 L86.5 17.2 L90.7 22.0 L93.2 23.8 L97.5 24.8 L96.2 25.3 L85.5 25.3 L83.0 24.8 L77.8 22.1 L74.5 22.6 L61.2 22.5 L56.8 21.7 L51.0 23.3 L43.8 23.4 L39.8 25.1 L28.2 26.1 L27.3 26.8 L26.9 28.2 L28.1 32.5 L27.9 34.5 L27.0 35.0 L23.8 34.2 L19.8 29.8 L18.8 27.0 L16.5 24.2 L14.5 23.4 L11.8 24.6 L9.2 24.3 L6.2 21.4 L2.2 20.9 L0.2 17.2 L-0.1 15.0 L1.8 10.7 L4.9 8.2 L8.0 7.4 L12.8 7.5 L16.0 6.0 L23.8 4.8 L27.0 0.2Z"}, {"name": "bigB", "w": 107.8, "h": 40.2, "x": 141.5, "y": 70.2, "d": "M30.5 -0.0 L33.5 3.0 L41.5 7.0 L53.8 9.1 L56.8 8.8 L60.0 10.3 L65.0 10.6 L69.2 12.6 L73.5 11.9 L91.2 13.0 L92.8 14.2 L95.9 20.5 L99.0 24.1 L102.5 26.8 L106.8 27.2 L107.6 28.2 L106.5 28.9 L98.2 29.1 L91.8 28.4 L86.2 25.4 L82.5 26.1 L68.0 26.1 L63.2 25.2 L57.5 26.8 L49.0 27.2 L45.8 28.6 L40.5 29.6 L32.2 30.0 L30.9 31.8 L31.1 34.5 L32.3 37.0 L31.6 39.8 L30.5 40.2 L26.2 38.9 L21.7 33.8 L20.8 30.8 L18.2 27.7 L16.8 27.2 L13.5 28.3 L10.2 28.1 L8.9 27.5 L7.2 25.0 L2.8 24.1 L1.7 23.0 L-0.1 17.5 L2.0 12.5 L5.2 9.8 L9.0 8.7 L14.8 8.5 L17.2 7.0 L26.2 5.7 L29.5 0.5 L30.5 -0.0Z"}, {"name": "small1", "w": 52.8, "h": 18.5, "x": 33.2, "y": 118.2, "d": "M15.5 -0.0 L23.0 2.8 L36.8 5.3 L43.0 5.1 L47.2 5.8 L48.6 6.8 L52.6 12.8 L51.2 13.3 L45.2 11.7 L34.2 11.4 L25.5 12.2 L16.0 13.9 L14.9 15.2 L15.2 18.0 L13.8 18.5 L9.2 13.0 L4.8 12.5 L1.0 10.5 L0.0 9.2 L-0.1 7.2 L0.8 5.2 L2.5 4.0 L13.2 1.5 L15.5 -0.0Z"}, {"name": "small2", "w": 54.0, "h": 19.2, "x": 126.8, "y": 132.2, "d": "M16.0 -0.0 L21.0 2.5 L36.8 5.5 L48.0 6.0 L53.7 13.5 L50.5 13.8 L46.0 12.4 L35.0 12.1 L25.8 12.9 L16.5 14.7 L15.7 16.0 L15.9 18.8 L14.2 19.2 L13.0 18.2 L10.0 13.9 L8.2 13.2 L5.5 13.2 L2.0 11.4 L0.6 10.2 L0.0 8.2 L1.0 5.8 L2.8 4.3 L12.8 2.1 L16.0 -0.0Z"}, {"name": "small3", "w": 53.2, "h": 18.5, "x": 65.8, "y": 148.2, "d": "M15.5 -0.0 L21.5 2.5 L36.5 5.3 L47.3 5.7 L48.8 6.7 L53.0 12.8 L52.2 13.3 L50.2 13.3 L45.2 11.7 L33.5 11.4 L26.0 12.2 L16.0 14.1 L15.1 15.2 L15.3 18.0 L14.0 18.5 L9.2 13.1 L5.0 12.6 L0.8 10.3 L-0.1 7.8 L0.6 5.8 L2.2 4.1 L13.0 1.7 L15.5 -0.0Z"}];

const SHIP_ART_BY_NAME = {};
SHIP_ART.forEach(function(a) { SHIP_ART_BY_NAME[a.name] = a; });

/* every line ship, biggest first: the slaver is smaller than all of them */
const LINE_SHIP_SIZES = ["bigB", "bigA", "small2", "small1", "small3"].map(function(name) {
    return { name: name, w: SHIP_ART_BY_NAME[name].w, h: SHIP_ART_BY_NAME[name].h };
});

/* "Knightmare" is a LAND unit: in space it is the carrier ship (the flagship) that brings the squad */
const BIG_SHIP_TYPES = ["Tank", "Artillery", "Arstartes", "Knightmare"];

/* the oldest Knightmare squad of a fleet: index into the "born" list (squads without a date count as oldest) */
function oldestKnightmareIndex(entry) {
    const n = Math.max(0, Number(entry.amount) || 0);
    const born = (entry.born || []).slice();
    while (born.length < n) { born.unshift("1970-01-01T00:00:00Z"); }
    let best = 0;
    for (let i = 1; i < n; i++) { if (String(born[i]) < String(born[best])) { best = i; } }
    return best;
}

function shipClass(type) {
    return BIG_SHIP_TYPES.indexOf(type) !== -1 ? "big" : "small";
}

/* the slaver is the smallest hull there is, and the only one with no gun:
   its measurements are here so any screen that compares models can ask */
const SLAVER_CLASS = {
    hull: "slaver",
    width: 34.0,
    height: 12.0,
    guns: 0,
    divisions: 0,
    slower: true
};

/* how many divisions of each class a fleet has */
function shipComposition(squads) {

    let big = 0;
    let small = 0;
    let flagship = false;

    for (const e of squads || []) {
        const n = Math.max(0, Number(e.amount) || 0);
        if (shipClass(e.type) === "big") { big += n; } else { small += n; }
        /* a ship that carries a Knightmare squad is the fleet's flagship */
        if (e.type === "Knightmare" && n > 0) { flagship = true; }
    }

    return { big: big, small: small, flagship: flagship };

}

/* a transport fleet is a slaver fleet, whatever the screen calls it */
function isCargoFleet(fleet) {
    return !!(fleet && (fleet.transport_fleet === true || fleet.transport === true));
}

/* the slaver formation: three short hulls, tight, and nothing above them */
const SLAVER_FORMATION = [[0, 0], [40, 15], [78, 5]];

/* the fleet marker on the galactic map: one ship per division (at least 5, at most 10), in the
   loose formation of the reference picture. Big ships lead along the diagonal, small ones follow below.

   A cargo fleet is drawn differently: three slaver hulls, no big ships, at 62% of the marker's
   width and a lower scale cap, so it reads as a small unarmed thing beside the line. */
function fleetShipsSVG(fleet, targetWidth) {

    targetWidth = targetWidth || 96;

    const cargo = isCargoFleet(fleet);
    const placed = [];

    let width = targetWidth;
    let maxScale = 0.62;

    if (cargo) {

        width = targetWidth * 0.62;
        maxScale = 0.5;

        for (const spot of SLAVER_FORMATION) {
            placed.push({
                art: SHIP_ART_BY_NAME.slaver,
                x: spot[0],
                y: spot[1],
                flag: false
            });
        }

    }
    else {

        const comp = shipComposition(fleet.squads);
        const total = comp.big + comp.small;
        const nShips = Math.max(5, Math.min(10, total));

        const nBig = comp.big === 0 ? 0 : Math.min(3, comp.big, nShips - 1);
        const nSmall = nShips - nBig;

        for (let i = 0; i < nBig; i++) {
            placed.push({ art: SHIP_ART_BY_NAME[i % 2 ? "bigB" : "bigA"], x: i * 100, y: i * 30, flag: comp.flagship && i === nBig - 1 });
        }

        const y0 = nBig ? (nBig - 1) * 30 + 52 : 0;
        const cols = nSmall <= 4 ? nSmall : 4;

        for (let j = 0; j < nSmall; j++) {
            const col = j % cols;
            const row = Math.floor(j / cols);
            placed.push({
                art: SHIP_ART_BY_NAME["small" + (1 + j % 3)],
                x: col * 66 + (row % 2) * 30 + (nBig ? 0 : 6),
                y: y0 + row * 28 + (col % 2) * 9
            });
        }

    }

    let x0 = Infinity, y1v = Infinity, x1 = -Infinity, y1 = -Infinity;

    for (const p of placed) {
        x0 = Math.min(x0, p.x); y1v = Math.min(y1v, p.y);
        x1 = Math.max(x1, p.x + p.art.w); y1 = Math.max(y1, p.y + p.art.h);
    }

    const pad = cargo ? 4 : 6;
    const w = x1 - x0 + pad * 2;
    const h = y1 - y1v + pad * 2;
    const scale = Math.max(cargo ? 0.26 : 0.3, Math.min(maxScale, width / w));

    return '<svg class="fleet-ships' + (cargo ? " cargo" : "") + '" width="' + (w * scale).toFixed(1) +
        '" height="' + (h * scale).toFixed(1) +
        '" viewBox="0 0 ' + w.toFixed(1) + ' ' + h.toFixed(1) + '" xmlns="http://www.w3.org/2000/svg">' +
        placed.map(function(p) {
            return '<path class="hull" d="' + p.art.d + '" transform="translate(' + (p.x - x0 + pad).toFixed(1) + ' ' + (p.y - y1v + pad).toFixed(1) + ')"' +
                (p.flag ? ' stroke="#ffd24c" stroke-width="5" paint-order="stroke"' : '') + '/>';
        }).join("") +
        '</svg>';

}
