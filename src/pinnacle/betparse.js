import playwright from "playwright";
import { log } from "crawlee";

export async function findOddsItemByName(page, name) {
  let selector = `xpath=//div[@data-test-id = 'Collapse' and .//span[contains(text(), '${name}')]]`;

  return page.locator(selector);
}

export async function parseTotalOdds(page) {
  // spaces have to be there to not clash with other bets that have "Total Goals" in their name
  let totalItem = await findOddsItemByName(page, "Total – Match");
  // take the first
  totalItem = await totalItem.first();

  try {
    await totalItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Total odds not found");
    return [];
  }

  await totalItem.click();

  const seeMoreButton = totalItem.locator("xpath=.//span[text()='See more']");
  await seeMoreButton.click();

  let totalOdds = {};

  const totalBets = totalItem.locator("css=.market-btn");

  const count = await totalBets.count();
  for (let i = 0; i < count; i++) {
    let bet = totalBets.nth(i);
    let totalString = await bet
      .locator("xpath=.//span[contains(@class, 'style_label')]")
      .textContent();

    // take only numbers from the string
    let total = totalString.replace(/[^0-9.]/g, "");

    let totalValue = await bet
      .locator("xpath=.//span[contains(@class, 'style_price')]")
      .textContent();

    // check if it over or under total
    if (totalString.includes("Over")) {
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
  // spaces have to be there to not clash with other bets that have "Total Goals" in their name
  let betItem = await findOddsItemByName(page, "Handicap – Match");
  // take the first
  betItem = await betItem.first();

  try {
    await betItem.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    log.info("Handicap odds not found");
    return [];
  }

  await betItem.click();

  const seeMoreButton = betItem.locator("xpath=.//span[text()='See more']");
  await seeMoreButton.click();

  let data = [];

  const homeHandicapBets = betItem.locator(
    "xpath=.//div[contains(@class, 'style_buttonRow')]/div[1]/button"
  );

  const homeHandicapCount = await homeHandicapBets.count();
  for (let i = 0; i < homeHandicapCount; i++) {
    let bet = homeHandicapBets.nth(i);
    let betLabel = await bet
      .locator("xpath=.//span[contains(@class, 'style_label')]")
      .textContent();

    let coefValue = await bet
      .locator("xpath=.//span[contains(@class, 'style_price')]")
      .textContent();

    data.push({
      handicap: betLabel,
      coef: coefValue,
      type: "home",
    });
  }

  const awayHandicapBets = betItem.locator(
    "xpath=.//div[contains(@class, 'style_buttonRow')]/div[2]/button"
  );

  const awayHandicapCount = await awayHandicapBets.count();
  for (let i = 0; i < awayHandicapCount; i++) {
    let bet = awayHandicapBets.nth(i);
    let betLabel = await bet
      .locator("xpath=.//span[contains(@class, 'style_label')]")
      .textContent();

    let coefValue = await bet
      .locator("xpath=.//span[contains(@class, 'style_price')]")
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
  let oddsSection = await findOddsItemByName(page, "Money Line – 1st Half");
  oddsSection = oddsSection.first();

  try {
    await oddsSection.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    console.log(
      `Caught timeout on odds. No 1st half outcome odds for this event`
    );
    return [];
  }

  const oddsElems = oddsSection.locator(
    "xpath=//button//span[contains(@class, 'style_price')]"
  );

  await oddsSection.click();

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

export async function parseOutcomeOdds(page) {
  let oddsSection = await findOddsItemByName(page, "Money Line – Match");
  oddsSection = oddsSection.first();

  try {
    await oddsSection.waitFor({ state: "visible", timeout: 300 });
  } catch (e) {
    console.log(`Caught timeout on odds. No odds for this event`);
    return [];
  }

  const oddsElems = oddsSection.locator(
    "xpath=//button//span[contains(@class, 'style_price')]"
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
