import OpenAI from 'openai'
import { LocalIndex } from 'vectra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url));
const api = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

export default class Embeddings {
    constructor(id) {
        if (id == undefined) {
            throw Error("Missing id!")
        }
        this.id = id 
        this.vectorDBIndex = new LocalIndex(path.join(__dirname, '..', `.data/${id}`));
    }

    async getVectors(textArray) {
        const response = await api.embeddings.create({
            'model': 'text-embedding-ada-002',
            'input': textArray,
        });
        return response.data.map(item => item.embedding)
    }
    
    async addItems(textArray) {
        const index = this.vectorDBIndex
        const vectors = await this.getVectors(textArray)
        const ids = []

        await index.beginUpdate();

        for (let i = 0; i < textArray.length; i++) {
            const id = await index.insertItem({
                vector: vectors[i],
                metadata: { text: textArray[i] }
            });
            ids.push(id)
        }

        await index.endUpdate();

        return ids
    }

    async findByText(text) {
        const index = this.vectorDBIndex
        return await index.listItemsByMetadata({ text: { $eq: text } })
    }

    async query(text, max = 100) {
        const index = this.vectorDBIndex

        const vector = (await this.getVectors([text]))[0];
        const results = await index.queryItems(vector, max);
        return results
        // if (results.length > 0) {
        //     for (const result of results) {
        //         console.log(`[${result.score}] ${result.item.metadata.text}`);
        //     }
        // } else {
        //     console.log(`No results found.`);
        // }
    }

    async init() {
        const index = this.vectorDBIndex

        if (!await index.isIndexCreated()) {
            await index.createIndex();
        }
    }
}