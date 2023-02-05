import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "./redis.js";
import playwright from "playwright";
import { proxyConfiguration } from "./proxies.js";

log.setLevel(log.LEVELS.INFO);

let redis = await getRedisClient();
await redis.connect();

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ request, page, enqueueLinks, log }) => {
  await page.waitForLoadState("networkidle", { timeout: 50000 });
  log.info("Page loaded.");

  const langSwitcher = page.locator("css=.js-header-languages");
  await langSwitcher.locator("css=.header__link").click();
  await langSwitcher.getByText("English").click();
  await page.waitForTimeout(1000);
  // await page.zoom(0.1)

  // set large viewport height because the page is lazy loaded
  await page.setViewportSize({
    width: 1280,
    height: 3500,
  });
  await page.waitForTimeout(8000);

  await parseCompetitions(page);

  await page.waitForTimeout(15000);
  // await enqueueLinks({
  //   selector: ".champs-container__item:first-of-type a.champs__champ-name",
  //   label: "DETAIL",
  // });
});

router.addHandler("DETAIL", async ({ request, page, log }) => {
  const title = await page.title();
  const stopWords = ["Statisctics", "Statistics"];
  for (let stopWord of stopWords) {
    if (title.includes(stopWord)) {
      console.log("Event name contains words 'Statistics'. Skipping...");
      return;
    }
  }

  console.log(`Parsing page ${title}`);
  let results = [];

  const time_delims = page.locator("css=.line__champ .line-champ__date");
  await time_delims.first().waitFor({ state: "visible", timeout: 10000 });

  const count = await time_delims.count();
  // console.log(`There are ${count} dates on page`);
  const parent = page.locator(
    "xpath=//div[contains(@class, 'sport-section-virtual-list--')]"
  );

  for (let i = 0; i < count; i++) {
    let time_delim = time_delims.nth(i);
    let date = await time_delim.innerText();

    // xpath count are 1-based
    let xpath_delim_count = i + 1;

    let matches = parent.locator(
      `xpath=./app-line-event-unit[count(preceding-sibling::div[@class='line-champ__date'])=${xpath_delim_count}]`
    );

    const match_count = await matches.count();
    // console.log(`There are ${match_count} matches on date ${date}`);

    for (let j = 0; j < match_count; j++) {
      let match = matches.nth(j);

      let match_data = await parseMatchData(match, date);
      match_data = processMatchData(match_data);
      match_data.event_list_url = request.url;

      await redis.rPush("fonbet", JSON.stringify(match_data));
      // console.log(match_data)

      results.push(match_data);
    }
  }

  return results;
});

const parseCompetitions = async (page) => {
  const parent = page.locator(
    "xpath=//div[contains(@class, 'sport-section-virtual-list--')]"
  );

  // initialize the variables
  let competitions = parent.locator(
    "xpath=.//*[contains(@class, 'sport-competition--')]"
  );
  let competition = competitions.nth(0);
  let competitionName = await competition
    .locator("xpath=./*[contains(@class, 'table-component-text--')][1]")
    .textContent({ timeout: 5000 });
  let nextCompetition = competitions.nth(1);

  // since the page is lazy loaded we always scroll to the next competition and parse it
  // instead of trying to parse all competitions at once
  while (true) {
    // parse events for this competition
    let events = parent.locator(
      `xpath=./div[contains(@class, 'sport-base-event--')][count(preceding-sibling::div[contains(@class, 'sport-competition--')])=1]`
    );
    const event_count = await events.count();
    console.log(`There are ${event_count} events in ${competitionName}`);
    if (competitionName.toLowerCase().startsWith("wom.")) {
      log.info("Competition is a women's league , skipping.");
    } else if (/U\d\d/.test(competitionName)) {
      log.info("Competition is a youth league , skipping.");
    } else {
      await parseEvents(events);
    }

    try {
      // iterate to the next competition if it exists
      competitionName = await nextCompetition
        .locator("xpath=./*[contains(@class, 'table-component-text--')][1]")
        .textContent({ timeout: 5000 });
      competition = nextCompetition;
      await competition.evaluate((node) => node.scrollIntoView(), {
        timeout: 5000,
      });

      competitions = parent.locator(
        "xpath=.//*[contains(@class, 'sport-competition--')]"
      );
      nextCompetition = competitions.nth(1);

      await page.waitForTimeout(100);
    } catch (error) {
      break;
    }
  }
};

const parseEvents = async (events) => {
  const event_count = await events.count();
  for (let j = 0; j < event_count; j++) {
    let event = events.nth(j);
    // exclude events without names(usually not matches)
    try {
      const eventNameElem = event.locator(
        "xpath=.//a[contains(@class, 'sport-event__name--')]"
      );
      await eventNameElem.waitFor({ state: "visible", timeout: 200 });
    } catch (error) {
      log.info("Event name not visible, skipping.");
      continue;
    }

    let matchData = await parseMatchData(event);
    matchData = processMatchData(matchData);
    log.info("Match data: ", matchData);
    await redis.rPush("fonbet", JSON.stringify(matchData));
  }
};

const parseMatchData = async (match) => {
  const matchNameElem = match.locator(
    "xpath=.//a[contains(@class, 'sport-event__name--')]"
  );

  const event_url_path = await matchNameElem.getAttribute("href");
  const matchName = await matchNameElem.textContent();
  const teams = matchName.split(" — ");

  const date = await match
    .locator(
      "xpath=.//span[contains(@class, 'event-block-planned-time__time-')]"
    )
    .textContent();

  let odds = {
    home_team: null,
    away_team: null,
    draw: null,
  };

  const oddsElems = match.locator(
    "xpath=.//div[contains(@class, 'table-component-factor-value_single--')]"
  );
  try {
    odds = {
      home_team: await oddsElems.nth(0).textContent(),
      draw: await oddsElems.nth(1).textContent(),
      away_team: await oddsElems.nth(2).textContent(),
    };
  } catch (error) {
    if (error instanceof playwright.errors.TimeoutError) {
      console.log(`Caught timeout on odds. No odds for this event`);
    }
  }

  let match_data = {
    event_url: `https://fon.bet${event_url_path}`,
    home_team_name: teams[0],
    away_team_name: teams[1],
    name: matchName,
    datetime: date,
    ...odds,
  };

  return match_data;
};

const processMatchData = (match, date) => {
  const mapping = {
    away_team_name: (s) => {
      return s.trim();
    },
    home_team_name: (s) => {
      return s.trim();
    },
    datetime: (s) => {
      return s.trim();
    },
    away_team: (s) => {
      return Number(s);
    },
    draw: (s) => {
      return Number(s);
    },
    home_team: (s) => {
      return Number(s);
    },
  };

  for (const [key, value] of Object.entries(match)) {
    if (key in mapping) {
      let func = mapping[key];
      match[key] = func(value);
    }
  }

  return match;
};

const crawler = new PlaywrightCrawler({
  requestHandler: router,
  launchContext: { launchOptions: { timezoneId: "Europe/London" } },
  proxyConfiguration: proxyConfiguration,
  browserPoolOptions: {
    useFingerprints: false,
  }, // Uncomment this option to see the browser window.
  maxConcurrency: 3,
  requestHandlerTimeoutSecs: 360,
  maxRequestsPerMinute: 120,
});

const urls = ["https://www.fon.bet/sports/football/?mode=1"];
await crawler.run(urls);
await redis.disconnect();
