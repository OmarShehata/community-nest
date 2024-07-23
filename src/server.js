import express from 'express'
import { engine } from 'express-handlebars';
import { connectToDB } from './db.js'
import { dirname } from 'path';
import path from 'path'
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import unzipper from 'unzipper'
import fileUpload from 'express-fileupload';
import { processArchive, moveFilesRecursively } from './processArchive.js'
import { Op } from 'sequelize';
import zlib from 'zlib'
import util from 'util'
const gunzip = util.promisify(zlib.gunzip);
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIRECTORY =  path.join(__dirname, '../.data/')
const TEMP_ZIP_FILE_DIR = path.join(DATA_DIRECTORY, 'temp')
const ARCHIVE_DIRECTORY = path.join(__dirname, '../public/archives')

async function run() {
  const { sequelize, models } = await connectToDB()

  // Initialize data directories
  fs.mkdirSync(ARCHIVE_DIRECTORY, { recursive: true });
  fs.mkdirSync(TEMP_ZIP_FILE_DIR, { recursive: true });


  const app = express();
  app.engine('handlebars', engine({
    helpers: {
      json: JSON.stringify
    }
  }));
  app.set('view engine', 'handlebars');
  app.set('views', './views');
  app.use(fileUpload());
  app.use(express.json());
  app.use(express.static('public'));

  ///// Pages
  app.get("/", async function (request, response) {
    const archives = await models.Archive.findAll()
    response.render('index', { archives })
  });
  app.get("/about", async function(request, response) {
    response.render('about')
  })
  
  //////// API routes
  app.get("/tweets/:usernameORaccountId", async function(request, response) {
    const { usernameORaccountId } = request.params
    
    const archives = await getArchiveByUsernameOrId(models, usernameORaccountId)
    if (archives.length == 0) {
      response.status(404).send("Not found")
      return
    }

    const archive = archives[0]
    try {
      const tweetsPath = `${ARCHIVE_DIRECTORY}/${archive.username}/tweets.json.gz`
      const compressedData = await fs.promises.readFile(tweetsPath)
      response.writeHead(200, { 
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip'
      });
      response.end(compressedData);
    } catch (error) {
      console.log(error)
      response.status(500).send(error)
    } 

  });
  app.get("/:pagename/:usernameORaccountId", async function(request, response) {
    const { pagename, usernameORaccountId } = request.params
    const archives = await getArchiveByUsernameOrId(models, usernameORaccountId)
    if (archives.length == 0) {
      response.status(404).send("Not found")
      return
    }
    response.render(pagename, { usernameORaccountId, archive: archives[0] })
  })

  app.post('/newArchive', async function (request, response) {
    console.log('Received file:', request.files.archive.name);
    // Move the zip file to a temporary directory with uuid name
    const uuid = uuidv4()
    const archiveFile = request.files.archive;
    const tempFolder = path.join(TEMP_ZIP_FILE_DIR, uuid)
    const zipFilePath = `${tempFolder}/archive.zip`
    fs.mkdirSync(tempFolder, { recursive: true });
    archiveFile.mv(zipFilePath, async function(error) {
      if (error) {
        console.log(error)
        return response.render('error', { error })
      }

      // Unzip and extract username
      const result = await processArchive(zipFilePath)
      const existingArchive = await models.Archive.findOne({ where: { accountId: result.account.accountId } })
      const options = {
        username: result.account.username,
        accountId: result.account.accountId,
		    numTweets: result.numTweets
      }
      if (existingArchive) {
        await existingArchive.update(options)
      } else {
        await models.Archive.create(options)
      }

      // Move to folder with username
      const sourcePath = tempFolder
      const desPath = `${ARCHIVE_DIRECTORY}/${result.account.username}/`
      await moveFilesRecursively(sourcePath, desPath)
      await fs.promises.rm(tempFolder, { recursive: true });

      console.log("Success!")
      response.redirect(`/archive/${result.account.accountId}`)
    });
  })

  const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });

}

async function getArchiveByUsernameOrId(models, usernameORaccountId) {
  // Try querying for username
  let archives = await models.Archive.findAll({
    where: { username: {
      [Op.like]:  usernameORaccountId
    } }
  });
  // otherwise, query for accountId
  if (archives.length == 0) {
    archives = await models.Archive.findAll({
      where: { accountId: usernameORaccountId }
    });
  }

  return archives
}

run()
