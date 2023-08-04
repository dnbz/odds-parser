import playwright from "playwright";
import { processMatchData } from "./transform.js";
import { log } from "crawlee";
import {
  parseOutcomeOdds,
  parseTotalOdds,
  findOddsItemByName,
  parseHandicapOdds,
  parseFirstHalfOutcomeOdds,
} from "./betparse.js";

const baseUrl = "https://marathonbet.com";

export const defaultHandler = async ({
  request,
  page,
  enqueueLinks,
  log,
  crawler,
}) => {
  await page.waitForLoadState("networkidle", { timeout: 50000 });
  log.info("Page loaded.");

  // set large viewport height because the page is lazy loaded
  await page.setViewportSize({
    width: 1280,
    height: 9000,
  });

  await parseCompetitions(page, crawler.redis, crawler);
};

const parseCompetitions = async (page, redis, crawler) => {
  let competitions, competitionCount;
  let currentCompetition = 0;
  while (true) {
    await page.waitForTimeout(3000);

    competitions = page.locator("xpath=//div[@class='category-container']");

    competitionCount = await competitions.count();

    console.log(`There are ${competitionCount} competitions visible on page`);

    if (currentCompetition >= competitionCount) {
      break;
    }

    let lastCompetition = competitions.nth(competitionCount - 1);
    await lastCompetition.evaluate((node) => node.scrollIntoView(), {
      timeout: 5000,
    });
    await page.waitForTimeout(100);

    for (; currentCompetition < competitionCount; currentCompetition++) {
      let i = currentCompetition;

      let competition = competitions.nth(i);
      let competitionName = await competition
        .locator("xpath=.//h2[contains(@class, 'category-label')]")
        .textContent();

      if (competitionName.toLowerCase().startsWith("women.")) {
        log.info("Competition is a women's league , skipping.");
        continue;
      } else if (competitionName.toLowerCase().startsWith("outright.")) {
        log.info("Competition is an outright bet, skipping.");
        continue;
      }

      // parse events for this competition
      let events = competition.locator(
        "xpath=.//div[contains(@class, 'foot-market')]/div[contains(@class, 'coupon-row')]"
      );
      const event_count = await events.count();
      console.log(`There are ${event_count} events in ${competitionName}`);

      for (let j = 0; j < event_count; j++) {
        let event = events.nth(j);

        let url = await event
          .locator("css=.member-link")
          .first()
          .getAttribute("href");

        let request = {
          url: `${baseUrl}${url}`,
          label: "EVENT",
        };

        await crawler.addRequests([request]);
        await crawler.waitForAllRequestsToBeAdded;
      }
    }
  }
};

export const parseEvent = async ({ crawler, page, log }) => {
  // const visibilityBeacon = page.locator("css=.selection-link");
  let visibilityBeacon = await findOddsItemByName(page, "  Result ");
  visibilityBeacon = visibilityBeacon.first();

  await visibilityBeacon.waitFor({ state: "visible", timeout: 8000 });

  let eventData = await parseMatchDataFromDetail(page);

  let processedData = processMatchData(eventData);

  await crawler.redis.rPush("marathon", JSON.stringify(processedData));
  log.info("Event data:", processedData);

  return eventData;
};

const parseMatchDataFromDetail = async (page) => {
  const matchInfo = page.locator(
    "xpath=//table[contains(@class, 'member-area-content-table')]"
  );

  const homeTeam = matchInfo.locator("xpath=.//a[@class='member-link']").nth(0);
  const awayTeam = matchInfo.locator("xpath=.//a[@class='member-link']").nth(1);

  const date = await matchInfo
    .locator("xpath=.//td[contains(@class, 'date')]")
    .textContent();

  const outcomeOdds = await parseOutcomeOdds(page);
  const totalOdds = await parseTotalOdds(page);
  const handicapOdds = await parseHandicapOdds(page);
  const firstHalfOutcomeOdds = await parseFirstHalfOutcomeOdds(page);

  let homeTeamName = await homeTeam.textContent();
  let awayTeamName = await awayTeam.textContent();
  let matchData = {
    event_url: page.url(),
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    datetime: date,

    outcome_odds: outcomeOdds,
    first_half_outcome_odds: firstHalfOutcomeOdds,
    total_odds: totalOdds,
    handicap_odds: handicapOdds,
  };

  return matchData;
};
