/* =========================================================
   THE SLAVE ROUTES

   The lanes the pens are actually worked on: every load that
   sails is a crossing, and public.tusken_trade_routes() hands
   the map the busiest eight of THIS faction's lanes and
   nothing else — the other side's routes never leave the
   server.

   A lane with more crossings is drawn thicker and brighter,
   the three busiest carry a glow and their count, and the
   dashes march slowly in the direction of the trade, so the
   map reads as a working network rather than a diagram.

   The lines are drawn from the planets' real drawn positions
   (planetDrawBox in galaxy.html), so they meet the discs
   exactly at any layout or zoom, the same way the supply net
   does. This file does nothing at all for a player with no
   faction.
   ========================================================= */

(function () {

    "use strict";

    if (typeof playerFaction === "undefined") { return; }

    if (playerFaction !== "Freedom Authority" && playerFaction !== "Combine") { return; }

    const RGB = {
        "Combine": "213,43,43",
        "Freedom Authority": "52,124,255"
    };

    const AMBER = "240,207,138";

    let routes = [];
    let offset = 0;
    let reading = false;

    function layer() {
        return document.getElementById("planet-layer");
    }

    function canvasEl() {

        const el = layer();

        if (!el) { return null; }

        let c = document.getElementById("trade-canvas");

        if (!c) {
            c = document.createElement("canvas");
            c.id = "trade-canvas";
            c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;" +
                              "pointer-events:none;z-index:1;";
            el.insertBefore(c, el.firstChild);
        }

        return c;

    }

    /* the nearest point of a planet's rim to wherever the lane is heading */
    function rimPoint(fromX, fromY, toX, toY, radius) {

        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.hypot(dx, dy);

        if (!distance || !(radius > 0)) { return [fromX, fromY]; }

        const step = Math.min(radius, distance / 2);

        return [fromX + dx / distance * step, fromY + dy / distance * step];

    }

    function weightOf(route) {
        return Math.max(0, Math.min(1, Number(route.weight) || 0));
    }

    /* how heavy the lane is: crossings, not slaves, so a full hold is
       still one trip */
    function widthOf(route) {

        const trips = Number(route.trips) || 0;

        if (trips >= 10) { return 3.4; }
        if (trips >= 5) { return 2.6; }
        if (trips >= 3) { return 2.0; }
        if (trips >= 2) { return 1.5; }

        return 1.1;

    }

    function draw() {

        const el = layer();
        const c = canvasEl();

        if (!el || !c) { return; }

        const w = el.clientWidth;
        const h = el.clientHeight;

        if (!w || !h) { return; }

        const dpr = window.devicePixelRatio || 1;

        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
            c.width = Math.round(w * dpr);
            c.height = Math.round(h * dpr);
        }

        const ctx = c.getContext ? c.getContext("2d") : null;

        if (!ctx) { return; }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        if (typeof planetDrawBox !== "function") { return; }

        const rgb = RGB[playerFaction] || AMBER;

        for (const route of routes) {

            const from = planetDrawBox(route.from);
            const to = planetDrawBox(route.to);

            if (!from || !to) { continue; }

            const start = rimPoint(from.x, from.y, to.x, to.y, from.r);
            const end = rimPoint(to.x, to.y, from.x, from.y, to.r);

            if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 2) { continue; }

            const major = route.major === true;

            /* the busiest lanes sit under a soft glow */
            if (major) {

                ctx.save();
                ctx.lineWidth = widthOf(route) + 4;
                ctx.strokeStyle = "rgba(" + rgb + ",0.10)";
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(start[0], start[1]);
                ctx.lineTo(end[0], end[1]);
                ctx.stroke();
                ctx.restore();

            }

            ctx.save();
            ctx.lineWidth = widthOf(route);
            ctx.strokeStyle = "rgba(" + rgb + "," + (0.22 + 0.5 * weightOf(route)).toFixed(2) + ")";
            ctx.setLineDash(major ? [9, 5] : [5, 7]);
            ctx.lineDashOffset = -offset;
            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            ctx.lineTo(end[0], end[1]);
            ctx.stroke();
            ctx.restore();

            /* how often the convoy runs this lane, on the big ones only */
            if (major) {

                ctx.save();
                ctx.font = "bold 9px Arial, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "rgba(" + AMBER + ",0.85)";
                ctx.fillText(String(Number(route.trips) || 0),
                    (start[0] + end[0]) / 2, (start[1] + end[1]) / 2 - 7);
                ctx.restore();

            }

        }

    }

    function tick() {

        if (document.hidden) { return; }

        /* the dashes crawl along the lane, so a route reads as a direction */
        offset = (offset + 0.6) % 252;
        draw();

    }

    async function refresh() {

        if (reading) { return; }

        reading = true;

        try {

            const { data, error } = await supabaseClient.rpc("tusken_trade_routes");

            if (!error && data && Array.isArray(data.routes)) {
                routes = data.routes;
            }
            else if (error) {
                routes = [];
            }

        }
        catch (e) {
            routes = [];
        }

        reading = false;

        draw();

    }

    /* the map survives a resize or a rotation */
    window.addEventListener("resize", draw);
    window.addEventListener("load", draw);

    setInterval(tick, 110);
    setInterval(draw, 1500);

    refresh();
    setInterval(refresh, 20000);

    /* a small handle for the screens and the tests */
    window.TRADE_ROUTES = {
        set: function (list) {
            routes = Array.isArray(list) ? list : [];
            draw();
        },
        get: function () {
            return routes;
        }
    };

})();
