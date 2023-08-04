import playwright from "playwright";
import { processMatchData } from "./transform.js";
import {
  findOddsItemByName,
  parseFirstHalfOutcomeOdds,
  parseHandicapOdds,
  parseOutcomeOdds,
  parseTotalOdds,
} from "./betparse.js";

const baseUrl = "https://pinnacle.com";

export const defaultHandler = async ({ page, enqueueLinks }) => {
  await page.waitForTimeout(1200);

  await enqueueLinks({
    selector:
      "[data-test-id='Browse-Leagues'] .contentBlock:last-of-type li > div > a:first-of-type",
    label: "LEAGUE",
  });
};

export const parseLeague = async ({ request, page, log, crawler }) => {
  let title;
  try {
    title = await page
      .locator("css=[data-test-id=Browse-Header] h1")
      .textContent();
  } catch (e) {
    let url = request.url;
    log.info(
      `Couldn't find the title of the competition. It's likely that competition with URL "${url}" has no matches, skipping.`
    );
    return;
  }

  if (title.includes("Women")) {
    log.info(`Competition "${title}" is a women's league , skipping.`);
    return;
  }

  if (/U\d\d/.test(title)) {
    log.info(`Competition "${title}" is a youth league, skipping.`);
    return;
  }

  console.log(`Parsing competition "${title}"`);

  // check if there are any matches
  let noMatches = await page.locator("css=.noEvents").first().isVisible();
  if (noMatches) {
    log.info(`Competition "${title}" has no matches, skipping.`);
    return;
  }

  // switch to the matches tab because the `all` tab is sometimes messed up and requires scrolling
  const matchBtn = page.locator("xpath=//button[@id='period:0']");
  try {
    await matchBtn.click({ timeout: 10000 });
  } catch (e) {
    log.info(
      `Couldn't open the matches tab. It's likely that competition "${title}" has no matches`
    );
  }

  const time_delims = page.locator(
    "xpath=//div[@data-test-id='Events.DateBar']"
  );
  const count = await time_delims.count();
  console.log(`There are ${count} dates on page`);

  let parent = page.locator("css=.contentBlock.square");
  for (let i = 0; i < count; i++) {
    let time_delim = time_delims.nth(i);
    let date = await time_delim.textContent();

    // xpath count are 1-based
    let xpath_delim_count = i + 1;

    let matches = parent.locator(
      `xpath=./div[contains(@class, 'style_row')][descendant::div[contains(@class, 'style_metadata')]][count(preceding-sibling::div[@data-test-id='Events.DateBar'])=${xpath_delim_count}]`
    );

    const match_count = await matches.count();
    console.log(`There are ${match_count} matches on date ${date}`);

    for (let j = 0; j < match_count; j++) {
      let match = matches.nth(j);

      let url = await match.locator("css=a").first().getAttribute("href");

      let request = {
        url: `${baseUrl}${url}`,
        label: "EVENT",
      };

      await crawler.addRequests([request], { forefront: true });
      await crawler.waitForAllRequestsToBeAdded;
    }
  }

  // return results;
};

export const parseEvent = async ({ crawler, page, log }) => {
  // check if there are any matches
  let noMatches = await page.locator("css=.noEvents").first().isVisible();
  if (noMatches) {
    log.info(`Competition has no matches, skipping.`);
    return;
  }

  let visibilityBeacon = await findOddsItemByName(page, "Money Line – Match");
  visibilityBeacon = visibilityBeacon.first();
  await visibilityBeacon.waitFor({ state: "visible", timeout: 8500 });

  let eventData = await parseMatchDataFromDetail(page);
  let processedData = processMatchData(eventData);

  await crawler.redis.rPush("pinnacle", JSON.stringify(processedData));
  log.info("Event data:", processedData);

  return eventData;
};

const parseMatchDataFromDetail = async (page, date) => {
  let time = await page
    .locator("xpath=//div[contains(@class, 'style_startTime')]")
    .textContent();

  const homeTeam = page
    .locator(
      "xpath=//div[@data-test-id = 'Matchup Header']//div[contains(@class, 'style_participantName')]"
    )
    .nth(0);
  const awayTeam = page
    .locator(
      "xpath=//div[@data-test-id = 'Matchup Header']//div[contains(@class, 'style_participantName')]"
    )
    .nth(1);
  const homeTeamName = await homeTeam.textContent();
  const awayTeamName = await awayTeam.textContent();

  const outcomeOdds = await parseOutcomeOdds(page);
  const firstHalfOutcomeOdds = await parseFirstHalfOutcomeOdds(page);
  const totalOdds = await parseTotalOdds(page);
  const handicapOdds = await parseHandicapOdds(page);

  const oddsElems = page.locator(
    "xpath=.//span[contains(@class, 'style_price')]"
  );

  const teamNames = page.locator("css=.event-row-participant");

  let match_data = {
    event_url: page.url(),
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    name: `${homeTeamName} - ${awayTeamName}`,
    datetime: time,

    outcome_odds: outcomeOdds,
    first_half_outcome_odds: firstHalfOutcomeOdds,
    total_odds: totalOdds,
    handicap_odds: handicapOdds,
  };

  return match_data;
};
