import playwright from "playwright";
import { processMatchData } from "./transform.js";

export const defaultHandler = async ({ page, enqueueLinks }) => {
  await page.waitForTimeout(1200);

  await enqueueLinks({
    // this is pretty bad
    selector:
      "[data-test-id='Browse-Leagues'] .contentBlock:last-of-type li > div > a:first-of-type",
    label: "DETAIL",
  });
};

export const parseDetail = async ({ request, page, log, crawler }) => {
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

  let results = [];

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

      let match_data = await parseMatchData(match, date);
      match_data = processMatchData(match_data);
      match_data.event_list_url = request.url;

      await crawler.redis.rPush("pinnacle", JSON.stringify(match_data));

      results.push(match_data);
    }
  }

  return results;
};

const parseMatchData = async (match, date) => {
  let event_url_path = await match
    .locator("css=a")
    .first()
    .getAttribute("href");

  let time = await match
    .locator("xpath=.//div[contains(@class, 'style_matchupDate')]")
    .textContent();

  let odds = {
    home_team: null,
    away_team: null,
    draw: null,
  };

  const oddsElems = match.locator(
    "xpath=.//span[contains(@class, 'style_price')]"
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

  const teamNames = match.locator("css=.event-row-participant");
  let match_data = {
    event_url: `https://www.pinnacle.com${event_url_path}`,
    datetime: date + ' ' + time,
    home_team_name: await teamNames.nth(0).textContent(),
    away_team_name: await teamNames.nth(1).textContent(),
    ...odds,
  };

  return match_data;
};
