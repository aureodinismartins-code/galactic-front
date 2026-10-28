/* Prints an occupancy grid of the galaxy map so a free spot for a new world
   can be picked without landing on top of another planet or under the UI.

   Run: node tmp-test/map-layout.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");

const m = src.match(/const planetPositions = \{([\s\S]*?)\n\};/);
const pos = eval("({" + m[1] + "})");

const names = Object.keys(pos);
const CELL = 4;                      // grid cell size in map percent
const cols = Math.floor(100 / CELL);
const rows = Math.floor(100 / CELL);

const grid = [];
for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        let owner = null;
        let dist = Infinity;
        for (const n of names) {
            const d = Math.hypot(pos[n][0] - cx, pos[n][1] - cy);
            if (d < dist) { dist = d; owner = n; }
        }
        line.push(dist < 5 ? owner : null);
    }
    grid.push(line);
}

/* regions the interface covers: the bottom-left control stack, the top-right
   menu, the header strip and the bottom-right icon pair */
function covered(x, y) {
    if (y < 8) return "header";                       // map header strip
    if (x > 84 && y < 26) return "menu";              // MAIN MENU / CONGRESS
    if (x < 24 && y > 66) return "controls";          // reset + phone mode
    if (x > 88 && y > 90) return "icons";             // news / music buttons
    return null;
}

console.log("    " + Array.from({ length: 25 }, (_, i) => String(i * 4).padStart(4)).join(""));
for (let r = 0; r < rows; r++) {
    let line = String(r * CELL).padStart(3) + " ";
    for (let c = 0; c < cols; c++) {
        const x = c * CELL + CELL / 2;
        const y = r * CELL + CELL / 2;
        const cov = covered(x, y);
        if (cov) { line += " x "; continue; }
        line += grid[r][c] ? " # " : " . ";
    }
    console.log(line);
}

console.log("\nfree cells at least 12 map-units from every planet:");
for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
        const x = c * CELL + CELL / 2;
        const y = r * CELL + CELL / 2;
        if (covered(x, y)) continue;
        const near = Math.min.apply(null, names.map((n) => Math.hypot(pos[n][0] - x, pos[n][1] - y)));
        if (near >= 12) {
            const dCapital = Math.min(
                Math.hypot(pos["Ultramars"][0] - x, pos["Ultramars"][1] - y),
                Math.hypot(pos["Free Earth"][0] - x, pos["Free Earth"][1] - y)
            );
            console.log("  [" + x + "," + y + "]  nearest planet " + near.toFixed(1) +
                        "   nearest capital " + dCapital.toFixed(1));
        }
    }
}
