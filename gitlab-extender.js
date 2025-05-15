// ==UserScript==
// @name         Gitlab extender
// @version      1.1.20250515-1400
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @source       https://github.com/kocsis-antal/tampermonkey
// @updateURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @downloadURL  https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @description  gitlab MR coloring and extra MR button
// @author       Kocsis Antal
// @match        https://gitlab.mhk.hu/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mhk.hu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    // Your code here...

    // source: https://stackoverflow.com/questions/12897446/userscript-to-wait-for-page-to-load-before-executing-code-techniques
    (new MutationObserver(check)).observe(document, {childList: true, subtree: true});
    function check(changes, observer) {
        if(document.querySelector('.merge-request')) {
            observer.disconnect();
            // actions to perform after #mySelector is found

            addMrButton();
            colorLines();
        }
    }

    // MR button
    function addMrButton() {
        var newHTML = document.createElement ('div');
        newHTML.innerHTML = `
<a title="CC Team open MRs" aria-label="CC Team open MRs" href="/groups/cc-team/-/merge_requests?scope=all&state=opened">
	<button type="button" class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon">
		<!---->
		<svg class="s16" data-testid="git-merge-icon">
			<use href="/assets/icons-aa2c8ddf99d22b77153ca2bb092a23889c12c597fc8b8de94b0f730eb53513f6.svg#merge-request"></use>
		</svg>
		<!---->
	</button>
</a>
`;

        const navBar = document.querySelector('.user-bar > div');
        navBar.insertBefore(newHTML, document.querySelector('[data-testid="super-sidebar-collapse-button"]'));
    }

    // line coloring
    function colorLines() {
        const currentUser = document.querySelector('[data-testid="user-menu-toggle"] > span > span').textContent.replace(" user’s menu","");
        // console.log('currentUser: [' + currentUser + ']');

        document.querySelectorAll('.merge-request').forEach(mrLine => {
            try {
                const text = mrLine.querySelector('.issue-title-text').text;
                if (text.startsWith('Draft:') ) {
                    // draft
                    mrLine.style.backgroundColor = '#ffeeee';
                } else {
                    // owner
                    if (mrLine.querySelector('.author-link').text == currentUser) {
                        mrLine.style.border = '5px double';
                    }

                    // approves
                    const titleNode = mrLine.querySelector('[data-testid="mr-appovals"]');
                    if (titleNode && titleNode.title.includes('you') ) {
                        // you
                        mrLine.style.backgroundColor = '#aaffaa';
                    } else if (titleNode && titleNode.textContent.includes('Approved') ) {
                        // others
                        mrLine.style.backgroundColor = '#eeffee';
                    } else {
                        // none
                        mrLine.style.backgroundColor = '#fffeee';
                    }
                }
            } catch(err) {
                console.log(err);
            }
        });
    }

})();
