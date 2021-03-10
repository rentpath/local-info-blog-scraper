#!/usr/bin/env node

const fs = require('fs')

const axios = require('axios')
const cheerio = require('cheerio')
const flatCache = require('flat-cache')
const styleParse = require('style-to-js').default
const { Command } = require('commander')
const { GoogleSpreadsheet } = require('google-spreadsheet')

const CATEGORIES = require('./categories.json')

const program = new Command()

program
  .description('Generate local info blog links for AG from google spreadsheet data')
  .requiredOption('-c, --credentials <file>', 'JSON Credentials File from Google')
  .requiredOption('-s, --sheet <id>', 'Google spreadsheet ID number')
  .option('-o, --output <file>', 'JSON Results Output')
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

function handleError(error) {
  cache.save()

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

async function processRawRows(sheet) {
  const rows = await sheet.getRows({ offset: 1 }) // skip first row

  return rows
    .map((row) => {
      const [city, title1, link1, title2, link2, title3, link3] = row._rawData

      const links = []

      if (title1 !== 'N/A' && link1 !== 'N/A') {
        links.push({ title: title1, link: link1 })
      }

      if (title2 !== 'N/A' && link2 !== 'N/A') {
        links.push({ title: title2, link: link2 })
      }

      if (title3 !== 'N/A' && link3 !== 'N/A') {
        links.push({ title: title3, link: link3 })
      }

      return { city: city.replace(/-/g, ' '), links }
    })
    .filter((row) => row.links.length)
}

function scrapeBlogHeaderImage(target) {
  return axios
    .get(target)
    .then(({ data }) => {
      const $ = cheerio.load(data)
      const imgEl = $('.ag-featured-article-image').attr('style')
      const bgStyle = styleParse(imgEl).background
      const bgUrl = /url\((.*)\)/
        .exec(bgStyle)
        .slice(1)
        .shift()

      return bgUrl
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
          const cacheKey = base64(link.link)
          const cachedData = cache.getKey(cacheKey)

          if (cachedData) {
            return { ...link, ...cachedData, cached: true }
          }

          const imageUrl = await scrapeBlogHeaderImage(link.link)
          const imageId = await generateCloudinaryId(imageUrl)

          cache.setKey(cacheKey, { imageUrl, imageId })

          return {
            ...link,
            imageUrl,
            imageId,
            cached: false,
          }
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

  return new Promise((resolve, reject) => {
    fs.writeFile(options.output, JSON.stringify(data, undefined, 2), (err) => {
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
  .then(processRawRows)
  .then(backfillImageIds)
  .then(finalProcessor)
  .then(writeFinal)
  .then((results) => {
    console.log(JSON.stringify(results, undefined, 2))
  })
  .then(() => cache.save())
  .catch(handleError)
