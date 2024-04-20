import { connectToDB, getSchema } from '../src/db.js'
import { makeRandomToken } from '../src/randomToken.js'
import fs from 'fs';
import xlsx from "xlsx";
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function insert_data() {
	const { sequelize, models } = await connectToDB()

	const kkRules = JSON.parse(fs.readFileSync(resolve(__dirname, 'kevin_kelly_68.json'), 'utf8'));
	const workbook = xlsx.readFile(resolve(__dirname, 'seed_data.ods'))
	const userData = xlsx.utils.sheet_to_json(workbook.Sheets.Users);
	const rulesData = xlsx.utils.sheet_to_json(workbook.Sheets.Rules);

	const spreadsheetUserIdMap = {}

	for (let item of userData) {
		const { id, name } = item
		const existingUsers = await models.User.findAll({ where: { name } });
		if (existingUsers.length != 0) {
			spreadsheetUserIdMap[id] = existingUsers[0].id
			// console.log(`----> User already exists: ${name}`)
			continue;
		}

		console.log("Creating user", name)
		const token = await makeRandomToken()
		const newUser = await models.User.create({ name, token });
		spreadsheetUserIdMap[id] = newUser.id
	}
  
  console.log({ spreadsheetUserIdMap })

	const rulesPerUser = {}
	for (let rule of rulesData) {
		if (rule.user_id == undefined) {
			continue
		}

		const dbId = spreadsheetUserIdMap[rule.user_id]
		if (rulesPerUser[dbId] == undefined) {
			rulesPerUser[dbId] = []
		}
		
		rulesPerUser[dbId].push(rule)
	}

	// Insert all of kk rules as 'title'
	const kkSpreadsheetId = 3
	const kkDbId = spreadsheetUserIdMap[kkSpreadsheetId]
	rulesPerUser[kkDbId] = kkRules.map(text => { return {title: text} })

	for (let userId in rulesPerUser) {
		const rules = rulesPerUser[userId].reverse()
		const count = await models.Rule.count({ where: { author_id: userId } })
		if (count != 0) {
			console.log(`user ${userId} already has ${count} rules. Skipping adding new rules for this user`)
			continue
		}


		for (let rule of rules) {
			const newRule = await models.Rule.create({ 
				title: rule.title, 
				description: rule.description,
				author_id: userId,
				edited: true
			})
		}
		
		console.log(`Added ${rules.length} rules for user ${userId}`)
	}
}

async function queryTest() {
	const { sequelize, models } = await connectToDB()

	// const users = await models.User.findAll()
	// console.log(users[0].name)

	// const rules = await users[0].getRules()
	// console.log(rules[0].title)

	// console.log((await rules[0].getUser()).name)

	// const rulesFromOthers = await sequelize.query(`
 //      SELECT * FROM "rules"
 //      WHERE "author_id" != :user_id
 //      ORDER BY RANDOM()
 //      LIMIT 5
 //    `, {
 //      replacements: { user_id: 1 }, // Replace with the actual value to exclude
 //      model: models.Rules, // Replace with your actual Sequelize model
 //    });

 

}

async function makeConnections() {
	const { sequelize, models } = await connectToDB()

	const connections = [
		[1, 116], // "You don't have a lot of time" / "31. be present"
		[30, 2] // "Prioritize feeling good",
	]

	for (let con of connections) {
		const id1 = con[0]
		const id2 = con[1]

		await makeConnectionIfNotExists(id1, id2, models)
	}
}

async function makeConnectionIfNotExists(id1, id2, models) {
	let smallerId = Math.min(id1, id2)
	let largerId = Math.max(id1, id2)

	const connections = await models.Connection.findAll({
		where: { rule_id_1: smallerId, rule_id_2: largerId }
	})
	if (connections.length == 0) {
		console.log(`Creating connection ${smallerId} -> ${largerId}`)
		await models.Connection.create({
			rule_id_1: smallerId, rule_id_2: largerId, metadata: JSON.stringify({ similarity: 0.85 })
		})
	} else {
		console.log(`Connection already exists ${smallerId} -> ${largerId}`)
	}
}

async function deleteRulesForUser(userId) {
	const { sequelize, models } = await connectToDB()

	const rules = await models.Rule.findAll({
		where: { author_id: userId }
	})
	const users = await models.User.findAll({
		where: { id: userId }
	})

	const user = users[0]
	console.log(user.name)

	console.log("Rules:", rules.length)
	console.log("First 5 rules", rules.map(rule => rule.title).slice(0, 5))

	for (let rule of rules) {
		await rule.destroy()
	}
}

insert_data()
// makeConnections()
// queryTest()

// 2, 3, 4, 5, 6
// deleteRulesForUser(2)
// deleteRulesForUser(3)
// deleteRulesForUser(4)
// deleteRulesForUser(5)
// deleteRulesForUser(6)

