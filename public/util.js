class Util {
    constructor({accountId, username}) {
        this.accountId = accountId
        this.username = username

        this.tweetsById = {}
    }

    async fetchTweets() {
        const tweetsResponse = await fetch(`/tweets/${this.accountId}`)
        const tweetsJsonRaw = await tweetsResponse.json()
        return this.preprocessTweets(tweetsJsonRaw)
    }

    preprocessTweets(tweetsJsonRaw) {
        const newTweets = []
        for (let i = 0; i < tweetsJsonRaw.length; i++) {
          const tweet = tweetsJsonRaw[i].tweet 
          tweet.url = `https://x.com/${this.username}/status/${tweet.id}`
          tweet.date = new Date(tweet.created_at)
          newTweets.push(tweet)
          this.tweetsById[tweet.id] = tweet
        }
        return newTweets
    }

    getThreads(tweets) {
        const newTweets = []
        let retweet_count = 0
        let external_reply_count = 0

        for (let i = 0; i < tweets.length; i++) {
          const { in_reply_to_user_id_str, in_reply_to_status_id, full_text } = tweets[i] 
          // ignore retweets
          if (full_text.startsWith('RT')) {
            retweet_count ++
            continue
          }
          // if it's a reply to ANOTHER user, ignore it
          if (in_reply_to_user_id_str != null && in_reply_to_user_id_str != this.accountId) {
            tweets[i].is_external_reply = true
            external_reply_count ++
            continue
          }
          // if it's a reply to self, link it to the tweet it is replying to
          if (in_reply_to_user_id_str == this.accountId) {
            const reply_id = in_reply_to_status_id
            if (!this.tweetsById[reply_id]) {
                console.error(`Error: failed to find tweet ${reply_id}`)
                continue
            }
            if (this.tweetsById[reply_id].is_external_reply) {
                // ignore linking because the parent is an external one
                tweets[i].is_external_reply = true
                external_reply_count ++
                continue
            } else {
                this.tweetsById[reply_id].nextTweet = tweets[i]
                tweets[i].parent = this.tweetsById[reply_id]
            }
          }

          newTweets.push(tweets[i])
        }

        return { tweets: newTweets, retweet_count, external_reply_count }
    }

    sortAscending(tweets) {
        return tweets.sort(function(a,b){
            return a.date - b.date
        })
    }

    sortDescending(tweets) {
        return tweets.sort(function(a,b){
            return b.date - a.date
        })
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', { 
            hour: 'numeric',
            year: 'numeric', 
            month: 'short',
            day: '2-digit'
        });
    }

    makeHTMLForTweet(tweet) {
        return `<div class="tweet">
      <p>${tweet.full_text}</p>
      <div class="metadata">
        <p>${this.formatDate(tweet.date)}</p>
        <div class="toolbar">
          ${tweet.retweet_count} 🔂 ${tweet.favorite_count} 🤍
          <a href="${tweet.url}" target="_blank" style="text-decoration:none">
            <svg width="20px" height="20px" viewBox="0 0 24 24" transform="translate(0 3)" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V13" stroke="#292929" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path d="M9 15L20 4" stroke="#292929" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path d="M15 4H20V9" stroke="#292929" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          </a>
        </div>
      </div>
    </div>
    `
    }

    makeHTMLForThread(tweet) {
        let str = `<div class="thread">`
        while (tweet) {
            str += this.makeHTMLForTweet(tweet)
            tweet = tweet.nextTweet
        }
        str += '</div>'

        return str
    }
}
