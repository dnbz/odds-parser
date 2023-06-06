async function findOddsItemByName(page, name) {
  let selector = `xpath=//div[@class='dops-item' and .//span[.='${name}']]`;

  return page.locator(selector);
}

export async function parseTotalOdds(page) {
  const totalItem = await findOddsItemByName(page, "Total");

  await totalItem.waitFor({ state: "visible", timeout: 100 });

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

    let underTotal = await bet
      .locator("css=.dops-item-row__block:nth-child(2) button")
      .textContent();
    let overTotal = await bet
      .locator("css=.dops-item-row__block:nth-child(3) button")
      .textContent();

    let data = {
      total: total,
      total_under: underTotal,
      total_over: overTotal,
    };

    totalOdds.push(data);
  }

  return totalOdds;
}

export async function parseOutcomeOdds(page) {
  let outcomeItem = page.locator("css=.line-event__main-bets");

  let data = {
    home_win: await outcomeItem
      .locator("css=button:nth-of-type(1)")
      .textContent(),
    draw: await outcomeItem.locator("css=button:nth-of-type(2)").textContent(),
    away_win: await outcomeItem
      .locator("css=button:nth-of-type(3)")
      .textContent(),
  };

  return data;
}
