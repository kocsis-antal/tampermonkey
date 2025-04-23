// ==UserScript==
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @name         Gitlab extender
// @version      1.0.20250423-0945
// @updateURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @downloadURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/gitlab-extender.js
// @description  gitlab MR coloring and extra MR button
// @author       Kocsis Antal
// @match        https://gitlab.mhk.hu/*/merge_requests
// @match        https://gitlab.mhk.hu/*/merge_requests*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mhk.hu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
    const currentUser = document.querySelector('.current-user').childNodes[1].childNodes[0].textContent.trim();
    // console.log('currentUser: [' + currentUser + ']');

    document.querySelectorAll('.merge-request').forEach(el => {
        const text = el.childNodes[1].childNodes[1].childNodes[1].childNodes[1].childNodes[1].text;
        if (text.startsWith('Draft:') ) {
            // draft
            el.style.backgroundColor = '#ffeeee';
        } else {
            const controlls = el.childNodes[1].childNodes[3].childNodes[1];
            // owner
            // console.log('title-1: ' + controlls.childNodes[1].childNodes[1].title);
            // console.log('title-2: ' + controlls.childNodes[3].childNodes[1].title);
            if (controlls.childNodes[1].childNodes[1].title && controlls.childNodes[1].childNodes[1].title == 'Assigned to ' + currentUser || controlls.childNodes[3].childNodes[1].title == 'Assigned to ' + currentUser) {
                el.style.border = '5px double';
            }

            // approves
            const title = controlls.childNodes[controlls.childNodes.length-4].title;
            if (title.includes('you') ) {
                el.style.backgroundColor = '#aaffaa';
            } else if (title.includes('approver') ) {
                el.style.backgroundColor = '#eeffee';
            } else {
                el.style.backgroundColor = '#fffeee';
            }
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
