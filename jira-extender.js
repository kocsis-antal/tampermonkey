// ==UserScript==
// @name         Jira extender
// @namespace    https://github.com/kocsis-antal/tampermonkey/
// @version      1.0.20250423-1101
// @updateURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/jira-extender.js
// @downloadURL    https://raw.githubusercontent.com/kocsis-antal/tampermonkey/refs/heads/master/jira-extender.js
// @description  gitlab MR search for jira
// @author       Kocsis Antal
// @match        https://jira.mhk.hu/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mhk.hu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
    const viewissuesidebar = document.getElementById("viewissuesidebar");
    const keyVal = document.getElementById("key-val").textContent.trim();

    var newHTML = document.createElement ('div');
    newHTML.innerHTML = `
<div id="gitlabmodule" class="module toggle-wrap ">
	<div id="gitlabmodule_heading" class="mod-header">
		<button class="aui-button toggle-title" aria-controls="gitlabmodule" aria-expanded="true" resolved="">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14">
				<g fill="none" fill-rule="evenodd">
					<path d="M3.29175 4.793c-.389.392-.389 1.027 0 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955c.388-.392.388-1.027 0-1.419-.389-.392-1.018-.392-1.406 0l-2.298 2.317-2.307-2.327c-.194-.195-.449-.293-.703-.293-.255 0-.51.098-.703.293z" fill="#344563"/>
				</g>
			</svg>
		</button>
		<h3 class="toggle-title" id="gitlabmodule-label">Gitlab</h3>
		<ul class="ops"/>
	</div>
	<div class="mod-content">
		<div class="item-details">
			<dl>
				<dt>
                    MR:
				</dt>
				<dd>
					<a target="_blanc" href="https://gitlab.mhk.hu/search?scope=merge_requests&search=` + keyVal + `">keresése</a>
				</dd>
			</dl>
		</div>
	</div>
</div>`;

    viewissuesidebar.appendChild (newHTML);
})();
