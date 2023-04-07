import playwright from "playwright";
import { processMatchData } from "./transform.js";
import { log } from "crawlee";

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

  await parseCompetitions(page, crawler.redis);
};

const parseCompetitions = async (page, redis) => {
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

      await parseEvents(events, redis);
    }
  }
};

const parseEvents = async (events, redis) => {
  const event_count = await events.count();
  for (let j = 0; j < event_count; j++) {
    let event = events.nth(j);

    let matchData = await parseMatchData(event);
    matchData = processMatchData(matchData);
    log.info("Match data: ", matchData);
    await redis.rPush("marathon", JSON.stringify(matchData));
  }
};

const parseMatchData = async (match) => {
  const matchNameElem = match.locator(
    "xpath=.//a[contains(@class, 'sport-event__name--')]"
  );

  const matchInfo = match.locator(
      // xpath table that contains class member-area-content-table
      "xpath=.//table[contains(@class, 'member-area-content-table')]"
    // "xpath=.//table[@class='member-area-content-table']"
  );

  const homeTeam = matchInfo.locator("xpath=.//a[@class='member-link']").nth(0);
  const awayTeam = matchInfo.locator("xpath=.//a[@class='member-link']").nth(1);

  const event_url_path = await homeTeam.getAttribute("href");

  const date = await matchInfo
    .locator("xpath=.//td[contains(@class, 'date')]")
    .textContent();

  let odds = {
    home_team: null,
    away_team: null,
    draw: null,
  };

  const oddsElems = match.locator("xpath=.//td[contains(@class, 'price')]");
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

  let homeTeamName = await homeTeam.textContent()
  let awayTeamName = await awayTeam.textContent()
  let match_data = {
    event_url: `https://marathonbet.com${event_url_path}`,
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    name: `${homeTeamName} - ${awayTeamName}`,
    datetime: date,
    ...odds,
  };

  return match_data;
};
