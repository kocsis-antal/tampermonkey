// ==UserScript==
// @name         Café Metropolitan – GreenPoint7 napi étlap (v2)
// @namespace    http://tampermonkey.net/
// @version      2.6.0
// @description  GreenPoint7 kivetítő: konkrét HTML alapú étlap, A/B menük és két hasáb, görgetés nélkül.
// @author       Kocsis Antal
// @match        https://www.metropolitanetterem.hu/etlap*
// @match        https://metropolitanetterem.hu/etlap*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const CONFIG = {
        closingHour: 15,                  // Éttermi ebédnyitvatartás vége (Europe/Budapest)
        refreshMinutes: 2,                // Újraolvassa az oldal már betöltött menüjét
        fullReloadMinutes: 30,            // Új menü közzététele esetén is frissüljön
        title: 'GreenPoint7',
        minFontPx: 14,
        maxFontPx: 34,
    };

    const SCREEN_ID = 'gp7-menu-screen';
    const VISIBLE_CLASS = 'gp7-menu-visible';
    const DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június',
        'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    const DAY_RE = /(hétfő|kedd|szerda|csütörtök|péntek|szombat|vasárnap)/i;
    const PRICE_RE = /^(.*?)(\d{1,3}(?:[ .]\d{3})+|\d{3,5})\s*(?:,-)?\s*(Ft|HUF)\b/i;
    const CATEGORIES = /^(?:(?:[A-Z]|[1-9])\s*[.)-]?\s*menü|menük|napi ajánlat(?:ok)?|leves(?:ek)?|főzelék(?:ek)?|feltét(?:ek)?|tészta(?:féle|félék|ételek|k)?|vegetáriánus(?: ételek)?|vegán(?: ételek)?|fitt?nes+s?|főétel(?:ek)?|frissensült(?:ek)?|köret(?:ek)?|salát(?:a|ák)|desszert(?:ek)?|egyéb(?: ételek)?|séf ajánlata|chefünk ajánlata|séfünk ajánlata|laktóz[- ]*és[- ]*gluténmentes)$/i;
    const MENU_TITLE_RE = /^[„“"'«]?\s*([AB])\s*[”"'»]?\s*[.)-]?\s*menü\s*[:–-]?$/i;
    const MENU_LETTER_RE = /^[„“"'«]?\s*([AB])\s*[”"'»]?$/i;
    const ALLERGEN_RE = /^(?:glutén|tojás|szója|tej(?:,?\s*laktóz)?|laktóz|diófélék|földimogyoró|mogyoró|zeller|szezámmag|mustár|hal|rákfélék|puhatestűek|csillagfürt|szulfit(?:ok)?|kén-dioxid)$/i;
    const TAG_RE = /^(?:laktózmentes|gluténmentes|tejmentes|újdonság|csípős)$/i;
    const NO_MENU_RE = /(?:nincs|még nem|nem elérhető|nem található).{0,50}(?:étlap|menü|kínálat)|(?:étlap|menü|kínálat).{0,50}(?:nincs|nem érhető el)/i;
    // Az allergén és tájékoztató szakasz NEM étel. Fontos: ezek bármelyik
    // kategória között is előfordulhatnak, ezért soha nem állunk le véglegesen!
    const END_OF_FOOD_RE = /^\s*[.\-–—•]?\s*(?:allergén(?:ek|lista|tájékoztatás)?\b|az ételek allergén|ételeinket elvitelre|ételeink kis adagban|az étlap változtatásának|hiányzik a kedvenced|kívánd meg,? mit főzzünk|szavazz a többiek|nyomj szívet a kedvenc|heti étlap e-mailben|impresszum|adatkezelés)/i;

    // A böngésző időzónájától függetlenül budapesti dátummal számolunk.
    const clock = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const dateLabel = new Intl.DateTimeFormat('hu-HU', {
        timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long',
    });

    function localParts() {
        const p = Object.fromEntries(clock.formatToParts(new Date()).map(x => [x.type, x.value]));
        return { year: +p.year, month: +p.month, day: +p.day,
            hour: +p.hour, minute: +p.minute };
    }

    function selectedDate() {
        const p = localParts();
        const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
        if (date.getUTCDay() === 0 || date.getUTCDay() === 6 || p.hour >= CONFIG.closingHour) {
            date.setUTCDate(date.getUTCDate() + 1);
        }
        while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
            date.setUTCDate(date.getUTCDate() + 1);
        }
        const iso = date.toISOString().slice(0, 10);
        const today = new Date(Date.UTC(p.year, p.month - 1, p.day));
        const weekMonday = d => {
            const x = new Date(d);
            x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
            return x.toISOString().slice(0, 10);
        };
        return {
            iso, date, weekday: DAYS[date.getUTCDay()],
            label: dateLabel.format(date),
            nextWeek: weekMonday(today) !== weekMonday(date),
        };
    }

    function clean(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const weekdayIndex = { hétfő: 0, kedd: 1, szerda: 2, csütörtök: 3, péntek: 4 };

    // A tényleges metropolitanetterem.hu /etlap DOM-ja alapján:
    // #days > button[data-i="0".."4"] -- a nap neve mellett lehet "ma" vagy "holnap".
    // #combo > article              -- A és B menü.
    // #cats > .cat > .dish         -- további ételkategóriák és árak.
    function dayTabs() {
        return [...document.querySelectorAll('#days button[data-i]')];
    }

    function foodFingerprint() {
        const combo = document.querySelector('#combo');
        const cats = document.querySelector('#cats');
        // A szívecskék és allergénjelölések változása nem számít étlapváltozásnak.
        return [combo?.innerHTML || '', cats?.innerHTML || ''].join('\n');
    }

    function activeDayIndex() {
        const active = document.querySelector('#days button[data-i][aria-pressed="true"]');
        return active ? Number(active.dataset.i) : null;
    }

    async function activateDay(target) {
        const index = weekdayIndex[target.weekday];
        const tabs = dayTabs();
        const tab = tabs.find(el => Number(el.dataset.i) === index);
        if (!tab) {
            console.warn('[GreenPoint7 v2.6] A napválasztó hiányzik:', target.weekday,
                tabs.map(el => ({id: el.dataset.i, text: clean(el.textContent)})));
            return false;
        }

        // A tényleges adatot ellenőrizzük, nem a gomb CSS-állapotát.
        if (activeDayIndex() === index && hasFoodData()) return true;

        const before = foodFingerprint();
        tab.click();
        // Egyes oldalak késleltetve frissítik a tartalmat.
        for (let i = 0; i < 40; i++) {
            await pause(200);
            if (activeDayIndex() === index && hasFoodData() &&
                foodFingerprint() !== before) {
                // Megvárjuk, hogy az adatokat kirajzoló ciklus véget érjen.
                await pause(200);
                return activeDayIndex() === index && hasFoodData();
            }
        }
        console.warn('[GreenPoint7 v2.6] A nap kiválasztása vagy étlapfrissítése nem sikerült.', {
            target: target.weekday, index, activeIndex: activeDayIndex(),
            combo: !!document.querySelector('#combo article'),
            categories: document.querySelectorAll('#cats .cat').length,
        });
        return false;
    }

    function hasFoodData() {
        return !!document.querySelector('#combo article li, #cats .cat .dish');
    }

    function publishedWeek() {
        // Példa: "november 16. – november 20.". Az oldal tényleges #week elemét olvassuk.
        const t = clean(document.querySelector('#week')?.textContent).toLowerCase();
        const p = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})\\.?\\s*[–—-]\\s*(?:(${MONTHS.join('|')})\\s+)?(\\d{1,2})\\.?`, 'i');
        const m = t.match(p);
        if (!m) return null;
        const now = localParts();
        const a = MONTHS.indexOf(m[1].toLowerCase());
        const b = m[3] ? MONTHS.indexOf(m[3].toLowerCase()) : a;
        const y = now.year - (now.month === 1 && a === 11 ? 1 : 0);
        return {start: Date.UTC(y,a,+m[2]),end: Date.UTC(y+(b<a?1:0),b,+m[4])};
    }

    // Az allergén-számok önálló <sup> elemek, eltávolítjuk őket a megjelenítő szövegből.
    function foodName(element) {
        if (!element) return '';
        const copy = element.cloneNode(true);
        copy.querySelectorAll('sup.alg, .alg, .today, svg').forEach(el => el.remove());
        return clean(copy.textContent);
    }

    function parseMenu() {
        const groups = [];
        // A/B menü: egy article = egy menü, <li> = egy étel.
        for (const article of document.querySelectorAll('#combo > article')) {
            const title = clean(article.querySelector('h3')?.textContent);
            const letter = title.match(/[„“"']?\s*([AB])\s*[”"']?\s*menü/i);
            if (!letter) continue;
            const items = [...article.querySelectorAll('li')]
                .map(li => ({name: foodName(li), price: ''}))
                .filter(item => item.name);
            if (!items.length) continue;
            groups.push({
                title: `${letter[1].toUpperCase()} menü`, kind: 'menu',
                price: clean(article.querySelector('.row .price, .price')?.textContent),
                items,
            });
        }
        // A további ételek: .cat h4 a kategórianév, .dish közvetlen span-jei az étel és az ár.
        for (const cat of document.querySelectorAll('#cats > .cat')) {
            const title = clean(cat.querySelector('h4')?.textContent);
            if (!title) continue;
            const items = [...cat.querySelectorAll(':scope > .dish')].map(dish => {
                const nameElement = dish.querySelector(':scope > span:not(.price):not(.dots)');
                const priceElement = dish.querySelector(':scope > .price');
                return { name: foodName(nameElement), price: clean(priceElement?.textContent) };
            }).filter(item => item.name);
            if (items.length) groups.push({title, kind: 'category', price: '', items});
        }
        return groups;
    }

    function ensureScreen() {
        let screen = document.getElementById(SCREEN_ID);
        if (screen) return screen;
        const style = document.createElement('style');
        style.textContent = `
            /* Az eredeti oldal DOM-ja megmarad; a faliújságot a fedőréteg adja. */
            html.${VISIBLE_CLASS}, html.${VISIBLE_CLASS} body {
                width:100%; height:100%; overflow:hidden!important;
                overscroll-behavior:none;
            }
            html.${VISIBLE_CLASS}::-webkit-scrollbar,
            html.${VISIBLE_CLASS} body::-webkit-scrollbar { width:0!important; height:0!important; }
            #${SCREEN_ID}, #${SCREEN_ID} * { box-sizing:border-box; }
            #${SCREEN_ID} {
                position:fixed; inset:0; z-index:2147483647;
                display:flex; flex-direction:column; gap:0;
                width:100vw; height:100vh; height:100dvh;
                padding:1.2vh 2vw 1.1vh; overflow:hidden;
                background:#eef2f3; color:#20313a;
                font-family:Arial,Helvetica,sans-serif;
                font-size:var(--gp7-font,30px); line-height:1.22;
                font-weight:400;
            }
            #${SCREEN_ID}[hidden] { display:none!important; }
            #${SCREEN_ID} .gp7-header {
                flex:none; display:flex; align-items:center; justify-content:space-between;
                gap:.7em; padding:.35em .75em; margin-bottom:.43em;
                background:#204752; color:#fff; border-radius:.37em;
                box-shadow:0 .09em .30em rgba(12,43,50,.14);
            }
            #${SCREEN_ID} .gp7-heading {
                min-width:0; margin:0; padding:0; font-size:1.18em;
                font-weight:800; line-height:1.1; letter-spacing:.008em;
            }
            #${SCREEN_ID} .gp7-date {
                flex:none; margin:0; padding:.28em .70em;
                border:1px solid rgba(255,255,255,.24);
                border-radius:999px; background:rgba(255,255,255,.10);
                font-size:.68em; font-weight:700; white-space:nowrap;
            }
            #${SCREEN_ID} .gp7-menu-pair {
                display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
                gap:.62em; flex:none; margin-bottom:.12em;
            }
            #${SCREEN_ID} .gp7-menu-pair:empty { display:none; }
            #${SCREEN_ID} .gp7-menu-card {
                min-width:0; padding:.36em .62em .40em;
                background:#fff; border:1px solid #d5e2e4;
                border-left:.16em solid #27818a; border-radius:.37em;
                box-shadow:0 .06em .20em rgba(21,47,54,.055);
            }
            #${SCREEN_ID} .gp7-menu-card.gp7-menu-b { border-left-color:#c48636; }
            #${SCREEN_ID} .gp7-menu-card:only-child { grid-column:1/-1; }
            #${SCREEN_ID} .gp7-menu-title {
                display:flex; align-items:center; justify-content:space-between;
                gap:.5em; margin:0 0 .24em; padding:0 0 .23em;
                border-bottom:1px solid #e5ecee;
                font-size:1em; font-weight:800; color:#174650;
            }
            #${SCREEN_ID} .gp7-menu-b .gp7-menu-title { color:#845219; }
            #${SCREEN_ID} .gp7-menu-name { text-align:left; }
            #${SCREEN_ID} .gp7-menu-price {
                padding:.16em .48em; color:#173b43;
                border-radius:.24em; background:#edf4f3;
                font-size:.87em; font-weight:800; white-space:nowrap;
            }
            #${SCREEN_ID} .gp7-menu-b .gp7-menu-price { background:#faf1e3; color:#774d1d; }
            #${SCREEN_ID} .gp7-menu-item {
                padding:.075em 0; text-align:left;
                font-size:.86em; font-weight:600; line-height:1.19;
            }
            #${SCREEN_ID} .gp7-columns {
                flex:1; min-height:0;
                display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
                column-gap:.62em; margin-top:.22em;
            }
            #${SCREEN_ID} .gp7-column {
                min-width:0; min-height:0; overflow:hidden;
            }
            #${SCREEN_ID} .gp7-group {
                min-width:0; margin:0 0 .36em; padding:.33em .58em .32em;
                background:#fff; border:1px solid #dce4e7;
                border-radius:.33em; box-shadow:0 .035em .12em rgba(20,47,55,.045);
                break-inside:avoid;
            }
            #${SCREEN_ID} .gp7-category {
                display:flex; align-items:center; gap:.48em;
                margin:0 0 .16em; padding:0 0 .22em;
                font-size:.91em; font-weight:800; line-height:1.18;
                color:#28606c; text-align:left;
                border-bottom:1px solid #e5ecee;
            }
            #${SCREEN_ID} .gp7-category::after {
                content:''; flex:1; height:2px; background:#d9e8e9;
                border-radius:9px;
            }
            #${SCREEN_ID} .gp7-row {
                display:flex; justify-content:space-between;
                align-items:baseline; gap:.55em;
                padding:.075em 0; font-size:.85em; line-height:1.23;
            }
            #${SCREEN_ID} .gp7-row + .gp7-row { border-top:1px solid #eef1f2; }
            #${SCREEN_ID} .gp7-name { min-width:0; overflow-wrap:break-word; font-weight:550; }
            #${SCREEN_ID} .gp7-price {
                flex:none; white-space:nowrap; text-align:right;
                font-weight:800; color:#285d64;
            }
            #${SCREEN_ID} .gp7-message {
                display:flex; align-items:center; justify-content:center;
                grid-column:1/-1; height:60%; padding:2em;
                text-align:center; font-size:1.16em; color:#34515b;
            }
            #${SCREEN_ID} .gp7-info {
                position:absolute; right:.5vw; bottom:.12vh;
                font-size:10px; color:#67777b; opacity:.58;
            }
            /* Ha nagy az étlap, a JS kisebb betűméret mellett is tömörít. */
            #${SCREEN_ID}.gp7-compact .gp7-group { margin-bottom:.21em; padding:.19em .40em .19em; }
            #${SCREEN_ID}.gp7-compact .gp7-row { padding:.034em 0; }
            #${SCREEN_ID}.gp7-compact .gp7-menu-card { padding:.23em .48em .25em; }
            #${SCREEN_ID}.gp7-compact .gp7-header { padding:.22em .5em; margin-bottom:.24em; }
            @media (max-width:850px) {
                #${SCREEN_ID} { padding:1vh 1.5vw; }
                #${SCREEN_ID} .gp7-header { padding:.2em .4em; }
            }
        `;
        document.head.appendChild(style);
        screen = document.createElement('div');
        screen.id = SCREEN_ID;
        screen.innerHTML = '<header class="gp7-header"><h1 class="gp7-heading"></h1><span class="gp7-date"></span></header><div class="gp7-menu-pair"></div><div class="gp7-columns"></div><div class="gp7-info">F8: eredeti weboldal</div>';
        document.body.appendChild(screen);
        document.documentElement.classList.add(VISIBLE_CLASS);
        return screen;
    }

    function fit(screen) {
        if (screen.hidden) return;
        const cols = [...screen.querySelectorAll('.gp7-column')];
        const columns = screen.querySelector('.gp7-columns');
        if (!columns) return;
        screen.classList.remove('gp7-compact');
        // A főcím, a két menükártya és az alsó két oszlop EGYÜTT férjen ki.
        // Ha a teljes mérettartomány sem elég, a belső térközöket is csökkentjük.
        for (const compact of [false, true]) {
            screen.classList.toggle('gp7-compact', compact);
            for (let font = CONFIG.maxFontPx; font >= CONFIG.minFontPx; font--) {
                screen.style.setProperty('--gp7-font', `${font}px`);
                if (cols.every(c => c.scrollHeight <= c.clientHeight + 2 &&
                    c.scrollWidth <= c.clientWidth + 2) &&
                    columns.clientHeight > 40) return;
            }
        }
        console.warn('[GreenPoint7 v2.6] A teljes étlap a minimális betűmérettel sem fér el.');
    }

    function addFoodRow(parent, item, className) {
        const row = document.createElement('div');
        row.className = className;
        const name = document.createElement('span');
        name.className = 'gp7-name';
        name.textContent = item.name;
        row.append(name);
        if (item.price) {
            const price = document.createElement('span');
            price.className = 'gp7-price';
            price.textContent = item.price;
            row.append(price);
        }
        parent.append(row);
    }

    function show(target, groups, message = '') {
        const screen = ensureScreen();
        const title = screen.querySelector('.gp7-heading');
        const date = screen.querySelector('.gp7-date');
        const menuPair = screen.querySelector('.gp7-menu-pair');
        const columns = screen.querySelector('.gp7-columns');
        title.textContent = CONFIG.title;
        date.textContent = target.label;
        menuPair.textContent = '';
        columns.textContent = '';

        if (message || !groups.length) {
            const el = document.createElement('div');
            el.className = 'gp7-message';
            el.textContent = message || 'Erre a napra még nincs közzétett étlap.';
            columns.append(el);
            return;
        }

        const menus = groups.filter(g => g.kind === 'menu').sort((a, b) =>
            a.title.localeCompare(b.title, 'hu'));
        for (const group of menus) {
            const card = document.createElement('section');
            card.className = `gp7-menu-card ${/^B\b/i.test(group.title) ? 'gp7-menu-b' : 'gp7-menu-a'}`;
            const heading = document.createElement('div');
            heading.className = 'gp7-menu-title';
            const name = document.createElement('span');
            name.className = 'gp7-menu-name';
            name.textContent = group.title;
            heading.append(name);
            if (group.price) {
                const price = document.createElement('span');
                price.className = 'gp7-menu-price';
                price.textContent = group.price;
                heading.append(price);
            }
            card.append(heading);
            for (const item of group.items) {
                const row = document.createElement('div');
                row.className = 'gp7-menu-item';
                row.textContent = item.name;
                card.append(row);
            }
            menuPair.append(card);
        }

        const els = [0, 1].map(() => {
            const el = document.createElement('div');
            el.className = 'gp7-column';
            columns.append(el);
            return el;
        });
        const weights = [0, 0];
        for (const group of groups.filter(g => g.kind !== 'menu')) {
            const index = weights[0] <= weights[1] ? 0 : 1;
            const wrapper = document.createElement('section');
            wrapper.className = 'gp7-group';
            const heading = document.createElement('h2');
            heading.className = 'gp7-category';
            heading.textContent = group.title;
            wrapper.append(heading);
            for (const item of group.items) addFoodRow(wrapper, item, 'gp7-row');
            els[index].append(wrapper);
            // A hosszabb címek több sort foglalnak: becsült magassággal osztunk.
            weights[index] += group.items.length + 1.9 +
                group.items.reduce((n, item) => n + Math.max(0, Math.ceil(item.name.length / 40) - 1) * .65, 0);
        }
        requestAnimationFrame(() => fit(screen));
    }

    let busy = false;
    let lastTarget = '';
    async function refresh() {
        if (busy || !document.body) return;
        busy = true;
        try {
            const target = selectedDate();
            if (lastTarget && lastTarget !== target.iso) {
                location.reload();
                return;
            }
            lastTarget = target.iso;

            if (!document.querySelector('#days') || !document.querySelector('#week')) {
                show(target, [], 'Az étterem étlapja még nem töltődött be. F8: eredeti weboldal.');
                return;
            }
            const week = publishedWeek();
            const dayMs = Date.parse(`${target.iso}T00:00:00Z`);
            if (!week || dayMs < week.start || dayMs > week.end) {
                show(target, [], 'Erre a napra még nincs közzétett étlap. F8: eredeti weboldal.');
                return;
            }
            if (!await activateDay(target)) {
                show(target, [], 'Nem sikerült kiválasztani a megfelelő napot. F8: eredeti weboldal.');
                return;
            }
            // Kiválasztás után csak a hozzá tartozó konkrét étel DOM-részeket olvassuk.
            const groups = parseMenu();
            show(target, groups, groups.length ? '' : 'Erre a napra még nincs közzétett étlap. F8: eredeti weboldal.');
        } catch (error) {
            console.error('[GreenPoint7 v2.6] Menüfeldolgozási hiba:', error);
            show(selectedDate(), [], 'Az étlap feldolgozása sikertelen. F8: eredeti weboldal.');
        } finally {
            busy = false;
        }
    }

    // Hiba esetén F8-cal bármikor előhozható a teljes eredeti oldal.
    document.addEventListener('keydown', event => {
        if (event.key !== 'F8') return;
        event.preventDefault();
        const screen = ensureScreen();
        screen.hidden = !screen.hidden;
        document.documentElement.classList.toggle(VISIBLE_CLASS, !screen.hidden);
        if (!screen.hidden) requestAnimationFrame(() => fit(screen));
    });

    ensureScreen();
    window.addEventListener('resize', () => fit(ensureScreen()));
    void refresh();
    // Aszinkron betöltéskor nem kell a következő időzített ellenőrzésre várni.
    let debounce = null;
    const observer = new MutationObserver(mutations => {
        if (!mutations.some(m => {
            const el = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
            return el && !el.closest?.(`#${SCREEN_ID}`);
        })) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => void refresh(), 700);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    // Ha a webapp későn indul, a napváltás akkor is újrapróbálható legyen.
    setInterval(() => {
        if (document.querySelector(`#${SCREEN_ID} .gp7-message`)) void refresh();
    }, 10_000);
    setInterval(() => void refresh(), CONFIG.refreshMinutes * 60_000);
    setInterval(() => location.reload(), CONFIG.fullReloadMinutes * 60_000);
})();
