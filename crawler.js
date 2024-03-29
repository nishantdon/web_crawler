const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
function resetResultsFile() {
    if(fs.existsSync()) {
        fs.unlinkSync('./results.json');

    } 
    fs.writeFileSync('results.json', JSON.stringify({results:[]}));
}
resetResultsFile();
const crawlUrl = process.argv[2]
const depth = process.argv[3]


function crawlWebApp(urls, currentDepth, finalDepth) {
    if(currentDepth == finalDepth) {
        return 
    }
    currentDepth++
    const apiCalls = promisifyUrls(urls)
    Promise.allSettled(apiCalls).then((reponses) => {
        // Get all Images for all the promies and write those into file with depth
        // get next set of Urls 
        // again make call to this function with reduced depth
        let imagesAndUrls = getImagesAndUrls(reponses)
        imagesAndUrls = imagesAndUrls.filter((res) => res !== undefined)
        if(imagesAndUrls.length > 0) {
            const rawImageObjects = imagesAndUrls.map((imagesAndUrl) => imagesAndUrl[0])
            const images = formatResultObject(rawImageObjects, currentDepth);
            readAndWriteFiles(images).then((fileResponse) => {
                crawlWebApp(urls, currentDepth, finalDepth);
            });
        }       
    })
}

function formatResultObject(rawImageObjects,depth) {
    return rawImageObjects.flat().map((images) => ({...images, depth}))
}
function readAndWriteFiles(images) {
   if(fs.existsSync('results.json')) {
       return fs.promises.readFile('results.json',{ encoding: 'utf8' }).then((response) => {
            const res = JSON.parse(response);
            const newRes = {results: [...res.results, ...images]};
            return newRes
        }).then((response) => {
            return fs.promises.writeFile('results.json',JSON.stringify(response));
        })
   }
}
function promisifyUrls(urls) {
    return urls.map((url) => {
        return axios.get(url)
    })
}


function getImagesAndUrls(responses) {
    return responses.map((response) => {
        if (response.value && response.value.status === 200) {
            const $ = cheerio.load(response.value.data);
            const images = getImageByScrapping($, response.value.config.url);
            const urls = getUrlsForFurtherScrapping($,response.value.config.url);
            return [images.map((image) => ({imageUrl: image, sourceUrl: response.value.config.url})) ,urls]
        }
    })
}

// TODO Write common function for this
function getUrlsForFurtherScrapping($, baseUrl) {
    const herfs = new Set();
    $('a').map((i, el) => {
        // TODO handle relative links as well and repeated links as well
        if(el.attribs.href.startsWith('https://')) {
            herfs.add(el.attribs.href);
        } else {
            herfs.add(`${baseUrl}${el.attribs.href}`)
        }
    });
    return [...herfs];
}
function getImageByScrapping($) {
    const images = new Set();
     $('img').map((i, el) => {
        images.add(el.attribs.src);
    })
    return Array.from(images);
}


crawlWebApp([crawlUrl],-1,depth);
