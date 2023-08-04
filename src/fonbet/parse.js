import playwright from "playwright";
import { processMatchData } from "./transform.js";
import {
  findOddsItemByName,
  parseFirstHalfOutcomeOdds,
  parseHandicapOdds,
  parseOutcomeOdds,
  parseTotalOdds,
} from "./betparse.js";
import { log } from "crawlee";

const baseUrl = "https://fon.bet";

export const defaultHandler = async ({
  request,
  page,
  enqueueLinks,
  log,
  crawler,
}) => {
  await page.waitForLoadState("networkidle", { timeout: 50000 });
  log.info("Page loaded.");

  await switchLang(page, 10000);
  await page.waitForTimeout(1000);
  // await page.zoom(0.1)

  // set large viewport height because the page is lazy loaded
  await page.setViewportSize({
    width: 1280,
    height: 3500,
  });
  await page.waitForTimeout(8000);

  await parseCompetitions(page, crawler.redis, crawler);

  await page.waitForTimeout(15000);
};

const switchLang = async (page, timeout) => {
  const langSwitcher = page.locator("css=.js-header-languages");
  await langSwitcher.locator("css=.header__link").click({ timeout: timeout });
  await langSwitcher.getByText("English").click({ timeout: timeout });
};

const parseCompetitions = async (page, redis, crawler) => {
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
        let url = await event.locator("css=a").first().getAttribute("href");

        let request = {
          url: `${baseUrl}${url}`,
          label: "EVENT",
        };

        await crawler.addRequests([request], { forefront: false });
        await crawler.waitForAllRequestsToBeAdded;
      }
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

export const parseEvent = async ({ crawler, page, log }) => {
  let visibilityBeacon = await findOddsItemByName(page, "Result");
  visibilityBeacon = visibilityBeacon.first();

  try {
    await visibilityBeacon.waitFor({ state: "visible", timeout: 8000 });
  } catch (error) {
    // if the beacon is not visible,
    // switch language and wait for it to appear
    // since language after timeout failure when the new browser window is opened
    await switchLang(page, 7000);
    // bigger timeout to throttle
    await page.waitForTimeout(3000);
    await visibilityBeacon.waitFor({ state: "visible", timeout: 8000 });
  }

  let eventData = await parseMatchDataFromDetail(page);

  let processedData = processMatchData(eventData);

  await crawler.redis.rPush("fonbet", JSON.stringify(processedData));
  log.info("Event data:", processedData);

  return eventData;
};

const parseMatchDataFromDetail = async (page) => {
  let date = await page
    .locator("xpath=//*[contains(@class, 'ev-line-time__day')]")
    .textContent();
  let time = await page
    .locator("xpath=//*[contains(@class, 'ev-line-time__time')]")
    .textContent();

  const homeTeam = page
    .locator("xpath=//div[contains(@class, 'ev-team-')]//span")
    .nth(0);
  const awayTeam = page
    .locator("xpath=//div[contains(@class, 'ev-team-')]//span")
    .nth(1);
  const homeTeamName = await homeTeam.textContent();
  const awayTeamName = await awayTeam.textContent();

  const outcomeOdds = await parseOutcomeOdds(page);
  const totalOdds = await parseTotalOdds(page);
  const handicapOdds = await parseHandicapOdds(page);

  await switchTab(page, "1st half");
  const firstHalfOutcomeOdds = await parseFirstHalfOutcomeOdds(page);

  let match_data = {
    event_url: page.url(),
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    name: `${homeTeamName} - ${awayTeamName}`,
    datetime: date + " " + time,

    outcome_odds: outcomeOdds,
    first_half_outcome_odds: firstHalfOutcomeOdds,
    total_odds: totalOdds,
    handicap_odds: handicapOdds,
  };

  return match_data;
};

const switchTab = async (page, tabName) => {
  const firstHalfTab = await page.locator(
    `xpath=//div[contains(text(), '${tabName}') and contains(@class, 'tab')]`
  );

  try {
    await firstHalfTab.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info(`Tab ${tabName} not visible, skipping.`);
    return;
  }

  await firstHalfTab.click();
};
