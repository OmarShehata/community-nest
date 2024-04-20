import '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs-node';
import { connectToDB, getSchema } from '../src/db.js'

const DEFAULT_RULE_TITLE = "Title goes here"

async function run() {
  const { sequelize, models } = await connectToDB()

  let rules = await models.Rule.findAll({
    where: { edited: true }
  })
  console.log("Rules: ", rules.length)
  rules = rules.filter(rule => rule.title != DEFAULT_RULE_TITLE) 
  const sentences = []
  const sentenceToRuleMap = {}
  const ruleIdToRule = {}
  for (let rule of rules) {
    const description = rule.description ? rule.description : ''
    const str = `${rule.title} ${description}`
    sentences.push(str)

    sentenceToRuleMap[str] = rule
    ruleIdToRule[rule.id] = rule
  }
  
  console.log("Loading model...")
  const model = await use.load()
  console.log("Embedding sentences...")
  const embeddings = await model.embed(sentences)

  const normalized_embeddings = embeddings.div(tf.norm(embeddings, 'euclidean', 1, true));
  const similarities = tf.matMul(normalized_embeddings, normalized_embeddings, false, true);

  // Convert to array to process the similarities
  const similarityMatrix = await similarities.array()
  let highestSimilarity = 0;
  let mostSimilarPair = [0, 1]; // Initialize with the first two indices

  const mostSimilarMap = {}
  // mostSimilarMap[rule_id] = [{ other_rule_id, similarity }, ... ]

  function createEntryIfNotExist(rule, other_rule, sim) {
    if (mostSimilarMap[rule.id] == undefined) {
      mostSimilarMap[rule.id] = [{ other_rule_id: other_rule.id, sim }]
    }
  }
  function updateEntry(rule, other_rule, sim) {
    mostSimilarMap[rule.id].push({
      other_rule_id: other_rule.id, sim 
    })
  }

  for (let i = 0; i < similarityMatrix.length; i++) {
    for (let j = i + 1; j < similarityMatrix.length; j++) {
      const ruleI = sentenceToRuleMap[sentences[i]]
      const ruleJ = sentenceToRuleMap[sentences[j]]
      // Skip rules from the same author
      if (ruleI.author_id == ruleJ.author_id) {
        continue;
      }

      const sim = similarityMatrix[i][j]
      createEntryIfNotExist(ruleI, ruleJ, sim)
      createEntryIfNotExist(ruleJ, ruleI, sim)
      updateEntry(ruleI, ruleJ, sim)
      updateEntry(ruleJ, ruleI, sim)
    }
  }

  // Clear all connections
  await models.Connection.destroy({ where: {}, truncate: true})
  // Find the top 3 connections per rule 
  const topRulesPerUser = {}
  // topRulesPerUser[user.id] = [ {} ]
  for (let rule_id in mostSimilarMap) {
    const top3Rules = mostSimilarMap[rule_id]
      .sort((a, b) => { return b.sim - a.sim }).slice(0, 3)

    const rule = ruleIdToRule[rule_id]
    if (topRulesPerUser[rule.author_id] == undefined) {
      topRulesPerUser[rule.author_id] = []
    }

    for (let topRule of top3Rules) {
      const { sim, other_rule_id } = topRule
      topRulesPerUser[rule.author_id].push({
        sim, rule_id_1: rule_id, rule_id_2: other_rule_id
      })
    }
  }

  // Now we have the top connections per user 
  for (let user_id in topRulesPerUser) {
    const userConnections = topRulesPerUser[user_id]
      .sort((a, b) => { return b.sim - a.sim }).slice(0, 10)

    console.log(`Connections for user ${user_id}: ${userConnections.length}`)
    for (let con of userConnections) {
      const { sim, rule_id_1, rule_id_2 } = con 
      console.log(`   ${ruleIdToRule[rule_id_1].title} /// ${ruleIdToRule[rule_id_2].title}`)

      await makeConnectionIfNotExists(
        rule_id_1, rule_id_2,
        sim,
        models
      )
    }

    console.log("------------------")
  }
}


run()



async function makeConnectionIfNotExists(id1, id2, sim, models) {
  let smallerId = Math.min(id1, id2)
  let largerId = Math.max(id1, id2)

  const connections = await models.Connection.findAll({
    where: { rule_id_1: smallerId, rule_id_2: largerId }
  })
  if (connections.length == 0) {
    console.log(`Creating connection ${smallerId} -> ${largerId}`)
    await models.Connection.create({
      rule_id_1: smallerId, rule_id_2: largerId, metadata: JSON.stringify({ similarity: sim })
    })
  } else {
    console.log(`Connection already exists ${smallerId} -> ${largerId}`)
  }
}
