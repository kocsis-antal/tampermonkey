// ==UserScript==
// @name         Gitlab extender
// @version      1.2.20260907-1340
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @source       https://github.com/kocsis-antal/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @downloadURL  https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @description  GitLab MR dashboard enhancements
// @author       Kocsis Antal
// @match        https://gitlab.mhk.hu/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mhk.hu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        groupPath: 'cc-team',
        jiraBaseUrl: 'https://jira.mhk.hu/browse/',
        ageBadgeFromDays: 7,
        oldAgeBadgeFromDays: 30,
    };

    const ID = {
        style: 'tm-gitlab-extender-style',
        mrButton: 'tm-cc-mrs-button',
        approvalInfo: 'tm-approval-info',
        mineTab: 'tm-mine-tab',
        renovateTab: 'tm-renovate-tab',
    };

    const CLASS = {
        ownMr: 'tm-own-mr',
        jiraLink: 'tm-jira-link',
        ageBadge: 'tm-age-badge',
    };

    const SELECTOR = {
        newMenu: '[data-testid="new-menu-toggle"]',

        mrList: '.issuable-list-container',
        mrRow:
        '.issuable-list-container ' +
        '[data-testid="issuable-container"].merge-request',

        mrTitle: '[data-testid="issuable-title-link"]',
        mrAuthor: '[data-testid="issuable-author"]',
        mrCreatedAt: '[data-testid="issuable-created-at"]',
        mrAuthored: '.issuable-authored',
        mrApproval: '[data-testid="mr-approvals"]',

        stateTabs: '.issuable-state-filters .gl-tabs-nav',

        mergeButton: '[data-testid="merge-button"]',
        approvalsSummary: '[data-testid="approvals-summary-content"]',
    };

    const URLS = {
        defaultMrs:
        `/groups/${CONFIG.groupPath}/-/merge_requests` +
        '?scope=all&state=opened&draft=no&not[label_name][]=renovate',

        mine: () =>
        `/groups/${CONFIG.groupPath}/-/merge_requests` +
        `?scope=all&state=opened&author_username=${encodeURIComponent(currentUsername())}`,

        renovate:
        `/groups/${CONFIG.groupPath}/-/merge_requests` +
        '?scope=all&state=opened&label_name[]=renovate',
    };

    const MONTHS = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
    };

    const TIMEZONE_OFFSET_HOURS = {
        UTC: 0,
        GMT: 0,
        CET: 1,
        CEST: 2,
    };

    let updateScheduled = false;

    addStyles();

    new MutationObserver(scheduleUpdate)
        .observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    scheduleUpdate();

    function scheduleUpdate() {
        if (updateScheduled) {
            return;
        }

        updateScheduled = true;

        requestAnimationFrame(() => {
            updateScheduled = false;

            enhanceTopBar();
            enhanceMrList();
            enhanceMergeView();
        });
    }

    // -------------------------------------------------------------------------
    // Top bar
    // -------------------------------------------------------------------------

    function enhanceTopBar() {
        addMrShortcut();
    }

    function addMrShortcut() {
        if (document.getElementById(ID.mrButton)) {
            return;
        }

        const newMenu = document.querySelector(SELECTOR.newMenu);
        if (!newMenu) {
            return;
        }

        const button = document.createElement('a');

        button.id = ID.mrButton;
        button.href = URLS.defaultMrs;
        button.title = 'CC Team open MRs';
        button.setAttribute('aria-label', 'CC Team open MRs');

        button.className =
            'gl-self-center btn gl-button btn-default ' +
            'btn-sm btn-default-secondary';

        const spriteIcons = window.gon?.sprite_icons;

        button.innerHTML = spriteIcons
            ? `
                <span class="gl-button-text gl-flex gl-items-center gl-gap-2">
                    <svg
                        role="img"
                        aria-hidden="true"
                        class="gl-icon s16 gl-fill-current">
                        <use href="${spriteIcons}#merge-request"></use>
                    </svg>
                    <span>CC MRs</span>
                </span>
            `
            : '<span class="gl-button-text">CC MRs</span>';

        newMenu.insertAdjacentElement('beforebegin', button);
    }

    // -------------------------------------------------------------------------
    // MR list
    // -------------------------------------------------------------------------

    function enhanceMrList() {
        if (!document.querySelector(SELECTOR.mrList)) {
            return;
        }

        addCustomTabs();

        document.querySelectorAll(SELECTOR.mrRow)
            .forEach(decorateMr);
    }

    function decorateMr(mr) {
        const titleLink = mr.querySelector(SELECTOR.mrTitle);
        if (!titleLink) {
            return;
        }

        const title = titleLink.textContent.trim();

        colorMr(mr, title);
        markOwnMr(mr);
        addAgeBadge(mr);
        addJiraLink(titleLink, title);
    }

    function colorMr(mr, title) {
        if (isDraft(title)) {
            setBackground(mr, '#ffeeee');
            return;
        }

        const approved = mr.querySelector(SELECTOR.mrApproval)
        ?.textContent
        ?.includes('Approved');

        setBackground(
            mr,
            approved ? '#eeffee' : '#fffeee',
        );
    }

    function markOwnMr(mr) {
        const authorUsername = mr.querySelector(SELECTOR.mrAuthor)
        ?.dataset
        ?.username;

        mr.classList.toggle(
            CLASS.ownMr,
            Boolean(authorUsername)
            && authorUsername === currentUsername(),
        );
    }

    // -------------------------------------------------------------------------
    // MR age
    // -------------------------------------------------------------------------

    function addAgeBadge(mr) {
        const createdAt = mr.querySelector(SELECTOR.mrCreatedAt);
        if (!createdAt) {
            return;
        }

        const createdDate =
              parseGitlabDate(createdAt.getAttribute('title'));

        if (!createdDate) {
            return;
        }

        const ageDays = Math.floor(
            (Date.now() - createdDate.getTime()) / 86_400_000,
        );

        const existingBadge =
              mr.querySelector(`.${CLASS.ageBadge}`);

        if (ageDays < CONFIG.ageBadgeFromDays) {
            existingBadge?.remove();
            return;
        }

        const badge =
              existingBadge ?? document.createElement('span');

        const variant =
              ageDays >= CONFIG.oldAgeBadgeFromDays
        ? 'badge-warning'
        : 'badge-neutral';

        badge.className =
            `${CLASS.ageBadge} ` +
            `gl-badge badge badge-pill ${variant}`;

        badge.title = `Created ${ageDays} days ago`;

        badge.innerHTML = `
            <span class="gl-badge-content">
                ${ageDays}d
            </span>
        `;

        if (!existingBadge) {
            const authored =
                  mr.querySelector(SELECTOR.mrAuthored);

            (authored ?? createdAt)
                .insertAdjacentElement('afterend', badge);
        }
    }

    // -------------------------------------------------------------------------
    // Jira
    // -------------------------------------------------------------------------

    function addJiraLink(titleLink, title) {
        const titleContainer = titleLink.parentElement;

        if (
            !titleContainer
            || titleContainer.querySelector(`.${CLASS.jiraLink}`)
        ) {
            return;
        }

        const jiraKey = extractJiraKey(title);
        if (!jiraKey) {
            return;
        }

        const link = document.createElement('a');

        link.className =
            `${CLASS.jiraLink} gl-ml-2 gl-inline-flex gl-no-underline`;

        link.href =
            `${CONFIG.jiraBaseUrl}${encodeURIComponent(jiraKey)}`;

        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = `Open ${jiraKey} in Jira`;

        link.innerHTML = `
            <span class="gl-badge badge badge-pill badge-neutral">
                <span class="gl-badge-content">
                    Jira ↗
                </span>
            </span>
        `;

        titleLink.insertAdjacentElement('afterend', link);
    }

    function extractJiraKey(title) {
        /*
         * RELEASE-1.2.3 esetén a regexp egyébként
         * RELEASE-1-et Jira azonosítónak nézné.
         */
        if (/^RELEASE-\d+(?:\.\d+)+\b/i.test(title)) {
            return null;
        }

        return title.match(
            /\b[A-Z][A-Z0-9]+-\d+\b/,
        )?.[0] ?? null;
    }

    // -------------------------------------------------------------------------
    // Custom tabs
    // -------------------------------------------------------------------------

    function addCustomTabs() {
        const tabs = document.querySelector(SELECTOR.stateTabs);
        if (!tabs) {
            return;
        }

        const params =
              new URLSearchParams(window.location.search);

        const renovateActive =
              params
        .getAll('label_name[]')
        .includes('renovate');

        const mineActive =
              !renovateActive
        && params.get('author_username') === currentUsername();

        /*
         * Ha a saját füleink valamelyikén vagyunk,
         * a GitLab az Open fület ettől még aktívnak jelölné.
         */
        if (mineActive || renovateActive) {
            clearActiveTabs(tabs);
        }

        addTab(
            tabs,
            ID.mineTab,
            'Mine',
            URLS.mine(),
            mineActive,
        );

        addTab(
            tabs,
            ID.renovateTab,
            'Renovate',
            URLS.renovate,
            renovateActive,
        );
    }

    function addTab(tabs, id, label, href, active) {
        if (tabs.querySelector(`#${id}`)) {
            return;
        }

        const item = document.createElement('li');

        item.id = id;
        item.setAttribute('role', 'presentation');
        item.className = 'nav-item';

        const link = document.createElement('a');

        link.href = href;
        link.setAttribute('role', 'tab');
        link.setAttribute('aria-selected', String(active));
        link.className = 'nav-link gl-tab-nav-item';
        link.textContent = label;

        if (active) {
            link.classList.add(
                'active',
                'gl-tab-nav-item-active',
            );

            link.setAttribute('aria-current', 'page');
        } else {
            link.tabIndex = -1;
        }

        item.appendChild(link);
        tabs.appendChild(item);
    }

    function clearActiveTabs(tabs) {
        tabs.querySelectorAll('.gl-tab-nav-item')
            .forEach(tab => {
            tab.classList.remove(
                'active',
                'gl-tab-nav-item-active',
            );

            tab.setAttribute(
                'aria-selected',
                'false',
            );

            tab.removeAttribute('aria-current');
            tab.tabIndex = -1;
        });
    }

    // -------------------------------------------------------------------------
    // MR detail view
    // -------------------------------------------------------------------------

    function enhanceMergeView() {
        const mergeButton =
              document.querySelector(SELECTOR.mergeButton);

        if (!mergeButton) {
            return;
        }

        const approved = isMergeRequestApproved();

        let info =
            document.getElementById(ID.approvalInfo);

        if (!info) {
            info = document.createElement('span');
            info.id = ID.approvalInfo;
        }

        if (approved) {
            info.textContent =
                'A változtatás el lett fogadva.';

            info.classList.remove(
                'tm-approval-missing',
            );

            info.classList.add(
                'tm-approval-ok',
            );
        } else {
            info.textContent =
                'Még nem került elfogadásra!';

            info.classList.remove(
                'tm-approval-ok',
            );

            info.classList.add(
                'tm-approval-missing',
            );
        }

        /*
         * A Merge gomb split-button:
         *
         * [ Merge / Set to auto-merge ][ ▼ ]
         *
         * Ezért a teljes btn-group UTÁN szúrjuk be
         * a figyelmeztetést.
         */
        const mergeButtonGroup =
              mergeButton.closest('.btn-group')
        ?? mergeButton;

        if (info.previousElementSibling !== mergeButtonGroup) {
            mergeButtonGroup.insertAdjacentElement(
                'afterend',
                info,
            );
        }
    }

    function isMergeRequestApproved() {
        const approvalText =
              document.querySelector(SELECTOR.approvalsSummary)
        ?.textContent
        ?.replace(/\s+/g, ' ')
        ?.trim()
        ?? '';

        return /\bApproved\b/i.test(approvalText);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function currentUsername() {
        return window.gon?.current_username ?? '';
    }

    function isDraft(title) {
        return /^(Draft:|\[Draft\])/i.test(title);
    }

    function setBackground(element, color) {
        element.style.setProperty(
            'background-color',
            color,
            'important',
        );
    }

    /*
     * Példa:
     *
     * 3 September 2026 at 11:02:20 CEST
     *
     * Nem bízzuk a böngésző Date.parse implementációjára,
     * mert ez nem szabványos ISO dátum.
     */
    function parseGitlabDate(value) {
        if (!value) {
            return null;
        }

        const match = value.match(
            /^(\d{1,2}) ([A-Za-z]+) (\d{4}) at (\d{2}):(\d{2}):(\d{2}) ([A-Z]+)$/,
        );

        if (match) {
            const [
                ,
                day,
                monthName,
                year,
                hour,
                minute,
                second,
                timezone,
            ] = match;

            const month =
                  MONTHS[monthName.toLowerCase()];

            const timezoneOffset =
                  TIMEZONE_OFFSET_HOURS[timezone];

            if (
                month !== undefined
                && timezoneOffset !== undefined
            ) {
                return new Date(
                    Date.UTC(
                        Number(year),
                        month,
                        Number(day),
                        Number(hour) - timezoneOffset,
                        Number(minute),
                        Number(second),
                    ),
                );
            }
        }

        /*
         * Biztonsági fallback arra az esetre,
         * ha a GitLab később más formátumot ad.
         */
        const fallback =
              Date.parse(value.replace(' at ', ' '));

        return Number.isNaN(fallback)
            ? null
        : new Date(fallback);
    }

    // -------------------------------------------------------------------------
    // Style
    // -------------------------------------------------------------------------

    function addStyles() {
        if (document.getElementById(ID.style)) {
            return;
        }

        const style = document.createElement('style');

        style.id = ID.style;

        style.textContent = `
            /*
             * Saját topbar shortcut:
             * picit karakteresebb, mint a gyári ikongombok.
             */
            #${ID.mrButton} {
                font-weight: 600;
            }

            /*
             * Saját MR.
             *
             * A régi 5px double border helyett nem változtatjuk
             * meg a sor méretét, csak belül kap egy jelölést.
             */
            .${CLASS.ownMr} {
                box-shadow:
                    inset 7px 0 0 #7759c2 !important;
            }

            .${CLASS.jiraLink} {
                text-decoration: none !important;
                vertical-align: 2px;
            }

            .${CLASS.ageBadge} {
                flex-shrink: 0;
            }

            #${ID.approvalInfo} {
                align-self: center;
                margin-left: 12px;
                font-weight: 600;
            }

            #${ID.approvalInfo}.tm-approval-ok {
                color: green;
            }

            #${ID.approvalInfo}.tm-approval-missing {
                color: red;
            }
        `;

        document.head.appendChild(style);
    }
})();
