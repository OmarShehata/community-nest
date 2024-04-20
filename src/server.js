import express from 'express'
import { engine } from 'express-handlebars';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { uniqueNamesGenerator, names } from 'unique-names-generator'
import { connectToDB } from './db.js'
import { makeRandomToken } from './randomToken.js'

async function run() {
  const { sequelize, models } = await connectToDB()

  const app = express();
  app.engine('handlebars', engine());
  app.set('view engine', 'handlebars');
  app.set('views', './views');
  app.use(express.json());
  app.use(express.static('public'));

  ///////////// Views
  app.get("/", async function (request, response) {
    const rulesCount = await models.Rule.count({
      where: { edited: true }
    })
    console.log("RULES 2 COUNT", rulesCount)
    const usersCount = await sequelize.query(`
    SELECT 
      COUNT(DISTINCT rules.author_id) AS users_with_rules
    FROM 
      users
    INNER JOIN 
      rules ON users.id = rules.author_id
    WHERE rules.edited = true;
    `);
    const usersWithRules = usersCount[0][0]["users_with_rules"]

    response.render('index', { rulesCount, usersCount: usersWithRules })
  });

  app.get("/settings", async function(request, response) {
    response.render('settings')
  })
  app.get("/about", async function(request, response) {
    response.render('about')
  })

  app.get("/rules/:userid", async function(request, response) {
    const userid = request.params.userid
    const users = await models.User.findAll({
      where: { id: userid }
    });

    if (users.length == 0) {
      response.sendStatus(404)
      return 
    }

    const result = await sequelize.query(`
    SELECT 
      *
    FROM 
      rules
    WHERE rules.author_id = ${users[0].id}
    ORDER BY createdAt DESC;
    `);
    const rules = result[0]

    const processedRules = []
    for (let rule of rules) {
      processedRules.push({
        title: rule.title, description: rule.description
      })
    }

    const rulesFromOthers = 
      await getRandomRulesFromOthers(sequelize, users[0].id, 12)

    const ruleConnections = await getConnectionsForUser(sequelize, models, users[0].id)
    response.render('rules', {
      name: users[0].name,
      rules: processedRules ,
      rulesFromOthers: rulesFromOthers[0],
      ruleConnections
    })
  })

  ////////////// User routes
  app.post("/updateUser", async function (request, response) {
    const users = await models.User.findAll({
      where: { token: request.body.token }
    });

    if (users.length == 0) {
      return response.sendStatus(403)
    }

    if (request.body.name) {
      users[0].name = request.body.name 

      if (request.body.name.length > 50) {
        return response.status(400).send("Name must be < 50 characters")
      }

      await users[0].save()
       return response.sendStatus(200)
    }

    return response.status(400).send("Nothing to update")
  })

  app.post("/newUser", async function (request, response) {
    const token = await makeRandomToken()
    // unique name https://www.npmjs.com/package/unique-names-generator#what-is-unique-name-generator
    const newUser = await models.User.create({
      name: getRandomName(),
      token: token
    })

    // Give this user a default rule 
    const { title, description } = getDefaultRule()

    const newRule = await models.Rule.create({ 
      title, description,
      author_id: newUser.id 
    })

    const rulesFromOthers = await getRandomRulesFromOthers(sequelize, newUser.id)
    response.json({ user: newUser, rules: [newRule],
      rulesFromOthers: rulesFromOthers[0] });
  });

  app.post('/userInfo', async function (request, response) {
    const users = await models.User.findAll({
      where: { token: request.body.token }
    });

    if (users.length == 0) {
      response.sendStatus(403)
      return 
    }

    // Get rules associated with this user 
    const user = users[0]
    const result = await sequelize.query(`
    SELECT 
      *
    FROM 
      rules
    WHERE rules.author_id = ${users[0].id}
    ORDER BY createdAt DESC;
    `);
    const rules = result[0]

    // Get a random selection of rules from others
    const rulesFromOthers = await getRandomRulesFromOthers(sequelize, user.id)
    response.json({ user, rules, rulesFromOthers: rulesFromOthers[0] })
  })

  //////// Rules routes
  app.post('/newRule', async function (request, response) {
    const { token, userId } = request.body
    const users = await models.User.findAll({
      where: { id: userId, token }
    });

    // to authenticate that we got the right token for this user
    if (users.length == 0) {
      return response.sendStatus(403)
    }

    const { title, description } = getDefaultRule()

    const newRule = await models.Rule.create({ 
        title, description,
        author_id: userId
      })
    return response.json(newRule)
  })

  app.post("/updateRule", async function (request, response) {
    const { token, userId, ruleId, title, description } = request.body
    const users = await models.User.findAll({
      where: { id: userId, token }
    });

    // to authenticate that we got the right token for this user
    if (users.length == 0) {
      return response.sendStatus(403)
    }

    const rules = await models.Rule.findAll({
      where: { id: ruleId, author_id: users[0].id },
      order: [['createdAt', 'DESC']]
    })

    if (rules.length != 0) {
      // Delete the rule if title & description are empty
      if (title == "" && description == "") {
        await rules[0].destroy()
      } else {
        rules[0].title = title 
        rules[0].description = description
        rules[0].edited = true
        await rules[0].save()
      }
      
      return response.sendStatus(200)
    }

    return response.status(400).send("Nothing to update")
  })

  const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });

}

run()

function getRandomName() {
  return uniqueNamesGenerator({ dictionaries: [names, names], separator: ' ' });
}

function getDefaultRule() {
  const title = `Title goes here`

  const description = 
`(optional) description goes here. This _supports_ **markdown**.

Delete a rule by editing then deleting all the text.`

  return { title, description }
}

async function getRandomRulesFromOthers(sequelize, userIdToExclude, limit=9) {
  return await sequelize.query(`
    SELECT 
      rules.title, rules.description, rules.author_id, 
      users.name AS author_name
    FROM 
      "rules"
    JOIN 
      users ON rules.author_id = users.id
    WHERE 
      rules.author_id != ${userIdToExclude}
      AND
      rules.edited = true 
    ORDER BY 
      RANDOM()
    LIMIT ${limit}
    `);
}
async function getConnectionsForUser(sequelize, models, userId) {
  // Given a user, search for any connections for any of their rules

 // Find al their non-default rules
 const rules = await models.Rule.findAll({
  where: { author_id: userId, edited: true }
 })
 const ruleIds = rules.map(rule => rule.id).join(",")
 // Query for all connections that contain any of these rules
 // and fetch the contents of both rules for each connection
 let result = await sequelize.query(
  `SELECT 
    connections.*,

    rt1.title AS rule_1_title,
    rt1.description AS rule_1_description,
    rt1.author_id AS rule_1_author_id,

    rt2.title AS rule_2_title,
    rt2.description AS rule_2_description,
    rt2.author_id AS rule_2_author_id
  FROM 
    connections
  INNER JOIN 
    rules rt1 ON connections.rule_id_1 = rt1.id
  INNER JOIN 
    rules rt2 ON connections.rule_id_2 = rt2.id
  WHERE 
    (rule_id_1 IN (${ruleIds}) OR rule_id_2 IN (${ruleIds}))
      AND 
    (rule_id_1 IS NOT NULL AND rule_id_2 IS NOT NULL);`
  )
 let rulesWithConnections = result[0]
 rulesWithConnections.forEach(item => {
  item.sim = JSON.parse(item.metadata).similarity
  delete item.metadata
  delete item.createdAt
  delete item.updatedAt
 })

 rulesWithConnections.sort((a,b) => b.sim - a.sim)

 const ruleMap = {}
 const authorNamesToCollect = {}

 function addRule(
  rule_id_1, rule_1_title, rule_1_description,
  rule_2_author_id, rule_2_title, rule_2_description, sim) {
  if (ruleMap[rule_id_1] == undefined) {
      ruleMap[rule_id_1] = 
      { rule_title: rule_1_title, 
        rule_description: rule_1_description,
        connected_rules: [] }
    }

    authorNamesToCollect[rule_2_author_id] = true

    ruleMap[rule_id_1].connected_rules.push({
      title: rule_2_title,
      description: rule_2_description,
      author_id: rule_2_author_id,
      sim
    })
 }

 for (let con of rulesWithConnections) {
  const { 
          rule_id_1, rule_id_2,
          rule_1_title, rule_2_title,
          rule_1_description, rule_2_description,
          rule_1_author_id, rule_2_author_id, sim } = con 

    if (rule_1_author_id == userId) {
      addRule(rule_id_1, rule_1_title, rule_1_description,
              rule_2_author_id, rule_2_title, rule_2_description, sim)
    } else if (rule_2_author_id == userId) {
      addRule(rule_id_2, rule_2_title, rule_2_description,
              rule_1_author_id, rule_1_title, rule_1_description, sim)
    }
 }

 const authorNames = Object.keys(authorNamesToCollect).join(",")
 result = await sequelize.query(`
  SELECT
    users.id,
    users.name
  FROM 
    users
  WHERE
    id IN (${authorNames})
  `)
 const userIdToName = {}
 for (let item of result[0]) {
  userIdToName[item.id] = item.name
 }

 for (let ruleId in ruleMap) {
  const item = ruleMap[ruleId]
  for (let con of item.connected_rules) {
    con.author_name = userIdToName[con.author_id]
  }
 }

 const connected_rules_final = []
 for (let ruleId in ruleMap) {
  const item = ruleMap[ruleId]

  connected_rules_final.push({
    rule_title: escape(item.rule_title),
    rule_description: escape(item.rule_description),
    connected_rules: JSON.stringify(item.connected_rules)
  })
 }

 return connected_rules_final
}

function escape(htmlStr) {
  if (htmlStr == null) return ""
   return htmlStr.replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#39;");        

}