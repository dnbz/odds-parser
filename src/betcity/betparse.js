import { log } from "crawlee";

async function findOddsItemByName(page, name) {
  let selector = `xpath=//div[@class='dops-item' and .//span[.='${name}']]`;

  return page.locator(selector);
}

export async function parseTotalOdds(page) {
  let totalItem = await findOddsItemByName(page, "Total");
  totalItem = totalItem.first();

  // TODO: move this check to a different place
  try {
    await totalItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    // TODO: adjust the interval with proxies
    await page.waitForTimeout(5000);
    await page.reload();
    try {
      await totalItem.waitFor({ state: "visible", timeout: 8000 });
    } catch (e) {
      log.info("Total odds not found");
      return [];
    }
  }

  const totalBets = totalItem.locator("css=.dops-item-row__section");

  let totalOdds = [];

  const count = await totalBets.count();
  for (let i = 0; i < count; ++i) {
    let bet = totalBets.nth(i);
    let total = await bet
      .locator(
        "css=.dops-item-row__block:nth-child(1) .dops-item-row__block-content"
      )
      .textContent();

    let underTotal, overTotal;

    try {
      underTotal = await bet
        .locator("css=.dops-item-row__block:nth-child(2) button")
        .textContent({ timeout: 100 });
    } catch (e) {}

    try {
      overTotal = await bet
        .locator("css=.dops-item-row__block:nth-child(3) button")
        .textContent({ timeout: 100 });
    } catch (e) {}

    let data = {
      total: total,
      total_under: underTotal,
      total_over: overTotal,
    };

    totalOdds.push(data);
  }

  return totalOdds;
}

export async function parseHandicapOdds(page) {
  let betItem = await findOddsItemByName(page, "Handicap");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Handicap odds not found");
    return [];
  }

  const bets = betItem.locator(
    "xpath=.//div[contains(@class, 'dops-item-row__section')]//div[contains(@class, 'dops-item-row__block-content')]"
  );

  let data = [];
  const count = await bets.count();
  for (let i = 0; i < count; ++i) {
    let bet = bets.nth(i);
    let handicapString = await bet
      .locator("xpath=.//*[@class='dops-item-row__block-left']")
      .textContent();

    let value = await bet
      .locator("xpath=.//*[@class='dops-item-row__block-right']")
      .textContent();

    // parse inside the () to get the handicap value
    let handicap = handicapString.match(/\(([^)]+)\)/)[1];

    let type;
    if (handicapString.includes("Han1"))
      type = "home"
    else if (handicapString.includes("Han2"))
      type = "away"

    data.push({
      handicap: handicap,
      coef: value,
      type: type,
    });
  }

  return data;
}

export async function parseOutcomeOdds(page) {
  let outcomeItem = page.locator("css=.line-event__main-bets");

  let data = {
    home_team: await outcomeItem
      .locator("css=button:nth-of-type(1)")
      .textContent(),
    draw: await outcomeItem.locator("css=button:nth-of-type(2)").textContent(),
    away_team: await outcomeItem
      .locator("css=button:nth-of-type(3)")
      .textContent(),
  };

  return data;
}

export async function parseFirstHalfOutcomeOdds(page) {
  let betItem = await findOddsItemByName(page, "Halves result");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("First half outcome odds not found");
    return [];
  }

  // first half outcome item
  const outcomeItem = betItem.locator(
    "xpath=./div[contains(@class, 'dops-item-row')][1]//div[@class='dops-item-row__section'][1]"
  );

  let data = {
    home_team: await outcomeItem
      .locator("css=.dops-item-row__block:nth-of-type(1) button")
      .textContent(),
    draw: await outcomeItem
      .locator("css=.dops-item-row__block:nth-of-type(2) button")
      .textContent(),
    away_team: await outcomeItem
      .locator("css=.dops-item-row__block:nth-of-type(3) button")
      .textContent(),
  };

  return data;
}
