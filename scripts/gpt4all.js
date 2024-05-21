import { LLModel, createCompletion, DEFAULT_DIRECTORY, DEFAULT_LIBRARIES_DIRECTORY, loadModel, createEmbedding  } from 'gpt4all'
import fs from 'fs'
import kmeans from 'node-kmeans'
import util from 'util'
import zlib from 'zlib'
const gunzip = util.promisify(zlib.gunzip);
const compressedData = await fs.promises.readFile('public/archives/DefenderOfBasic/tweets.json.gz')
const decompressedData = await gunzip(compressedData);
const dataString = decompressedData.toString('utf8');

const tweets = JSON.parse(dataString);
// let processedTweets = tweets.map(item => item.tweet.full_text)
let processedTweets = []
let i= 0
while(processedTweets.length < 300) {
    i++;
    processedTweets.push(tweets[i].tweet.full_text)
}


// https://platform.openai.com/docs/tutorials/web-qa-embeddings
// https://docs.gpt4all.io/gpt4all_nodejs.html#chat-completion
// const model = await loadModel( 'mistral-7b-openorca.gguf2.Q4_0.gguf', { verbose: true, device: 'gpu' });

// const completion1 = await createCompletion(model, 'What is 1 + 1?', { verbose: true, })
// console.log(completion1.message)

// const completion2 = await createCompletion(model, 'And if we add two?', {  verbose: true  })
// console.log(completion2.message)

// model.dispose()


function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;  // Handle zero division errors
    } else {
        return dotProduct / (normA * normB);
    }
}


const embedder = await loadModel("nomic-embed-text-v1.f16.gguf", { verbose: false, type: 'embedding'})
function getVec(word) {
    return createEmbedding(embedder, word).embeddings
}

// const sim = cosineSimilarity(getVec("diamond"), getVec("ring"))

const vectors = []
for (let i = 0; i < processedTweets.length; i++) {
    const tweet = processedTweets[i]
    console.log(i)
    const vector = Array.from(getVec(tweet))
    vectors.push({ tweet, vector })
}


await fs.promises.writeFile('vectors.json', JSON.stringify(vectors));