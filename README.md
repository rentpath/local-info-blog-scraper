# local info blog scraper

This script will take a specific google spreadsheet and generate the configuration 
file needed by ag.js to display blog articles in the local info pop-up of SRP pages

# Setup

The developer running this will need to have a google developer console account
and correctly setup a `Service account`. The `google-spreadsheet` module has
[an entire runthrough in their docs](https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication).

The end result is a JSON file that you will point to with the `-c | --credentials` command

A very important step is that you will have to invite the lengthy google services account email address to
the spreadsheet. If you don't do this step, you will get an authentication error.

The services account used to run the script: e.g. `ag-5698@vernal-period-307117.iam.gserviceaccount.com`
will be required to have read/write access to the document


# Google Sheet ID

This is the long alphanumeric identifier from the URL of the spreadsheet doc

# Output

The output file from this script is a javascript file meant to be used replace the 
`LOCAL_ARTICLES` export from `src/config/blog.ts` in the `ag.js` project.

# Image Cache

There is a file `image-cache` in this repository. DO NOT DELETE. This file contains Cloudinary
id's based on base64 encodings of the image URLs. This will ensure that we don't generate unessesary images
and allows us to run this script at will multiple times.

# Command Help
```
node version: 14.16.0

yarn install
node process-sheet.js -s GoogleSheetId -c ./credentials.json
```
Note: 
- Replace `GoogleSheetId` with the long alphanumeric identifier from url of spreadsheet doc. 
- `./credentials.json` will be the json file received by correctly setting up the service account from google developer console account.
```
./process-sheet.js -h
```

# Usage

```
Options:
  -c, --credentials <file>  JSON Credentials File from Google
  -s, --sheet <id>          Google spreadsheet ID number
  -o, --output <file.js>    Javascript file Results Output (default: "./output.js")
  -v, --verbose             Print output to screen
  --cloudinary <url>        Rentpath API to generate cloudinary imageId (default:
                            "http://storeimage.vip.useast2.rentpath.com")
  -h, --help                display help for command

```
