// ==UserScript==
// @name         Café Metropolitan – Greenpoint7 napi menü (fix 2 hasábos faliújság)
// @namespace    http://tampermonkey.net/
// @version      1.8
// @updateURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/cafemetropolitan.js
// @downloadURL  https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/cafemetropolitan.js
// @description  Greenpoint7 napi menü (#Section5), stabil fix két hasábos, görgetésmentes, faliújságos megjelenítés
// @author       Kocsis Antal
// @match        https://cafemetropolitan.hu/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const waitForEl = (selector, cb) => {
        const el = document.querySelector(selector);
        if (el) return cb(el);
        setTimeout(() => waitForEl(selector, cb), 100);
    };

    waitForEl('#etterem3 #Section5', (section) => {
        const menuText = document.querySelector('#etterem3 .nav li').textContent;
        // Alap stílus
        document.body.innerHTML = '';
        document.body.style.margin = '2rem';
        document.body.style.fontFamily = 'sans-serif';
        document.body.style.background = '#fff';
        document.body.style.color = '#111';
        document.body.style.fontSize = '34px';
        document.body.style.lineHeight = '1.6';
        document.body.style.overflow = 'hidden'; // NE legyen görgetés!
        document.body.style.height = '100vh'; // teljes képernyőre
        document.body.style.boxSizing = 'border-box';

        const style = document.createElement('style');
        style.textContent = `
      body {
        background-color: #cdcdd6 !important;
      }
      h1 {
        text-align: center;
        font-weight: bold;
        margin-top: 30px;
        margin-bottom: 50px;
      }
      .row-wrapper {
        display: flex;
        gap: 4rem;
        height: calc(100vh - 5rem);
        overflow: hidden;
      }
      .column {
        flex: 1;
        overflow: hidden;
      }
      h2 {
        margin: 1.5rem 0 0.5rem;
        font-weight: bold;
        text-align: center;
      }
      .menu-row {
        display: flex;
        justify-content: center;
        border-bottom: 1px dotted #ccc;
        padding: 4px 0;
        white-space: nowrap;
      }
      .menu-row span:first-child {
        padding-right: 1em;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
        text-wrap: auto;
      }
      .menu-row span:last-child {
        min-width: 5em;
        text-align: center;
      }
    `;
        document.head.appendChild(style);

        // Fejléc
        document.body.appendChild(document.createElement('br'));
        const title = document.createElement('h1');
        title.innerText = 'Greenpoint7 – ' + menuText;
        document.body.appendChild(title);

        // Oszlopstruktúra
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'row-wrapper';
        const leftCol = document.createElement('div');
        leftCol.className = 'column';
        const rightCol = document.createElement('div');
        rightCol.className = 'column';
        rowWrapper.appendChild(leftCol);
        rowWrapper.appendChild(rightCol);
        document.body.appendChild(rowWrapper);

        // Kategóriák és beosztás
        const categories = Array.from(section.querySelectorAll('h3'));
        const colChunks = [[], []]; // bal, jobb

        categories.forEach((cat, i) => {
            const catName = cat.innerText.trim();
            if (!catName) return;

            const items = cat.parentElement.querySelectorAll('.menu-media');

            // Szűrés: csak akkor dolgozzuk fel, ha van legalább 1 értelmes sor
            const validItems = Array.from(items).filter(media => {
                const text = media.querySelector('h2')?.innerText?.trim();
                return !!text;
            });

            if (validItems.length === 0) return; // SKIP üres kategória

            const columnIndex = i % 2; // váltakozva bal-jobb
            const group = document.createElement('div');

            const h2 = document.createElement('h2');
            h2.innerText = catName;
            group.appendChild(h2);

            items.forEach(media => {
                const raw = media.querySelector('h2')?.innerText?.trim();
                if (!raw) return;

                const match = raw.match(/^(.+?)(\d{3,4}\s?Ft)$/);
                let name = raw, price = '';
                if (match) {
                    name = match[1].trim();
                    price = match[2].trim();
                }

                const row = document.createElement('div');
                row.className = 'menu-row';

                const nameSpan = document.createElement('span');
                nameSpan.style.fontWeight = 'bold';
                nameSpan.innerText = name;
                row.appendChild(nameSpan);

                if (price) {
                    const priceSpan = document.createElement('span');
                    priceSpan.innerText = price;
                    row.appendChild(priceSpan);
                }

                group.appendChild(row);
            });

            colChunks[columnIndex].push(group);
        });

        // Hozzáad balra/jobbra
        colChunks[0].forEach(group => leftCol.appendChild(group));
        colChunks[1].forEach(group => rightCol.appendChild(group));
    });
})();
