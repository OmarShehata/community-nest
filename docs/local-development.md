# Local development

Clone this repo. Install node/pnpm (https://pnpm.io/installation).

1. `pnpm install` to intall node dependencies
1. Run `env.bat` to set environmant variables 
1. Initialize the DB by running `node scripts/reset_db.js`
1. `pnpm watch` to run the server with auto-reload

The individual pages are in `views/`. The server entry point is in `src/server.js`.

Any file in `public/` will be available publicly at the root url. For example, `public/image.png` will be served at `http://localhost:3000/image.png`. 

## Add a new page

- copy `views/simple.handlebars` to `views/your_new_page.handlebars`
- this page will be served at:

`/your_new_page/<username>`

- the page gets all the tweets for the current user and displays them. See `views/archive.handlebars` for reference.