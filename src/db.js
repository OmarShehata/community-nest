import Sequelize from 'sequelize'
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function connectToDB() {
	console.log("Connecting to DB...")
	const sequelize = new Sequelize('database', process.env.DB_USER, process.env.DB_PASS, {
	  host: '0.0.0.0',
	  logging: false,
	  dialect: 'sqlite',
	  pool: {
	    max: 5,
	    min: 0,
	    idle: 10000
	  },
	  storage: resolve(__dirname, '../.data/database.sqlite')
	});
	await sequelize.authenticate()	
	const models = getSchema(sequelize)
	console.log("Connected!")

	return { sequelize, models }
}


export function getSchema(sequelize) {
	const User = sequelize.define('users', {
		name: { type: Sequelize.STRING },
		token: { type: Sequelize.STRING },
	  	metadata: { type: Sequelize.STRING }
	})

	const Rule = sequelize.define('rules', {
		title: { type: Sequelize.STRING, },
		description: { type: Sequelize.STRING, },
		edited: { type: Sequelize.BOOLEAN, defaultValue: false }
	})

	// connects two rules together
	const Connection = sequelize.define('connections', {
		metadata: { type: Sequelize.STRING }
	})

	// Resonation records, each time a user "resonates" with a post
	const Resonation = sequelize.define('resonations', {

	}, {
		indexes: [
		    {
		      unique: true,
		      fields: ['userId', 'ruleId']
		    }
		  ]
	})

	// A user can have several rules, and a rule belongs to 1 and only 1 user
	User.hasMany(Rule, { foreignKey: 'author_id' });
	Rule.belongsTo(User, { foreignKey: 'author_id' })
	// A connection connects two rules
	Connection.belongsTo(Rule, { foreignKey: 'rule_id_1' });
	Connection.belongsTo(Rule, { foreignKey: 'rule_id_2' });

	// Allow users to "resonate" with rules
	User.belongsToMany(Rule, { through: Resonation, foreignKey: 'userId' });
	Rule.belongsToMany(User, { through: Resonation, foreignKey: 'ruleId' });


	return {
		User, Rule, Connection
	}
}