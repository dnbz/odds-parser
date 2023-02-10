import playwright from "playwright";
import { processMatchData } from "./transform.js";

export const defaultHandler = async ({ page, enqueueLinks }) => {
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

  await enqueueLinks({
    selector: ".champs-container__item:first-of-type a.champs__champ-name",
    label: "DETAIL",
  });
};

export const parseDetail = async ({ request, page, log, crawler }) => {
  const title = await page.title();
  const stopWords = ["Statisctics", "Statistics"];
  for (let stopWord of stopWords) {
    if (title.includes(stopWord)) {
      log.info("Event name contains words 'Statistics'. Skipping...");
      return;
    }
  }

  if (title.includes("Women")) {
    log.info("Competition is a women's league , skipping.");
    return;
  }

  if (/U\d\d/.test(title)) {
    log.info("Competiton is a youth league, skipping.");
    return;
  }

  console.log(`Parsing page ${title}`);
  let results = [];

  const time_delims = page.locator("css=.line__champ .line-champ__date");
  await time_delims.first().waitFor({ state: "visible", timeout: 10000 });
  let parent = await time_delims.first().locator("xpath=..");

  const count = await time_delims.count();
  // console.log(`There are ${count} dates on page`);

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

      await crawler.redis.rPush("betcity", JSON.stringify(match_data));
      // console.log(match_data)

      results.push(match_data);
    }
  }

  return results;
};

const parseMatchData = async (match, date) => {
  let event_url_path = await match
    .locator("css=a.line-event__name")
    .getAttribute("href");

  let time = await match.locator("css=.line-event__time-static").textContent();

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
        .textContent(),
    };
  } catch (error) {
    if (error instanceof playwright.errors.TimeoutError) {
      console.log(`Caught timeout on odds. No odds for this event`);
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
    ...odds,
  };

  return match_data;
};
