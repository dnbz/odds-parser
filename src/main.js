// For more information, see https://crawlee.dev/
import {
    PlaywrightCrawler,
    Dataset,
    createPlaywrightRouter,
    log,
    ProxyConfiguration,
    LogLevel,
    RequestQueue
} from 'crawlee';
import {getRedisClient} from "./redis.js";
import * as fs from "fs";
import playwright from "playwright";

log.setLevel(log.LEVELS.INFO)

const router = createPlaywrightRouter()
let redis = await getRedisClient()
await redis.connect()

router.addDefaultHandler(async ({request, page, enqueueLinks, log}) => {
    const langSwitcher = page.locator("css=app-language-switcher")
    await langSwitcher.waitFor({state: "visible", timeout: 3500})

    await page.locator("css=app-language-switcher").click();
    await page.waitForTimeout(500);
    await page
        .locator("css=app-language-switcher .custom-select-popup-item:last-child")
        .click();
    await page.waitForTimeout(800);

    // close the notify popup
    await page.locator("css=div.push-confirm .push-confirm__button:first-of-type").click()


    // const eventLineLocator = page.locator("css=.champs-container__item:first-of-type .champs__sport a.champs__champ-name")
    // const count = await eventLineLocator.count();
    //
    // const queue = await RequestQueue.open();
    // const baseUrl = await page.evaluate(() => document.location.origin)
    //
    // for (let i = 0; i < count; i++) {
    //     let eventLine = eventLineLocator.nth(i)
    //     let eventLineText = await eventLine.innerText()
    //
    //     if (eventLineText.includes("Statistics")) {
    //         // console.log("Event name contains words 'Statistics'. Skipping...")
    //         continue
    //     }
    //
    //     let url = await eventLine.getAttribute('href')
    //     await queue.addRequest({url: baseUrl + url, label: "DETAIL"})
    // }

    await enqueueLinks({
        selector: ".champs-container__item:first-of-type a.champs__champ-name", label: "DETAIL"
    });
})

const parseMatchData = async (match, date) => {
    let event_url_path = await match
        .locator("css=a.line-event__name")
        .getAttribute("href");

    let time = await match.locator("css=.line-event__time-static").textContent()

    let odds = {
        home_team: null,
        away_team: null,
        draw: null,
    };

    try {
        odds = {
            home_team: await match
                .locator("css=.line-event__main-bets button:nth-child(1)")
                .textContent(),
            draw: await match
                .locator("css=.line-event__main-bets button:nth-child(2)")
                .textContent(),
            away_team: await match
                .locator("css=.line-event__main-bets button:nth-child(3)")
                .textContent()
        }
    } catch (error) {
        if (error instanceof playwright.errors.TimeoutError) {
            console.log(`Caught timeout on odds. No odds for this event`)
        }
    }

    let match_data = {
        event_url: `https://betcity.ru${event_url_path}`,
        datetime: date + time,
        home_team_name: await match
            .locator("css=.line-event__name-teams b:first-child")
            .textContent(),
        away_team_name: await match
            .locator("css=.line-event__name-teams b:last-child")
            .textContent(),
        ...odds
    };

    return match_data
}

const processMatchData = (match, date) => {
    const mapping = {
        away_team_name: (s) => {
            return s.trim()
        },
        home_team_name: (s) => {
            return s.trim()
        },
        datetime: (s) => {
            return s.trim()
        },
        away_team: (s) => {
            return Number(s)
        },
        draw: (s) => {
            return Number(s)
        },
        home_team: (s) => {
            return Number(s)
        },
    }

    for (const [key, value] of Object.entries(match)) {
        if (key in mapping) {
            let func = mapping[key]
            match[key] = func(value)
        }
    }

    return match
}

router.addHandler("DETAIL", async ({request, page, log}) => {
    const title = await page.title()
    const stopWords = ["Statisctics", "Statistics"]
    for (let stopWord of stopWords) {
        if (title.includes(stopWord)) {
            console.log("Event name contains words 'Statistics'. Skipping...")
            return
        }
    }

    console.log(`Parsing page ${title}`)
    let results = [];

    const time_delims = page.locator("css=.line__champ .line-champ__date")
    await time_delims.first().waitFor({state: "visible", timeout: 10000});
    let parent = await time_delims.first().locator("xpath=..")

    const count = await time_delims.count();
    // console.log(`There are ${count} dates on page`);

    for (let i = 0; i < count; i++) {
        let time_delim = time_delims.nth(i)
        let date = await time_delim.innerText()

        // xpath count are 1-based
        let xpath_delim_count = i + 1

        let matches = parent.locator(`xpath=./app-line-event-unit[count(preceding-sibling::div[@class='line-champ__date'])=${xpath_delim_count}]`)

        const match_count = await matches.count();
        // console.log(`There are ${match_count} matches on date ${date}`);

        for (let j = 0; j < match_count; j++) {

            let match = matches.nth(j);

            let match_data = await parseMatchData(match, date)
            match_data = processMatchData(match_data)
            match_data.event_list_url = request.url

            await redis.rPush('betcity', JSON.stringify(match_data))
            // console.log(match_data)

            results.push(match_data)
        }
    }

    return results
})


const getProxyList = () => {
    let data;
    try {
        data = fs.readFileSync('./proxies.txt', 'utf8')
        console.log(data)
    } catch (err) {
        console.error(err)
        return
    }

    let proxies = data.trim().split('\n')

    return proxies
}

const proxyConfiguration = new ProxyConfiguration({
    proxyUrls: getProxyList()
});

// let headless = process.env.APP_ENV === 'prod';

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
    requestHandler: router,
    proxyConfiguration: proxyConfiguration,
    browserPoolOptions: {
        useFingerprints: false,
    }, // Uncomment this option to see the browser window.
    maxConcurrency: 3,
    maxRequestsPerMinute: 120
})

const urls = ["https://betcity.ru/ru/line/soccer"];
await crawler.run(urls);
await redis.disconnect()
