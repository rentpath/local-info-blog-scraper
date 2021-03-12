#!/usr/bin/env node

const fs = require('fs')

const axios = require('axios')
const cheerio = require('cheerio')
const flatCache = require('flat-cache')
const prettier = require('prettier')
const styleParse = require('style-to-js').default
const { Command } = require('commander')
const { GoogleSpreadsheet } = require('google-spreadsheet')

const CATEGORIES = require('./categories.json')

const BLOG_LINK_REGEX = /^https:\/\/www.apartmentguide.com\/blog/

const program = new Command()

program
  .description('Generate local info blog links for AG from google spreadsheet data')
  .requiredOption('-c, --credentials <file>', 'JSON Credentials File from Google')
  .requiredOption('-s, --sheet <id>', 'Google spreadsheet ID number')
  .option('-o, --output <file.js>', 'Javascript file Results Output', './output.js')
  .option('-v, --verbose', 'Print output to screen')
  .option(
    '--cloudinary <url>',
    'Rentpath API to generate cloudinary imageId',
    'http://storeimage.vip.useast2.rentpath.com',
  )
  .parse(process.argv)

const options = program.opts()

const creds = require(options.credentials)

const cache = flatCache.load('image-cache', './')

// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(options.sheet)

function saveCache() {
  cache.save()
  const cacheString = fs.readFileSync('./image-cache', { encoding: 'utf8', flag: 'r' })
  const cacheStringPretty = prettier.format(cacheString, { max_line_length: 200, parser: 'json' })
  fs.writeFileSync('./image-cache', cacheStringPretty)
}

function handleError(error) {
  console.log('There was an error')
  console.log(error)
}

function base64(data) {
  return Buffer.from(data).toString('base64')
}

function setupAccess() {
  return doc.useServiceAccountAuth(creds).catch(handleError)
}

async function getSheet(index = 0) {
  await doc.loadInfo() // loads document properties and worksheets
  await doc.updateProperties({ title: 'renamed doc' })

  return doc.sheetsByIndex[index]
}

async function readPerCityLinks(sheet) {
  const rows = await sheet.getRows() // skip first row

  return rows
    .map((row) => {
       const [city, ...links] = row._rawData
       const citySlug = city.trim().replace(/\s+/g, '-').toLowerCase();

      return {
        city: citySlug,
        links: links.filter((link) => BLOG_LINK_REGEX.exec(link)),
      }
    })
    .filter((row) => row.links.length)
}

function scrapeBlogTitle($) {
  const titleEl = $('.ag-article-title h1')
  return titleEl
    .html()
    .replace(/(<([^>]+)>)/gi, '')
    .trim()
}

function scrapeBlogHero($) {
  const heroStyle = $('.ag-featured-article-image').attr('style')
  const bgStyle = styleParse(heroStyle).background

  return (bgUrl = /url\((.*)\)/.exec(bgStyle).slice(1).shift())
}

function fetchBlogEntryContent(target) {
  return axios
    .get(target)
    .then(({ data }) => {
      const $ = cheerio.load(data)

      return Promise.all([scrapeBlogTitle($), scrapeBlogHero($)])
    })
    .catch(handleError)
}

function generateCloudinaryId(target) {
  return axios
    .get(`${options.cloudinary}/upload?url=${encodeURI(target)}`)
    .then(({ data }) => data)
    .catch(handleError)
}

function backfillImageIds(rows) {
  return Promise.all(
    rows.map(async (row) => ({
      city: row.city,
      links: await Promise.all(
        row.links.map(async (link) => {
          const cacheKey = base64(link)
          const cachedData = cache.getKey(cacheKey)

          if (cachedData && cachedData.imageId && cachedData.title) {
            return { link, ...cachedData, cached: true }
          }

          const [title, imageUrl] = await fetchBlogEntryContent(link)
          const imageId =
            (cachedData && cachedData.imageId) || (await generateCloudinaryId(imageUrl))

          cache.setKey(cacheKey, { imageUrl, imageId, title })

          return { imageId, link, title, cached: false }
        }),
      ),
    })),
  )
}

function finalProcessor(data) {
  return data.reduce((acc, { city, links }) => {
    acc[city] = links.map((link) => ({
      categoryUrl: CATEGORIES[city],
      imageId: link.imageId,
      link: link.link,
      title: link.title,
      topics: [],
    }))

    return acc
  }, {})
}

function writeFinal(data) {
  if (!options.output) {
    return data
  }

  const rawResult = `export const LOCAL_ARTICLES: ILocalArticle = ${JSON.stringify(data)}`
  	const finalResult = prettier.format(rawResult, { max_line_length: 120, singleQuote: true, parser: 'babel' })

  return new Promise((resolve, reject) => {
    fs.writeFile(options.output, finalResult, (err) => {
      if (err) {
        reject(err)
      }

      console.log('The file has been saved!')
      resolve(data)
    })
  })
}

setupAccess()
  .then(() => getSheet(0))
  .then(readPerCityLinks)
  .then(backfillImageIds)
  .then(finalProcessor)
  .then(writeFinal)
  .then((results) => {
    if (options.verbose) {
      console.log(JSON.stringify(results, undefined, 2))
    }
  })
  .then(saveCache)
  .catch(handleError)
