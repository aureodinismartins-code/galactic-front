/* =========================================================
   GALACTIC FRONT — the ship's wireless
   One playlist for the whole game, and one control for the crew.

   The HOST — the account in game_control.host_player, the one holding the
   reset and the maintenance keys — is the only one who chooses. The
   playlist and the needle live in the database
   (sql/2026-11-08_shared_music_playlist.sql), so a track the host puts on
   is heard on every screen: each browser follows the same track, seeks to
   the same second, and pauses when the host pauses.

   Everybody else gets one control of their own: MUTE. It belongs to that
   player, is kept in their browser, and never leaves it.

   The wireless also carries the ship's stations: the files committed under
   assets/music and listed in assets/music/stations.json. A station belongs
   to whoever picks it and plays on their screen alone. The host puts the
   shared playlist together by link, so every screen can hear that one.

   No dependencies: this file is included by every screen.
========================================================= */

(function() {

    "use strict";

    const MINE_KEY = "gf_music_mine";      /* mute and volume: this browser only */
    const OLD_KEY = "gf_music_playlist";   /* the host's list from before the database */
    const POLL_MS = 20000;

    const BTN = "background:#0e2233;color:#bfe4ff;border:1px solid #2f6280;padding:4px 8px;" +
                "font:11px Arial;cursor:pointer;";

    let tracks = [];        /* the shared playlist */
    let playback = null;    /* what the wireless is doing */
    let isHost = false;     /* what the server says about this player */
    let live = false;       /* the server has answered */
    let missing = false;    /* the SQL of the wireless has not been run */
    let muted = false;      /* this player's own mute */
    let volume = 0.6;
    let audio = null;
    let panel = null;
    let button = null;
    let appliedKey = "";    /* the playback already loaded into the audio element */
    let seekTo = null;
    let skew = 0;           /* the server's clock minus this browser's */
    let refused = {};       /* tracks that would not play */
    let migrated = false;
    let timer = null;
    let tries = 0;
    let stations = [];      /* the stations, from assets/music/stations.json */
    let stationsRead = false;
    let stationsError = false;
    let station = -1;       /* the station this player has on, if any */
    let stationTrack = 0;
    let refusedStation = {};/* broken files, per station */

    /* ---------- small helpers ---------- */

    function T(text) {
        try { return (typeof window.T === "function") ? window.T(text) : text; }
        catch (e) { return text; }
    }

    function esc(text) {
        return String(text === undefined || text === null ? "" : text)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function readMine() {
        try {
            const raw = localStorage.getItem(MINE_KEY);
            return raw ? JSON.parse(raw) : {};
        }
        catch (e) { return {}; }
    }

    function writeMine() {
        try {
            localStorage.setItem(MINE_KEY, JSON.stringify({ muted: muted, volume: volume }));
        }
        catch (e) { /* private mode: it just does not survive the page */ }
    }

    function client() {
        try {
            if (typeof supabaseClient !== "undefined" && supabaseClient &&
                typeof supabaseClient.rpc === "function") {
                return supabaseClient;
            }
        }
        catch (e) { /* this page has no client before the script loads */ }

        const other = window.supabaseClient;
        return (other && typeof other.rpc === "function") ? other : null;
    }

    function call(name, args) {
        const c = client();
        if (!c) { return Promise.resolve({ data: null, error: null }); }
        try {
            return Promise.resolve(c.rpc(name, args)).then(
                function(res) { return res || { data: null, error: null }; },
                function(err) { return { data: null, error: err }; });
        }
        catch (e) { return Promise.resolve({ data: null, error: e }); }
    }

    function reason(err) {
        return String((err && err.message) ? err.message : (err || ""));
    }

    function note(text) {
        const status = panel && panel.querySelector(".gf-music-status");
        if (status) { status.textContent = text; }
    }

    function titleFrom(url) {
        try {
            const clean = String(url).split(/[?#]/)[0];
            const last = clean.split("/").filter(Boolean).pop() || clean;
            return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, "")
                .replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
        }
        catch (e) { return String(url); }
    }

    /*
       The host brings a song in by its link: the list lives in the database,
       so the address is what every other screen fetches. A file committed
       under assets/music can be pasted as well; it is made absolute here,
       because a relative address would only mean something on this page.
    */
    function addTrack() {

        const input = panel && panel.querySelector('[data-gf="link"]');
        const raw = input ? String(input.value || "").trim() : "";

        if (!raw) { return; }

        let url = raw;

        try { url = new URL(raw, document.baseURI).href; }
        catch (e) { /* keep what was typed; the server says no */ }

        act("music_add", { p_url: url, p_title: titleFrom(url) }).then(function() {
            if (input) { input.value = ""; }
            paint();
        });

    }

    /* ---------- the player ---------- */

    function ensureAudio() {

        if (audio) { return audio; }

        audio = new Audio();
        audio.preload = "auto";
        audio.volume = volume;
        audio.muted = muted;

        audio.addEventListener("ended", function() { ended(); });
        audio.addEventListener("error", function() { unplayable(); });

        audio.addEventListener("loadedmetadata", function() {
            if (seekTo === null) { return; }
            const want = seekTo;
            seekTo = null;
            try {
                const length = audio.duration;
                audio.currentTime = (isFinite(length) && length > 0) ? (want % length) : want;
            }
            catch (e) { /* the browser starts it at the top instead */ }
        });

        return audio;

    }

    /* how far into the track the whole game should be by now */
    function elapsed() {

        if (!playback || !playback.started_at) { return null; }

        const started = new Date(playback.started_at).getTime();
        if (!isFinite(started)) { return null; }

        return Math.max(0, (Date.now() + skew - started) / 1000);

    }

    function follow() {

        /* this player is on a station of their own: the shared wireless waits */
        if (station >= 0) { return; }

        const a = ensureAudio();
        a.muted = muted;
        a.volume = volume;

        if (!playback || !playback.url) {
            a.pause();
            appliedKey = "";
            paint();
            return;
        }

        const key = [playback.id, playback.started_at, playback.paused ? "p" : "r"].join("|");

        if (appliedKey !== key) {

            appliedKey = key;

            if (playback.paused) {
                a.pause();
                paint();
                return;
            }

            a.src = playback.url;
            seekTo = elapsed();
        }

        if (playback.paused) {
            a.pause();
        }
        else if (a.paused) {
            const started = a.play();
            if (started && typeof started.catch === "function") {
                started.catch(function() { /* the next click anywhere starts it */ });
            }
        }

        paint();

    }

    function ended() {

        /* a station plays on: the next track, and round again at the end */
        if (station >= 0) {
            stepStation(1);
            return;
        }

        if (!playback || !playback.id) { return; }

        /* the track is over for everybody: whichever screen hears the end
           last moves the needle on, so the wireless does not stop just
           because the host has closed their tab */
        act("music_advance", { p_from: playback.id });

    }

    function unplayable() {

        note(T("That track could not be played."));

        if (station >= 0) { stationSkip(); return; }
        if (!playback || !playback.id) { return; }
        if (refused[playback.id]) { return; }

        refused[playback.id] = true;
        act("music_advance", { p_from: playback.id });

    }

    /* ---------- the server ---------- */

    function apply(state) {

        if (!state) { return; }

        live = true;
        missing = false;
        isHost = state.is_host === true;

        tracks = Array.isArray(state.tracks) ? state.tracks : [];
        playback = state.playback || null;

        if (state.now) { skew = new Date(state.now).getTime() - Date.now(); }

        carryOver();
        follow();

    }

    function refresh() {
        return call("music_state").then(function(res) {
            if (res.error) {
                if (/schema cache|does not exist/i.test(reason(res.error))) { missing = true; }
                paint();
                return;
            }
            apply(res.data);
        });
    }

    function act(name, args) {
        return call(name, args).then(function(res) {
            if (res.error) { note(reason(res.error)); paint(); return null; }
            apply(res.data);
            return res.data;
        });
    }

    /*
       The host's list from the days when the wireless was a browser thing:
       the first time the shared one answers empty, those links are carried
       over, so nobody loses their songs.
    */
    function carryOver() {

        if (migrated || !isHost || tracks.length) { return; }
        migrated = true;

        let old = [];
        try {
            const raw = localStorage.getItem(OLD_KEY);
            const list = raw ? JSON.parse(raw) : [];
            old = Array.isArray(list) ? list.filter(t => t && t.url && !t.local) : [];
        }
        catch (e) { return; }

        if (!old.length) { return; }

        let chain = Promise.resolve(null);
        old.forEach(function(t) {
            chain = chain.then(function() {
                return call("music_add", { p_url: t.url, p_title: t.title || null });
            });
        });

        chain.then(function() {
            try { localStorage.removeItem(OLD_KEY); } catch (e) { /* nothing to do */ }
            refresh();
        });

    }

    /* ---------- the host's controls ---------- */

    function toggleWireless() {

        /* a station is this player's own: it stops and starts on this screen */
        if (station >= 0) {
            const a = ensureAudio();
            if (!a.paused) { a.pause(); }
            else {
                const started = a.play();
                if (started && typeof started.catch === "function") { started.catch(function() {}); }
            }
            paint();
            return;
        }

        if (!isHost) { return; }

        if (playback && playback.paused === false) { act("music_paused", { p_paused: true }); return; }
        if (playback && playback.url) { act("music_paused", { p_paused: false }); return; }
        if (tracks.length) { act("music_play", { p_id: tracks[0].id }); }

    }

    function stepTo(dir) {

        if (station >= 0) { stepStation(dir); return; }

        if (!isHost || !tracks.length) { return; }

        let i = -1;

        tracks.forEach(function(t, n) {
            if (playback && String(t.id) === String(playback.id)) { i = n; }
        });

        i = (i < 0) ? (dir > 0 ? 0 : tracks.length - 1) : ((i + dir + tracks.length) % tracks.length);

        act("music_play", { p_id: tracks[i].id });

    }

    /* ---------- the stations ---------
       Each player chooses their own station; the shared wireless is still the
       host's. The files live in the repository, one folder per station under
       assets/music, and stations.json lists them.
    */

    function stationUrl(st, i) {

        const name = st.tracks[i];
        if (!name) { return ""; }
        if (/^[a-z]+:\/\//i.test(name)) { return name; }

        const file = String(name).replace(/^\/+/, "").replace(/#/g, "%23").replace(/\?/g, "%3F");

        const where = "assets/music/" + String(st.folder || st.id).replace(/\/+$/, "") + "/" + file;

        try { return new URL(where, document.baseURI).href; }
        catch (e) { return where; }

    }

    /* the manifest, read kindly: a file written by hand often leaves the
       names in the tracks list without their quotes, and that one missing
       quote used to take every station off the air */
    function stationsByHand(text) {

        const out = [];
        const blocks = String(text || "").match(/\{[^{}]*\}/g) || [];

        blocks.forEach(function(block) {

            const field = function(key) {
                const m = block.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"'));
                return m ? m[1] : "";
            };

            const id = field("id") || field("folder");
            if (!id) { return; }

            const list = block.match(/"tracks"\s*:\s*\[([\s\S]*?)\]/);
            const tracks = [];

            if (list) {
                list[1].split(",").forEach(function(piece) {
                    const name = piece.trim().replace(/^["']/, "").replace(/["']$/, "").trim();
                    if (name) { tracks.push(name); }
                });
            }

            out.push({
                id: id,
                label: field("label") || id,
                folder: field("folder") || id,
                tracks: tracks
            });

        });

        return out;

    }

    function stationsFrom(text) {

        try {
            const data = JSON.parse(text);
            const list = Array.isArray(data) ? data
                : (data && Array.isArray(data.stations) ? data.stations : []);
            if (list.length) { return list; }
        }
        catch (e) { /* a hand-written file: read it below */ }

        return stationsByHand(text);

    }

    function loadStations() {

        if (stationsRead) { return; }
        stationsRead = true;

        if (typeof fetch !== "function") { stationsError = true; return; }

        let answer;

        try { answer = fetch("assets/music/stations.json", { cache: "no-cache" }); }
        catch (e) { stationsError = true; return; }

        Promise.resolve(answer).then(function(res) {

            if (!res || !res.ok) { return ""; }

            if (typeof res.text === "function") { return res.text(); }

            return Promise.resolve(res.json()).then(function(data) { return JSON.stringify(data || {}); });

        }).then(function(text) {

            const list = stationsFrom(text);

            stations = list.filter(function(s) {
                return !!(s && (s.id || s.folder));
            }).map(function(s) {
                return {
                    id: String(s.id || s.folder),
                    label: String(s.label || s.id || s.folder),
                    folder: String(s.folder || s.id),
                    tracks: Array.isArray(s.tracks)
                        ? s.tracks.filter(function(t) { return !!t; }).map(String) : []
                };
            });

            stationsError = !stations.length;

        }).catch(function() {
            stations = [];
            stationsError = true;
        }).then(function() {
            if (stations.length) { paint(); }
        });

    }

    function stationNow() {
        return (station >= 0 && stations[station]) ? stations[station] : null;
    }

    function playStationTrack() {

        const st = stationNow();
        if (!st) { return; }

        const a = ensureAudio();

        a.muted = muted;
        a.volume = volume;
        a.src = stationUrl(st, stationTrack);
        seekTo = null;

        const started = a.play();
        if (started && typeof started.catch === "function") {
            started.catch(function() { /* the next click anywhere starts it */ });
        }

    }

    function playStation(index, which) {

        const st = stations[index];
        if (!st) { return; }

        station = index;
        appliedKey = "";

        if (!st.tracks.length) {
            stationTrack = 0;
            if (audio) { audio.pause(); }
            note(T("This station has nothing on the air yet: put the files in assets/music and list them in stations.json."));
            paint();
            return;
        }

        const want = Number(which) || 0;
        stationTrack = ((want % st.tracks.length) + st.tracks.length) % st.tracks.length;

        playStationTrack();
        paint();

    }

    function stepStation(dir) {

        const st = stationNow();
        if (!st || !st.tracks.length) { return; }

        stationTrack = (stationTrack + dir + st.tracks.length) % st.tracks.length;

        playStationTrack();
        paint();

    }

    function stationSkip() {

        const st = stationNow();
        if (!st) { return; }

        refusedStation[station] = (refusedStation[station] || 0) + 1;

        /* a station of nothing but broken files falls silent rather than
           skipping over the same broken files for ever */
        if (refusedStation[station] >= st.tracks.length) {
            station = -1;
            if (audio) { audio.pause(); }
            note(T("This station could not be played."));
            paint();
            return;
        }

        stepStation(1);

    }

    function stationTitle(st) {
        return titleFrom(st.tracks[stationTrack] || "");
    }

    /* ---------- the panel ---------- */

    function known() {
        if (live) { return true; }
        const status = window.gameStatus;
        return !!(status && typeof status.is_host === "boolean");
    }

    function hostByStatus() {
        const status = window.gameStatus;
        return !!(status && status.is_host === true);
    }

    /*
       The wireless is on the page for the host always, and for anybody the
       moment there is something to hear (or to mute).
    */
    function needed() {
        if (!known()) { return false; }
        if (isHost || hostByStatus()) { return true; }
        if (stations.length) { return true; }
        return tracks.length > 0 || !!(playback && playback.url);
    }

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
            "position:fixed;right:18px;bottom:68px;z-index:1201;width:330px;max-height:64vh;overflow:auto;" +
            "display:none;background:rgba(8,14,22,.97);border:1px solid #3f7f9f;padding:14px;" +
            "font:12px Arial;color:#cfe6f5;box-shadow:0 10px 30px rgba(0,0,0,.6);";
        document.body.appendChild(panel);

        button.addEventListener("click", function() {
            const opening = panel.style.display === "none";
            panel.style.display = opening ? "block" : "none";
            if (opening) { refresh(); paint(); }
        });

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && panel.style.display !== "none") { panel.style.display = "none"; }
        });

    }

    function paint() {

        if (needed()) { build(); }
        if (!panel || !button) { return; }

        const playing = !!(audio && !audio.paused);
        const current = playback && playback.url ? playback.title : "";

        button.style.color = muted ? "#6f8ba0" : (playing ? "#7dffb0" : "#9fdcff");
        button.style.borderColor = muted ? "#3f5f7f" : (playing ? "#37c98a" : "#3f7f9f");

        let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
            '<b style="letter-spacing:2px;color:#9fdcff">' + esc(T("SHIP'S WIRELESS")) + '</b>' +
            '<button type="button" data-gf="close" style="background:none;border:none;color:#7b93a6;' +
            'cursor:pointer;font-size:16px">&times;</button></div>';

        if (stations.length) {

            h += '<div style="color:#7fa8c0;letter-spacing:2px;margin-bottom:6px">' + esc(T("STATIONS")) + '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">' +
                stations.map(function(s, i) {
                    const on = i === station;
                    return '<button type="button" data-gf="station" data-i="' + i + '" style="' + BTN +
                        (on ? ';color:#7dffb0;border-color:#37c98a' : '') + '">' + esc(T(s.label)) + '</button>';
                }).join("") + '</div>';

        }
        else if (stationsError) {

            h += '<div style="color:#8a6a3a;margin-bottom:10px;line-height:1.5">' +
                esc(T("The stations are silent: put the music in assets/music and list it in stations.json.")) +
                '</div>';

        }

        h += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
            (isHost || station >= 0
                ? '<button type="button" data-gf="prev" style="' + BTN + '">&#9198;</button>' +
                  '<button type="button" data-gf="toggle" style="' + BTN + ';min-width:64px">' +
                      ((station >= 0 ? (audio && !audio.paused) : playback && playback.paused === false)
                          ? "&#10074;&#10074;" : "&#9654;") + '</button>' +
                  '<button type="button" data-gf="next" style="' + BTN + '">&#9197;</button>'
                : "") +
            '<button type="button" data-gf="mute" style="' + BTN + ';color:' +
                (muted ? "#ffb0b0" : "#bfe4ff") + '">' + esc(muted ? T("UNMUTE") : T("MUTE")) + '</button>' +
            '<input type="range" min="0" max="100" value="' + Math.round(volume * 100) + '" data-gf="volume" ' +
            'style="flex:1;min-width:80px">' +
            '</div>';

        const stNow = stationNow();

        let line;
        if (stNow) {
            line = (playing ? T("Playing:") : T("Paused.")) + " " + T(stNow.label) +
                (stNow.tracks.length ? " — " + stationTitle(stNow)
                                     : " — " + T("nothing on this station yet"));
        }
        else if (missing) { line = T("The wireless lives in the database: run sql/2026-11-08_shared_music_playlist.sql, then reload."); }
        else if (current) { line = (playing ? T("Playing:") : T("Paused.")) + " " + current; }
        else { line = T("The wireless is silent: nobody has put a track on yet."); }

        h += '<div class="gf-music-status" style="color:#7fa8c0;min-height:16px;margin-bottom:8px">' +
            esc(line) + '</div>';

        if (isHost && !missing) {

            h += '<div style="display:flex;gap:6px;margin-bottom:8px">' +
                '<input type="text" data-gf="link" placeholder="' + esc(T("Paste a link to a track")) + '" ' +
                'style="flex:1;min-width:0;padding:5px;background:#0b1622;border:1px solid #2b4b61;color:#dff1ff">' +
                '<button type="button" data-gf="add" style="' + BTN + '">' + esc(T("ADD")) + '</button>' +
                '</div>';

            h += tracks.map(function(t) {
                const on = playback && String(playback.id) === String(t.id);
                return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid #183044">' +
                    '<button type="button" data-gf="play" data-id="' + esc(t.id) + '" style="' + BTN + ';min-width:26px">' +
                        (on ? "&#9654;" : "&#8226;") + '</button>' +
                    '<span style="flex:1;color:' + (on ? "#fff" : "#a9c4d6") + ';overflow:hidden;' +
                        'text-overflow:ellipsis;white-space:nowrap">' + esc(t.title) + '</span>' +
                    '<button type="button" data-gf="remove" data-id="' + esc(t.id) + '" style="' + BTN + '">&times;</button>' +
                    '</div>';
            }).join("");

        }
        else if (!isHost) {

            h += '<div style="color:#6f8ba0;margin-top:8px;line-height:1.5">' +
                esc(T(stations.length
                    ? "Pick a station above: it plays on your screen alone. The host chooses the shared wireless."
                    : "The host chooses the music. You can mute it for yourself.")) + '</div>';

        }

        panel.innerHTML = h;

        wire();

    }

    function wire() {

        panel.querySelectorAll("[data-gf]").forEach(function(el) {

            const kind = el.dataset.gf;

            if (kind === "link") {
                el.addEventListener("keydown", function(e) {
                    if (e.key === "Enter") { e.preventDefault(); addTrack(); }
                });
                return;
            }

            if (kind === "volume") {
                el.addEventListener("input", function() {
                    volume = Math.max(0, Math.min(1, Number(el.value) / 100));
                    if (audio) { audio.volume = volume; }
                    writeMine();
                });
                return;
            }

            el.addEventListener("click", function() {

                if (kind === "close") { panel.style.display = "none"; return; }

                /* this one control is everybody's */
                if (kind === "mute") {
                    muted = !muted;
                    if (audio) { audio.muted = muted; }
                    writeMine();
                    paint();
                    return;
                }

                if (kind === "add") { addTrack(); return; }
                if (kind === "station") { playStation(Number(el.dataset.i)); return; }

                if (kind === "prev") { stepTo(-1); return; }
                if (kind === "next") { stepTo(1); return; }
                if (kind === "toggle") { toggleWireless(); return; }

                if (kind === "play") { act("music_play", { p_id: el.dataset.id }); return; }
                if (kind === "remove") { act("music_remove", { p_id: el.dataset.id }); return; }

            });

        });

    }

    /* ---------- boot ---------- */

    function start() {

        if (timer) { return; }

        document.addEventListener("pointerdown", unlock);
        document.addEventListener("keydown", unlock);

        loadStations();
        refresh();
        timer = setInterval(refresh, POLL_MS);

    }

    function unlock() {
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
        follow();
    }

    function boot() {

        const mine = readMine();

        if (typeof mine.volume === "number") {
            volume = Math.max(0, Math.min(1, mine.volume));
        }

        muted = mine.muted === true;

        if (known()) { start(); return; }

        /*
           Who the host is only becomes known when gamecontrol.js has heard
           its first heartbeat, which it writes to window.gameStatus. The
           wireless waits for that answer before it talks to the server.
        */
        const waiter = setInterval(function() {
            tries++;
            if (known()) { clearInterval(waiter); start(); }
            else if (tries > 120) { clearInterval(waiter); }
        }, 500);

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

    /* the other screens may ask for the wireless; they get no new powers */
    window.GFMusic = {
        host: function() { return isHost || hostByStatus(); },
        refresh: refresh,
        open: function() {
            if (needed()) {
                build();
                panel.style.display = "block";
                refresh();
                paint();
            }
        },
        tracks: function() { return tracks.slice(); },
        playing: function() { return playback; },
        stations: function() { return stations.slice(); },
        station: function() { return stationNow(); }
    };

})();
