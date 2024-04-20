const style = 
`<style>
	.connection-element {
		display: block;
		margin-bottom: 50px
	}

	.highlighted-connection-span {
	    background: #5f5328;
	    padding: 10px;
	    border-radius: 5px;
	    color: var(--color-bg);
	}
</style>
`


class ConnectionElement extends HTMLElement {
	constructor() {
		super()

		const rule_title = this.getAttribute("rule-title")
		const rule_description = this.getAttribute("rule-description") || ""
		const connected_rules = JSON.parse(this.getAttribute("connected-rules"))

		let listHTML = ""
		for (let rule of connected_rules) {
			const descriptionHTML = 
				rule.description ? 
				`<ul class="list-no-decoration">
		        	<li>${rule.description}</li>
		      	</ul>`
				: ''
			listHTML += 
			`<li>
				${rule.title} <md-block class="author-credit" data-author-id="${rule.author_id}">${rule.author_name}</md-block>
				${descriptionHTML}
			</li>
			`
		}

	    const element = document.createElement('div')
	    element.classList.add("connection-element")
	    element.innerHTML = 
	    `${style}
	    <p class="highlighted-connection-span">
		  ${rule_title} - ${rule_description}
		</p>
		<p>
			is most similar to:
		</p>
		<ul>
		  ${listHTML}
		</ul>
	    `
		this.appendChild(element)
	}

	connectedCallback() {
		this.convertAuthorMarkdownToLink()
	}

	convertAuthorMarkdownToLink() {
		setTimeout(() => {
			// Wait for markdown to be rendered, then edit it to get first name & link to their page
			const authorCredits = this.querySelectorAll(".author-credit")
			if (authorCredits.length != 0) {
				for (let credit of authorCredits) {
					const authorId = credit.dataset.authorId
					const renderedMarkdown = credit.innerText
					const firstName = renderedMarkdown.split(" ")[0]
					credit.outerHTML = 
					`<md-span class="author-credit">— [${firstName}](/rules/${authorId})</md-span>`
				}
				
			}
		}, 100)
	}


}

window.customElements.define('connection-element', ConnectionElement);

