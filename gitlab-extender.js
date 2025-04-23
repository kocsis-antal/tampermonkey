// ==UserScript==
// @name         Gitlab extender
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @version      1.0.20250423-1108
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
    const currentUser = document.querySelector('.current-user').childNodes[1].childNodes[0].textContent.trim();
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
                const titleNode = mrLine.querySelector('.text-success');
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
    var newHTML = document.createElement ('li');
    newHTML.innerHTML = `
<a title="CC Team open MRs" aria-label="CC Team open MRs" href="/groups/cc-team/-/merge_requests?scope=all&state=opened">
	<svg class="s16" data-testid="git-merge-icon">
		<use href="/assets/icons-87cb0ce1047e0d3e1ddd352a88d6807e6155673ebba21022180ab5ee153c2026.svg#git-merge"/>
	</svg>
	<span aria-label="0 assigned issues" class="gl-badge badge badge-pill badge-success sm gl-ml-n2 gl-display-none">0</span>
</a>`;

    const navBar = document.getElementById("js-onboarding-new-project-link").parentElement.parentElement;
    navBar.insertBefore(newHTML, navBar.firstChild);
})();
