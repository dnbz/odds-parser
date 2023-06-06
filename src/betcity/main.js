import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "../redis.js";
import { defaultHandler, parseEvent, parseLeague } from "./parse.js";
import { proxyConfiguration } from "../proxies.js";

log.setLevel(log.LEVELS.INFO);

const BetcityParser = class {
  urls = ["https://betcity.ru/ru/line/soccer"];

  constructor() {
    let router = createPlaywrightRouter();

    router.addDefaultHandler(defaultHandler);
    router.addHandler("LEAGUE", parseLeague);
    router.addHandler("EVENT", parseEvent);

    /** @type {PlaywrightCrawlerOptions} */
    const options = {
      requestHandler: router,
      browserPoolOptions: {
        useFingerprints: false,
      },
      maxConcurrency: 3,
      maxRequestsPerMinute: 120,
      maxRequestsPerCrawl: 10,
    };

    if (process.env.APP_ENV === "prod") {
      console.log("Using proxy configuration: ", proxyConfiguration.proxyUrls);
      options.proxyConfiguration = proxyConfiguration;
    }

    this.crawler = new PlaywrightCrawler(options);
    this.crawler.redis = getRedisClient();
  }

  async start() {
    await this.crawler.redis.connect();
    await this.crawler.run(this.urls);
    await this.crawler.redis.disconnect();
  }
};

const parser = new BetcityParser();
await parser.start();
