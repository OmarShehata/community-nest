const style = 
`<style>
@import "/components/AddNewRuleButton.css";
</style>
`
/*
To use this element:

1. Import it

<script type="module" src="/components/AddNewRuleButton.js"></script>

2. Use it

<new-rule-button></new-rule-button>
*/

const elementName = 'new-rule-button'
class NewRuleButton extends HTMLElement {
	constructor() {
		super()

		const shadow = this.attachShadow({mode: 'open'});
	    const element = document.createElement('button')
	    element.id = "new-button"
	    element.innerHTML = 
	    `${style}
	    ➕ Add rule`
		shadow.appendChild(element)

		this.shadow = shadow
		this.logElement = this.querySelector("#your-data-log")
	}

	connectedCallback() {
		const newButton = this.shadow.querySelector("#new-button")
		newButton.onclick = async (e) => {
			this.addNewRule()
		}
	}

	async addNewRule() {
		this.logElement = "Creating new rule..."
		const newRule = await this.submitRuleToDB()

		const container = document.querySelector("#your-rules")
		const ruleElement = document.createElement('div')
		ruleElement.innerHTML = 
		`<rule-element 
			editable 
			init-editing
			rule-id="${newRule.id}" 
			title="${newRule.title}" 
			description="${newRule.description}"></rule-element>`

		if (container.firstChild) {
			container.insertBefore(ruleElement, container.firstChild)
		} else {
			 container.appendChild(ruleElement)
		}
	
	}

	async submitRuleToDB() {
		const { logElement } = this
		try {
			const response = await fetch("/newRule", {
			  method: "POST",
			  body: JSON.stringify({ 
			  	token: localStorage.getItem('token'),
			  	userId: window.userId
			  }),
			  headers: {
			    "Content-type": "application/json; charset=UTF-8"
			  }
			})

			if (response.status != 200) {
				logElement.innerText = `Failed to create new rule: status code ${response.status}`
				return
			}

			const newRule = await response.json()
			return newRule
		} catch (e) {
			logElement.innerText = `Failed to create new rule: ${e}`
		}
	}
}

window.customElements.define(elementName, NewRuleButton);
