# local info blog scraper

This script will take a specific google spreadsheet and generate the configuration 
file needed by ag.js to display blog articles in the local info pop-up of SRP pages

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
