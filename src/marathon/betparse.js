import { log } from "crawlee";
import playwright from "playwright";

export async function findOddsItemByName(page, name) {
  let selector = `xpath=//div[@class='market-inline-block-table-wrapper' and .//div[contains(text(), '${name}') and @class='name-field']]`;

  return page.locator(selector);
}

export async function parseTotalOdds(page) {
  // spaces have to be there to not clash with other bets that have "Total Goals" in their name
  let totalItem = await findOddsItemByName(page, "  Total Goals    ");
  totalItem = totalItem.first();

  // the data is still there even though it's not visible on the main tab
  try {
    await totalItem.waitFor({ state: "attached", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  const totalBets = totalItem.locator(
    "xpath=.//td[contains(@class, 'price') and .//*[@class='coeff-value']]"
  );

  let totalOdds = {};

  const count = await totalBets.count();
  for (let i = 0; i < count; ++i) {
    let bet = totalBets.nth(i);
    let total = await bet.locator("css=.coeff-value").textContent();
    // remove the brackets
    total = total.replace(/[\(\)]/g, "");
    total = total.trim();

    let totalValue;

    try {
      totalValue = await bet
        .locator("css=.coeff-price")
        .textContent({ timeout: 100 });
    } catch (e) {}

    // if the number is odd then it's the total under as under totals come first
    if (i % 2) {
      totalOdds[total] = {
        ...totalOdds[total],
        total_over: totalValue,
      };
    } else {
      totalOdds[total] = {
        ...totalOdds[total],
        total_under: totalValue,
      };
    }
  }

  return totalOdds;
}

export async function parseHandicapOdds(page) {
  let betItem = await findOddsItemByName(page, "To Win Match With Handicap");
  betItem = betItem.first();

  // the data is still there even though it's not visible on the main tab
  try {
    await betItem.waitFor({ state: "attached", timeout: 300 });
  } catch (e) {
    log.info("Handicap odds not found");
    return [];
  }

  let data = [];

  const homeHandicapBets = betItem.locator(
    "xpath=.//tr/td[contains(@class, 'price') and .//*[@class='coeff-value']][1]"
  );

  const homeHandicapCount = await homeHandicapBets.count();
  for (let i = 0; i < homeHandicapCount; i++) {
    let bet = homeHandicapBets.nth(i);
    let betLabel = await bet
      .locator("xpath=.//div[@class='coeff-value']")
      .textContent();

    betLabel = betLabel.replace(/[^0-9\-+.]/g, "");

    let coefValue = await bet
      .locator("xpath=.//div[@class='coeff-price']")
      .textContent();

    data.push({
      handicap: betLabel,
      coef: coefValue,
      type: "home",
    });
  }

  const awayHandicapBets = betItem.locator(
    "xpath=.//tr/td[contains(@class, 'price') and .//*[@class='coeff-value']][2]"
  );

  const awayHandicapCount = await awayHandicapBets.count();
  for (let i = 0; i < awayHandicapCount; i++) {
    let bet = awayHandicapBets.nth(i);
    let betLabel = await bet
      .locator("xpath=.//div[@class='coeff-value']")
      .textContent();

    betLabel = betLabel.replace(/[^0-9\-+.]/g, "");

    let coefValue = await bet
      .locator("xpath=.//div[@class='coeff-price']")
      .textContent();

    data.push({
      handicap: betLabel,
      coef: coefValue,
      type: "away",
    });
  }

  return data;
}

export async function parseOutcomeOdds(page) {
  const oddsElems = page.locator(
    "css=.coupon-row table.coupon-row-item .price"
  );

  let data;
  try {
    data = {
      home_team: await oddsElems.nth(0).textContent(),
      draw: await oddsElems.nth(1).textContent(),
      away_team: await oddsElems.nth(2).textContent(),
    };
  } catch (error) {
    if (error instanceof playwright.errors.TimeoutError) {
      console.log(`Caught timeout on odds. No odds for this event`);
    }
  }

  return data;
}

export async function parseFirstHalfOutcomeOdds(page) {
  // spaces are needed
  let betItem = await findOddsItemByName(page, "1st Half Result  ");
  betItem = betItem.first();

  // the data is still there even though it's not visible on the main tab
  try {
    await betItem.waitFor({ state: "attached", timeout: 300 });
  } catch (e) {
    log.info("First half outcome odds not found");
    return [];
  }

  const oddsElems = betItem.locator(
    "xpath=.//td[contains(@class, 'price')]//span"
  );
  let data = {
    home_team: await oddsElems.nth(0).textContent(),
    draw: await oddsElems.nth(1).textContent(),
    away_team: await oddsElems.nth(2).textContent(),
  };
  return data

  // let data;
  // try {
  //   data = {
  //     home_team: await oddsElems.nth(0).textContent(),
  //     draw: await oddsElems.nth(1).textContent(),
  //     away_team: await oddsElems.nth(2).textContent(),
  //   };
  // } catch (error) {
  //   if (error instanceof playwright.errors.TimeoutError) {
  //     console.log(`Caught timeout on first half outcome odds. No odds for this event`);
  //   }
  // }
  //
  // return data;
}
