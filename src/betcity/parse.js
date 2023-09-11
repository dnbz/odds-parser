import playwright from "playwright";
import { processMatchData } from "./transform.js";
import {
  parseFirstHalfHandicapOdds,
  parseFirstHalfOutcomeOdds, parseFirstHalfTotalOdds,
  parseHandicapOdds,
  parseOutcomeOdds, parseSecondHalfOutcomeOdds,
  parseTotalOdds,
} from "./betparse.js";
import { enqueueLinks } from "crawlee";

const baseUrl = "https://betcity.ru";

// if the league name contains one of these - skip that league
const stopWords = ["Statisctics", "Statistics"];

export const defaultHandler = async ({ page, enqueueLinks, crawler, log }) => {
  const langSwitcher = page.locator("css=app-language-switcher");
  await langSwitcher.waitFor({ state: "visible", timeout: 3500 });

  await page.locator("css=app-language-switcher").click();
  await page.waitForTimeout(500);
  await page
    .locator("css=app-language-switcher .custom-select-popup-item:last-child")
    .click();
  await page.waitForTimeout(800);

  // close the notify popup
  await page
    .locator("css=div.push-confirm .push-confirm__button:first-of-type")
    .click();

  await page.waitForTimeout(2200);

  const leagueLinksElems = page.locator(
    "css=.champs-container__item:first-of-type a.champs__champ-name"
  );

  let leagueRequests = [];
  // less by one because last element is not visible
  const count = (await leagueLinksElems.count()) - 1;
  for (let i = 0; i < count; ++i) {
    let leagueLink = leagueLinksElems.nth(i);

    let title = await leagueLink.locator("css=span").innerText();

    for (let stopWord of stopWords) {
      if (title.includes(stopWord)) {
        // log.info("Event name contains words 'Statistics'. Skipping...");
        continue;
      }
    }

    if (title.includes("Women")) {
      // log.info("Competition is a women's league , skipping.");
      continue;
    }

    if (/U\d\d/.test(title)) {
      // log.info("Competiton is a youth league, skipping.");
      continue;
    }

    let url = await leagueLink.getAttribute("href");
    let request = {
      url: `${baseUrl}${url}`,
      label: "LEAGUE",
    };

    leagueRequests.push(request);
  }

  await crawler.addRequests(leagueRequests);
  await crawler.waitForAllRequestsToBeAdded;
};

export const parseLeague = async ({
  request,
  page,
  log,
  crawler,
  enqueueLinks,
}) => {
  const title = await page.title();

  const eventLinksElems = page.locator("css=.line-event a.line-event__name");

  await eventLinksElems.first().waitFor({ state: "visible" });

  let eventRequests = [];

  const eventCount = await eventLinksElems.count();
  for (let i = 0; i < eventCount; ++i) {
    let leagueLink = eventLinksElems.nth(i);

    let url = await leagueLink.getAttribute("href");
    let request = {
      url: `${baseUrl}${url}`,
      label: "EVENT",
    };

    eventRequests.push(request);
  }

  await crawler.addRequests(eventRequests, { forefront: true });
  await crawler.waitForAllRequestsToBeAdded;
};

export const parseEvent = async ({ crawler, page, log }) => {
  const visibilityBeacon = page.locator("css=div.dops-item");
  await visibilityBeacon.first().waitFor({ state: "visible", timeout: 8000 });

  let eventData = await parseMatchDataFromDetail(page);

  let processedData = processMatchData(eventData);

  await crawler.redis.rPush("betcity", JSON.stringify(processedData));
  log.info("Event data:", processedData);

  return eventData;
};

async function parseMatchDataFromDetail(page) {
  let date = await page.locator("css=.line-champ__date").textContent();
  let time = await page.locator("css=.line-event__time-static").textContent();

  let outcomeOdds = await parseOutcomeOdds(page);

  // wait for the odds to be visible(outcome odds are always visible)
  // const allBetsLoadedBeacon = page.locator("css=.dops-item__title");
  const allBetsLoadedBeacon = page.locator(
    `xpath=//span[contains(., 'All bets')]`
  );
  await allBetsLoadedBeacon
    .first()
    .waitFor({ state: "visible", timeout: 10000 });

  // load all the extra odds
  const totalOdds = await parseTotalOdds(page);
  const firstHalfTotalOdds = await parseFirstHalfTotalOdds(page);
  const handicapOdds = await parseHandicapOdds(page);
  const firstHalfOutcomeOdds = await parseFirstHalfOutcomeOdds(page);
  const secondHalfOutcomeOdds = await parseSecondHalfOutcomeOdds(page);
  const firstHalfHandicapOdds = await parseFirstHalfHandicapOdds(page);

  let matchData = {
    event_url: page.url(),
    datetime: date + time,
    home_team_name: await page
      .locator("css=.line-event__name-teams b:first-child")
      .textContent(),
    away_team_name: await page
      .locator("css=.line-event__name-teams b:last-child")
      .textContent(),

    outcome_odds: outcomeOdds,
    first_half_outcome_odds: firstHalfOutcomeOdds,
    second_half_outcome_odds: secondHalfOutcomeOdds,
    total_odds: totalOdds,
    first_half_total_odds: firstHalfTotalOdds,
    handicap_odds: handicapOdds,
    first_half_handicap_odds: firstHalfHandicapOdds,
  };

  return matchData;
}
