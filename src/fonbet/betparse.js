import { log } from "crawlee";
import playwright from "playwright";

export async function findOddsItemByName(page, name) {
  let selector = `xpath=//div[contains(@class, 'market-group-box') and .//div[contains(text(), '${name}')]]`;

  return page.locator(selector);
}

export async function parseTotalOdds(page) {
  let totalItem = await findOddsItemByName(page, "Total goals");
  totalItem = totalItem.first();

  try {
    await totalItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseTotalsData(totalItem);
}

export async function parseFirstHalfTotalOdds(page) {
  let totalItem = await findOddsItemByName(page, "Total goals in 1st half");
  totalItem = totalItem.first();

  try {
    await totalItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseTotalsData(totalItem);
}

export async function parseTotalsData(totalItem) {
  let totalOdds = [];

  const rows = totalItem.locator(
    "xpath=.//div[contains(@class, 'row-common')]"
  );

  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    let row = rows.nth(i);
    let totalBets = row.locator(
      `xpath=.//div[contains(@class, 'cell-wrap') and not(contains(@class, 'separator'))]`
    );

    let totalLeft = await totalBets.nth(0).textContent({ timeout: 500 });
    // get only the number, excluding extra text
    totalLeft = totalLeft.replace(/[^0-9.]/g, "");

    let totalLeftOverValue = await totalBets
      .nth(1)
      .textContent({ timeout: 500 });
    let totalLeftUnderValue = await totalBets
      .nth(2)
      .textContent({ timeout: 500 });

    // if total is empty - skip it
    if (totalLeft) {
      totalOdds.push({
        total: totalLeft,
        total_over: totalLeftOverValue,
        total_under: totalLeftUnderValue,
      });
    }

    let totalRight = await totalBets.nth(3).textContent({ timeout: 500 });
    // get only the number, excluding extra text
    totalRight = totalRight.replace(/[^0-9.]/g, "");

    let totalRightOverValue = await totalBets
      .nth(4)
      .textContent({ timeout: 500 });
    let totalRightUnderValue = await totalBets
      .nth(5)
      .textContent({ timeout: 500 });

    if (totalRight) {
      totalOdds.push({
        total: totalRight,
        total_over: totalRightOverValue,
        total_under: totalRightUnderValue,
      });
    }
  }

  return totalOdds;
}

export async function parseFirstHalfHandicapOdds(page) {
  let betItem = await findOddsItemByName(page, "Handicap in 1st half");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseHandicapsData(betItem);
}

export async function parseHandicapOdds(page) {
  let betItem = await findOddsItemByName(page, "Handicap");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseHandicapsData(betItem);
}

export async function parseHandicapsData(betItem) {
  let data = [];

  const homeHandicapBets = betItem.locator(
    "xpath=.//div[contains(@class, 'body')]/div[1]//div[contains(@class, 'row-common')]"
  );

  const homeHandicapCount = await homeHandicapBets.count();
  for (let i = 0; i < homeHandicapCount; i++) {
    let bet = homeHandicapBets.nth(i);

    let betLabel = await bet
      .locator("xpath=.//div[contains(@class, 'common-text')]")
      .textContent();

    // only parse numbers and +-
    betLabel = betLabel.replace(/[^0-9+\-.‑]/g, "");

    let coefValue = await bet
      .locator("xpath=.//div[contains(@class, 'factor-td')]")
      .textContent();

    data.push({
      handicap: betLabel,
      coef: coefValue,
      type: "home",
    });
  }

  const awayHandicapBets = betItem.locator(
    "xpath=.//div[contains(@class, 'body')]/div[2]//div[contains(@class, 'row-common')]"
  );

  const awayHandicapCount = await awayHandicapBets.count();
  for (let i = 0; i < awayHandicapCount; i++) {
    let bet = awayHandicapBets.nth(i);

    let betLabel = await bet
      .locator("xpath=.//div[contains(@class, 'common-text')]")
      .textContent();

    // only parse numbers and +-
    betLabel = betLabel.replace(/[^0-9+\-.‑]/g, "");

    let coefValue = await bet
      .locator("xpath=.//div[contains(@class, 'factor-td')]")
      .textContent();

    data.push({
      handicap: betLabel,
      coef: coefValue,
      type: "away",
    });
  }

  return data;
}

export async function parseFirstHalfOutcomeOdds(page) {
  let betItem = await findOddsItemByName(page, "Result in 1st half");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseOutcomesData(betItem);
}

export async function parseSecondHalfOutcomeOdds(page) {
  let betItem = await findOddsItemByName(page, "Result in 2nd half");
  betItem = betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  return parseOutcomesData(betItem);
}

export async function parseOutcomeOdds(page) {
  let oddsSection = await findOddsItemByName(page, "Result");
  oddsSection = oddsSection.first();

  return parseOutcomesData(oddsSection);
}

export async function parseOutcomesData(betItem) {
  const bets = betItem.locator(
    "xpath=.//div[contains(@class, 'cell-wrap')]//div[contains(@class, 'value-state-normal')]"
  );

  let data;
  try {
    data = {
      home_team: await bets.nth(0).textContent(),
      draw: await bets.nth(1).textContent(),
      away_team: await bets.nth(2).textContent(),
    };
  } catch (error) {
    if (error instanceof playwright.errors.TimeoutError) {
      console.log(`Caught timeout on odds. No odds for this event`);
    }
  }

  return data;
}
