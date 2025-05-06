// ==UserScript==
// @name         Gitlab extender
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @version      1.1.20250506-1215
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
    const currentUser = document.querySelector('[data-testid="user-menu-toggle"] > span > span').textContent.replace(" user’s menu","");
    // console.log('currentUser: [' + currentUser + ']');

    document.querySelectorAll('.merge-request').forEach(mrLine => {
        try {
            const text = mrLine.querySelector('.merge-request-title-text').childNodes[1].text;
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
                } else if (titleNode && titleNode.title.includes('approver') ) {
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

    // MR button
    var newHTML = document.createElement ('div');
    newHTML.innerHTML = `
<a title="CC Team open MRs" aria-label="CC Team open MRs" href="/groups/cc-team/-/merge_requests?scope=all&state=opened">
	<button type="button" class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon">
		<!---->
		<svg class="s16" data-testid="git-merge-icon">
			<use href="/assets/icons-0b41337f52be73f7bbf9d59b841eb98a6e790dfa1a844644f120a80ce3cc18ba.svg#merge-request-open"></use>
		</svg>
		<!---->
	</button>
</a>
`;

    const navBar = document.querySelector('.user-bar > div');
    navBar.insertBefore(newHTML, document.querySelector('[data-testid="super-sidebar-collapse-button"]'));
})();
