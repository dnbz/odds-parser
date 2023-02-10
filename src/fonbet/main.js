import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "../redis.js";
import { defaultHandler } from "./parse.js";
import { proxyConfiguration } from "../proxies.js";

log.setLevel(log.LEVELS.INFO);

const FonbetParser = class {
  urls = ["https://www.fon.bet/sports/football/?mode=1"];

  constructor() {
    let router = createPlaywrightRouter();

    router.addDefaultHandler(defaultHandler);

    this.crawler = new PlaywrightCrawler({
      requestHandler: router,
      launchContext: { launchOptions: { timezoneId: "Europe/London" } },
      proxyConfiguration: proxyConfiguration,
      browserPoolOptions: {
        useFingerprints: false,
      }, // Uncomment this option to see the browser window.
      maxConcurrency: 3,
      requestHandlerTimeoutSecs: 360,
      maxRequestsPerMinute: 120,
    });

    this.crawler.redis = getRedisClient();
  }

  async start() {
    await this.crawler.redis.connect();
    await this.crawler.run(this.urls);
    await this.crawler.redis.disconnect();
  }
};

const parser = new FonbetParser();
await parser.start();
