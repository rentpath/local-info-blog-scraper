# local info blog scraper

This script will take a specific google spreadsheet and generate the configuration 
file needed by ag.js to display blog articles in the local info pop-up of SRP pages

# Image Cache

There is a file `image-cache` in this repository. DO NOT DELETE. This file contains Cloudinary
id's based on base64 encodings of the image URLs. This will ensure that we don't generate unessesary images
and allows us to run this script at will multiple times.

# Help

```
./process-sheet.js -h
```

# Usage

```
Options:
  -c, --credentials <file>  JSON Credentials File from Google
  -s, --sheet <id>          Google spreadsheet ID number
  -o, --output <file>       JSON Results Output
  --cloudinary <url>        Rentpath API to generate cloudinary imageId (default:
                            "http://storeimage.vip.useast2.rentpath.com")
  -h, --help                display help for command
```
