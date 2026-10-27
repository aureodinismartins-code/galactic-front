/* =========================================================
   GALACTIC FRONT — the ship's wireless
   A playlist that plays under the game on every screen.

   Add a track by pasting a direct link to an audio file
   (mp3, ogg, wav, m4a — anything the browser can play),
   or pick a file from this computer for the session.
   The list and the volume are kept in this browser, so the
   music is still there when the page changes.

   No dependencies: this file is included by every screen.
========================================================= */

(function() {

    "use strict";

    const LIST_KEY = "gf_music_playlist";
    const STATE_KEY = "gf_music_state";

    let tracks = [];        /* [{ title, url, local }] */
    let index = 0;
    let volume = 0.6;
    let wanted = false;     /* did the player leave the wireless on? */
    let audio = null;
    let panel = null;
    let button = null;
    let unlocked = false;

    function T(text) {
        try {
            return (typeof window.T === "function") ? window.T(text) : text;
        }
        catch (e) { return text; }
    }

    function esc(text) {
        return String(text === undefined || text === null ? "" : text)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function readList() {
        try {
            const raw = localStorage.getItem(LIST_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list.filter(t => t && t.url) : [];
        }
        catch (e) { return []; }
    }

    function writeList() {
        try {
            localStorage.setItem(LIST_KEY, JSON.stringify(tracks.filter(t => !t.local)));
        }
        catch (e) { /* private mode: the list simply does not survive the page */ }
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            return raw ? JSON.parse(raw) : {};
        }
        catch (e) { return {}; }
    }

    function writeState() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify({ on: wanted, index: index, volume: volume }));
        }
        catch (e) { /* as above */ }
    }

    function titleOf(url) {
        try {
            const clean = String(url).split(/[?#]/)[0];
            const last = clean.split("/").filter(Boolean).pop() || clean;
            return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, "");
        }
        catch (e) { return String(url); }
    }

    /* ---------- the player ---------- */

    function ensureAudio() {

        if (audio) { return audio; }

        audio = new Audio();
        audio.preload = "auto";
        audio.volume = volume;

        audio.addEventListener("ended", function() { next(1); });

        audio.addEventListener("error", function() {
            if (!tracks.length) { return; }
            paint();
            const status = panel && panel.querySelector(".gf-music-status");
            if (status) { status.textContent = T("That track could not be played."); }
        });

        return audio;

    }

    function play() {

        if (!tracks.length) { return; }

        const a = ensureAudio();

        if (!a.src || a.dataset.trackId !== String(index)) {
            a.src = tracks[index].url;
            a.dataset.trackId = String(index);
        }

        wanted = true;
        writeState();

        const p = a.play();

        if (p && typeof p.catch === "function") {
            p.then(function() { unlocked = true; paint(); })
             .catch(function() {
                 /* the browser wants a gesture first: the next click starts it */
                 paint();
             });
        }

    }

    function pause() {
        wanted = false;
        writeState();
        if (audio) { audio.pause(); }
        paint();
    }

    function toggle() {
        if (audio && !audio.paused && wanted) { pause(); }
        else { play(); }
    }

    function next(step) {

        if (!tracks.length) { return; }

        index = (index + (step || 1) + tracks.length) % tracks.length;

        if (audio) {
            audio.dataset.trackId = "";
        }

        writeState();

        if (wanted) { play(); }
        else { paint(); }

    }

    function startAt(i) {
        index = i;
        wanted = true;
        if (audio) { audio.dataset.trackId = ""; }
        play();
    }

    /* ---------- the panel ---------- */

    function build() {

        if (button) { return; }

        button = document.createElement("button");
        button.type = "button";
        button.id = "gf-music-button";
        button.textContent = "♪";
        button.title = T("Music");
        button.style.cssText =
            "position:fixed;right:18px;bottom:18px;z-index:1200;width:40px;height:40px;border-radius:50%;" +
            "background:rgba(10,18,28,.92);color:#9fdcff;border:1px solid #3f7f9f;font-size:19px;line-height:1;" +
            "cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5);";
        document.body.appendChild(button);

        panel = document.createElement("div");
        panel.id = "gf-music-panel";
        panel.style.cssText =
            "position:fixed;right:18px;bottom:68px;z-index:1201;width:320px;max-height:60vh;overflow:auto;" +
            "display:none;background:rgba(8,14,22,.97);border:1px solid #3f7f9f;padding:14px;" +
            "font:12px Arial;color:#cfe6f5;box-shadow:0 10px 30px rgba(0,0,0,.6);";
        document.body.appendChild(panel);

        button.addEventListener("click", function() {
            const on = panel.style.display === "none";
            panel.style.display = on ? "block" : "none";
            if (on) { paint(); }
        });

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && panel.style.display !== "none") { panel.style.display = "none"; }
        });

        /* the first gesture anywhere is what lets the browser play sound */
        function unlock() {
            if (unlocked) { return; }
            unlocked = true;
            if (wanted) { play(); }
            document.removeEventListener("pointerdown", unlock);
            document.removeEventListener("keydown", unlock);
        }

        document.addEventListener("pointerdown", unlock);
        document.addEventListener("keydown", unlock);

    }

    function paint() {

        if (!panel) { return; }

        const playing = wanted && audio && !audio.paused && audio.dataset.trackId === String(index);
        button.style.color = playing ? "#7dffb0" : "#9fdcff";
        button.style.borderColor = playing ? "#37c98a" : "#3f7f9f";

        let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
            '<b style="letter-spacing:2px;color:#9fdcff">' + esc(T("SHIP'S WIRELESS")) + '</b>' +
            '<button type="button" data-gf="close" style="background:none;border:none;color:#7b93a6;cursor:pointer;font-size:16px">×</button></div>';

        h += '<div style="display:flex;gap:6px;margin-bottom:10px">' +
            '<button type="button" data-gf="prev" style="' + btnStyle + '">⏮</button>' +
            '<button type="button" data-gf="toggle" style="' + btnStyle + ';min-width:64px">' + (playing ? "❚❚" : "▶") + '</button>' +
            '<button type="button" data-gf="next" style="' + btnStyle + '">⏭</button>' +
            '<input type="range" min="0" max="100" value="' + Math.round(volume * 100) + '" data-gf="volume" style="flex:1">' +
            '</div>';

        h += '<div class="gf-music-status" style="color:#7fa8c0;min-height:16px;margin-bottom:8px">' +
            (tracks.length
                ? (playing ? esc(T("Playing:")) + " " + esc(tracks[index].title) : esc(T("Paused.")))
                : esc(T("No music yet: add a track below."))) + '</div>';

        h += tracks.map(function(t, i) {
            const on = i === index;
            return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid #183044">' +
                '<button type="button" data-gf="start" data-i="' + i + '" style="' + btnStyle + ';min-width:26px">' + (on ? "▶" : "•") + '</button>' +
                '<span style="flex:1;color:' + (on ? "#fff" : "#a9c4d6") + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                esc(t.title) + (t.local ? ' <span style="color:#6f8ba0">' + esc(T("(this session)")) + '</span>' : "") + '</span>' +
                '<button type="button" data-gf="remove" data-i="' + i + '" style="' + btnStyle + '">×</button>' +
                '</div>';
        }).join("") || "";

        h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #183044">' +
            '<input type="text" data-gf="url" placeholder="' + esc(T("paste a link to an audio file")) + '" ' +
            'style="width:100%;box-sizing:border-box;padding:6px;background:#0b1622;border:1px solid #2b4b61;color:#dff1ff;margin-bottom:6px">' +
            '<div style="display:flex;gap:6px">' +
            '<button type="button" data-gf="add" style="' + btnStyle + ';flex:1">' + esc(T("ADD BY LINK")) + '</button>' +
            '<label style="' + btnStyle + ';flex:1;text-align:center">' + esc(T("PICK A FILE")) +
            '<input type="file" accept="audio/*" data-gf="file" style="display:none"></label>' +
            '</div>' +
            '<div style="color:#6f8ba0;margin-top:8px;line-height:1.5">' +
            esc(T("A link is remembered in this browser. A file from this computer plays until the page is closed.")) +
            '</div></div>';

        panel.innerHTML = h;

        panel.querySelectorAll("[data-gf]").forEach(function(el) {

            const kind = el.dataset.gf;

            if (kind === "volume") {
                el.addEventListener("input", function() {
                    volume = Math.max(0, Math.min(1, Number(el.value) / 100));
                    if (audio) { audio.volume = volume; }
                    writeState();
                });
                return;
            }

            if (kind === "url" || kind === "file") { return; }

            if (kind === "add") {
                el.addEventListener("click", function() {
                    const input = panel.querySelector('[data-gf="url"]');
                    const url = input ? input.value.trim() : "";
                    addTrack(url, titleOf(url), false);
                });
                return;
            }

            el.addEventListener("click", function() {

                if (kind === "close") { panel.style.display = "none"; return; }
                if (kind === "toggle") { toggle(); return; }
                if (kind === "next") { next(1); return; }
                if (kind === "prev") { next(-1); return; }

                const i = Number(el.dataset.i);

                if (kind === "start") { startAt(i); return; }

                if (kind === "remove") {
                    tracks.splice(i, 1);
                    if (index >= tracks.length) { index = 0; }
                    writeList();
                    if (!tracks.length) { pause(); }
                    else if (wanted) { play(); }
                    paint();
                }

            });

        });

        const file = panel.querySelector('[data-gf="file"]');
        if (file) {
            file.addEventListener("change", function() {
                const f = file.files && file.files[0];
                if (!f) { return; }
                const url = URL.createObjectURL(f);
                addTrack(url, f.name.replace(/\.[a-z0-9]{2,5}$/i, ""), true);
            });
        }

    }

    const btnStyle =
        "background:#0e2233;color:#bfe4ff;border:1px solid #2f6280;padding:4px 8px;" +
        "font:11px Arial;cursor:pointer;";

    function addTrack(url, title, local) {

        if (!url) {
            const status = panel.querySelector(".gf-music-status");
            if (status) { status.textContent = T("Paste a link to an audio file first."); }
            return;
        }

        tracks.push({ url: url, title: title || titleOf(url), local: !!local });

        if (!local) { writeList(); }

        if (!wanted) { index = tracks.length - 1; }

        paint();

        if (!wanted) { startAt(tracks.length - 1); }

    }

    function boot() {

        tracks = readList();

        const state = readState();

        if (typeof state.volume === "number") {
            volume = Math.max(0, Math.min(1, state.volume));
        }

        if (typeof state.index === "number" && state.index >= 0 && state.index < tracks.length) {
            index = state.index;
        }

        wanted = state.on === true;

        build();
        paint();

        if (wanted && tracks.length) { play(); }

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

    /* the other screens can ask for the wireless too */
    window.GFMusic = {
        add: function(url, title) { addTrack(url, title || titleOf(url), false); },
        play: play,
        pause: pause,
        open: function() { if (panel) { panel.style.display = "block"; paint(); } }
    };

})();
