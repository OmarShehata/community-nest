import express from 'express'
import { engine } from 'express-handlebars';
import { uniqueNamesGenerator, names } from 'unique-names-generator'
import { connectToDB } from './db.js'
import { makeRandomToken } from './randomToken.js'
import { dirname } from 'path';
import path from 'path'
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import unzipper from 'unzipper'
import fileUpload from 'express-fileupload';
import { processArchive, moveFilesRecursively } from './processArchive.js'
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
  app.engine('handlebars', engine());
  app.set('view engine', 'handlebars');
  app.set('views', './views');
  app.use(fileUpload({
    // useTempFiles : true,
    // tempFileDir : path.join(__dirname, '../.data/tmp')
    
  }));
  app.use(express.json());
  app.use(express.static('public'));

  ///// Pages
  app.get("/", async function (request, response) {
    // TODO: get the list of archives
    const archives = await models.Archive.findAll()
    const expectedFiles = ['account.js', 'tweets.js', 'like.js', 'following.js', 'follower.js']
    response.render('index', { archives, expectedFiles })
  });
  app.get("/about", async function(request, response) {
    response.render('about')
  })

  //////// API routes
  app.get("/archives/:accountId", async function(request, response) {
    const accountId = request.params.accountId
    const archives = await models.Archive.findAll({
      where: { accountId }
    });
    const archive = archives[0]
    console.log(archive)

    const tweetsPath = `${ARCHIVE_DIRECTORY}/${archive.username}/tweets.json`
    const tweets = JSON.parse(await fs.promises.readFile(tweetsPath, 'utf8'));

    response.render('archive', { archive, tweets })
  })
  app.post('/newArchive', async function (request, response) {
    // TODO take twitter oauth and check that it's valid?
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

      // 
      // Move to folder with username
      const sourcePath = tempFolder
      const desPath = `${ARCHIVE_DIRECTORY}/${result.account.username}/`
      await moveFilesRecursively(sourcePath, desPath)
      await fs.promises.rm(tempFolder, { recursive: true });

      response.send('File uploaded ');
    });
  })

  const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });

}

run()

async function extractZip(zipFilePath, tempFolder) {
  return new Promise((resolve, reject) => {
      fs.createReadStream(zipFilePath)
          .pipe(unzipper.Extract({ path: tempFolder }))
          .on('error', reject)
          .on('finish', resolve);
  });
}
