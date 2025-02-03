/* global browser, fetch, Image, DOMParser */

class Cache {
  constructor (updateInterval, updateFunction, updateCondition) {
    this.updateFunction = updateFunction
    this.updateCondition = updateCondition

    this.data = []
    this.pendingSubscribers = []
    this.hitsSinceLastUpdate = 0
    this.updatePromise = null

    this.interval = setInterval(this.update.bind(this), updateInterval)
    this.updateNow()
  }

  _getRandomDataElement () {
    this.hitsSinceLastUpdate++
    return this.data[Math.floor(Math.random() * this.data.length)]
  }

  get () {
    if (this.data.length > 0) {
      return Promise.resolve(this._getRandomDataElement())
    } else {
      const subscriber = new Promise((resolve, reject) => {
        this.pendingSubscribers.push(resolve)
      })

      this.updateNow()
      return subscriber
    }
  }

  update () {
    if (this.updateCondition(this.data.length, this.hitsSinceLastUpdate)) {
      this.updateNow()
    }
  }

  updateNow () {
    if (!this.updatePromise) {
      this.updatePromise = this.updateFunction()
        .then(data => {
          this.data = data.filter(elm => elm !== null)
          this.pendingSubscribers.forEach(subscriber => subscriber(this._getRandomDataElement()))

          this.pendingSubscribers = []
          this.updatePromise = null
          this.hitsSinceLastUpdate = 0
        })
    }
  }
}

const IMAGE_LIMIT = 40
const IMAGE_DOWNLOAD_LIMIT = 10

function imageWidthWithinRange (width) {
  return width > 1000 && width < 4000
}

function imageHeightWithinRange (height) {
  return height > 1000 && height < 2500
}

function imageIsCorrupt (image) {
  return !imageWidthWithinRange(image.naturalWidth) // Images from reddit which are not found  (404) returns a small placeholderImage
}

function fetchImagesFromReddit (url = `https://www.reddit.com/r/EarthPorn.json?limit=${IMAGE_LIMIT}`) {
  return fetch(url)
    .then(response => response.json())
    .then(json => json.data.children)
    .then(children => {
      return Promise.all(
        children
          .map(elm => elm.data)
          .filter(elm => elm.over_18 === false)
          .filter(elm => elm.preview !== undefined)
          .filter(elm => elm.preview.enabled === true)
          .filter(elm => elm.preview.images.length > 0)
          .filter(elm => elm.preview.images[0])
          .filter(elm => imageWidthWithinRange(elm.preview.images[0].source.width))
          .filter(elm => imageHeightWithinRange(elm.preview.images[0].source.height))
          .filter(elm => elm.url.startsWith('https://i.redd.it/'))
          .slice(0, IMAGE_DOWNLOAD_LIMIT)
          .map(elm => {
            return {
              user: elm.author,
              title: elm.title.replace(/\[.*?\]/g, '').trim(),
              copyright: `Image uploaded by reddit user ${elm.author}`,
              img_src: elm.url,
              redditlink: `https://reddit.com/${elm.permalink}`
            }
          })
          .map(redditData => {
            const image = new Image()
            return new Promise((resolve, reject) => {
              image.onerror = (err) => {
                console.log(err)
                resolve(null)
              }

              image.onload = () => {
                if (imageIsCorrupt(image)) {
                  resolve(null)
                } else {
                  resolve(redditData)
                }
              }

              image.src = redditData.img_src
            }
            )
          }))
    })
}

function removeLeadingAndTrailingQuotationMarks (string) {
  return string.replace(/(^"+|"+$)/g, '')
}

function fetchQuote (url = 'https://feeds.feedburner.com/brainyquote/QUOTEBR') {
  return fetch(url, { cache: 'no-store' })
    .then(response => response.text())
    .then(text => new DOMParser().parseFromString(text, 'text/xml'))
    .then(xml => xml.documentElement.getElementsByTagName('item'))
    .then(collection => Array.from(collection).slice(0, 5))
    .then(collection => collection.map(quoteElement => {
      const data = {}
      Array.from(quoteElement.children).forEach(element => {
        data[element.nodeName] = element.textContent
      })

      return {
        quote: removeLeadingAndTrailingQuotationMarks(data.description),
        author: data.title,
        url: data.link,
        website: 'BrainyQuote.com'
      }
    }))
}

const quoteCache = new Cache(
  2 * 60 * 60 * 1000,
  fetchQuote,
  (noOfElementsInCache, hitsSinceLastUpdate) => {
    return noOfElementsInCache > 0 && hitsSinceLastUpdate > 10
  })

const imageCache = new Cache(
  4 * 60 * 60 * 1000,
  fetchImagesFromReddit,
  (noOfElementsInCache, hitsSinceLastUpdate) => {
    return noOfElementsInCache > 0 && hitsSinceLastUpdate > IMAGE_DOWNLOAD_LIMIT
  })

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_BACKGROUND_IMAGE':
      sendResponse(imageCache.get())
      break
    case 'GET_QUOTE':
      sendResponse(quoteCache.get())
      break
  }
})
