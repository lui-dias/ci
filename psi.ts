import { parse } from "https://deno.land/std@0.201.0/flags/mod.ts";
import * as c from "https://deno.land/std@0.201.0/fmt/colors.ts";
import Kia from "https://deno.land/x/kia@0.4.1/mod.ts";
import { google } from "npm:googleapis";
import isCI from "npm:is-ci";

const debug = Deno.env.get("DEBUG") === "1";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(seconds: number) {
  return [
    Math.floor(seconds / 60 / 60),
    Math.floor((seconds / 60) % 60),
    Math.floor(seconds % 60),
  ]
    .join(":")
    .replace(/\b(\d)\b/g, "0$1");
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

const parsedArgs = parse<{
  _: string[];
  c?: number;
  d?: string;
  hash?: string;
}>(Deno.args);

if (!parsedArgs._.length) {
  console.log(`
    Usage:
    
    pp <urls> [-c <count>] [-d <device>]

    Examples:
        pp https://deco-sites-zorba.deno.dev/ https://www.lojastorra.com.br/
        pp https://deco-sites-zorba.deno.dev/ -c 10
        pp https://deco-sites-zorba.deno.dev/ -c 5 -d mobile

        Prints scores for each test
            DEBUG: pp https://deco-sites-zorba.deno.dev/ -c 5 -d mobile

    Notes:
        -c and -d are optional

    Options:
        -c <count>  Number of pagespeed tests to run
        -d <device> Device type: mobile or desktop
`);
  Deno.exit(0);
}

const urls = parsedArgs._;
const count = parsedArgs.c || 5;
const device = parsedArgs.d || "mobile";
const hash = parsedArgs.hash;

const results = {} as Record<string, string>;

const { pagespeedapi } = google.pagespeedonline("v5");

let totalDuration = 0;

async function main(url: string) {
  console.log(url);

  const performances = [] as number[];
  const accessibilities = [] as number[];
  const bestPractices = [] as number[];
  const pwas = [] as number[];
  const seos = [] as number[];

  let duration = 0;
  let i = 0;

  const spinner = new Kia();
  spinner.start();

  const interval = setInterval(() => {
    duration += 1;
    totalDuration += 1;

    spinner.set({
      text: `[${i + 1}/${count}] Test duration: ${c.blue(
        formatTime(duration)
      )}`,
    });
  }, 1000);

  for (; i < count; i++) {
    while (true) {
      const start = performance.now();

      let a: unknown;

      while (true) {
        a = await pagespeedapi.runpagespeed({
          category:
            i === 0
              ? ["accessibility", "best-practices", "performance", "pwa", "seo"]
              : ["performance"],
          strategy: device,
          url,
        });
        break;
      }

      const end = performance.now() - start;
      const asSec = end / 1000;

      if (asSec < 5) {
        await sleep(1000 * 10);
        continue;
      }

      // @ts-ignore no type psi
      performances.push(
        a.data.lighthouseResult?.categories?.performance?.score
      );
      if (i === 0) {
        // @ts-ignore no type psi
        accessibilities.push(
          a.data.lighthouseResult?.categories?.accessibility?.score
        );
        // @ts-ignore no type psi
        bestPractices.push(
          a.data.lighthouseResult?.categories?.["best-practices"]?.score
        );
        // @ts-ignore no type psi
        pwas.push(a.data.lighthouseResult?.categories?.pwa?.score);
        // @ts-ignore no type psi
        seos.push(a.data.lighthouseResult?.categories?.seo?.score);
      }

      break;
    }
  }

  clearInterval(interval);
  spinner.succeed(`Test finished for ${c.blue(url)}`);

  function getColor(n: string | number) {
    n = Number(n);

    const ns = n.toString();

    if (n >= 90) {
      return c.green(ns);
    } else if (n >= 60) {
      return c.yellow(ns);
    }

    return c.red(ns);
  }

  function intFixed(n: number) {
    return (n * 100).toFixed(0);
  }

  // prettier-ignore
  // deno-fmt-ignore
  function __________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________() {
		const performanceAvg = sum(performances) / performances.length * 100

		results[url] = ''

        if (isCI) {
            results[url] += `Performance:    ${intFixed(Math.min(...performances))} ${performanceAvg.toFixed(0).padStart(3, ' ')} ${intFixed(Math.max(...performances)).padStart(3, ' ')}\n`
            results[url] += `Accessibility:  ${intFixed(accessibilities[0])}                                                                                                             \n`
            results[url] += `Best Practices: ${intFixed(bestPractices[0])}                                                                                                               \n`
            results[url] += `PWA:            ${intFixed(pwas[0])}                                                                                                                        \n`
            results[url] += `SEO:            ${intFixed(seos[0])}                                                                                                                        \n`
        } else {
            if (debug) {
                results[url] += `${c.green('    DEBUG:')}                                                       \n`
                results[url] += `${c.blue('Performance:')}    ${performances.map((n) => intFixed(n)).join(', ')}\n`
                results[url] += `${c.blue('Accessibility:')}  ${intFixed(accessibilities[0])}                   \n`
                results[url] += `${c.blue('Best Practices:')} ${intFixed(bestPractices[0])}                     \n`
                results[url] += `${c.blue('PWA:')}            ${intFixed(pwas[0])}                              \n`
                results[url] += `${c.blue('SEO:')}            ${intFixed(seos[0])}                              \n`
                results[url] += `${c.green('-'.repeat(100))}                                                  \n\n`
            }
    
            results[url] += `${c.blue('Performance:')}    ${getColor(intFixed(Math.min(...performances)))} ${getColor(performanceAvg.toFixed(0).padStart(3, ' '))} ${getColor(intFixed(Math.max(...performances)).padStart(3, ' '))}\n`
            results[url] += `${c.blue('Accessibility:')}  ${getColor(intFixed(accessibilities[0]))}                                                                                                                                 \n`
            results[url] += `${c.blue('Best Practices:')} ${getColor(intFixed(bestPractices[0]))}                                                                                                                                   \n`
            results[url] += `${c.blue('PWA:')}            ${getColor(intFixed(pwas[0]))}                                                                                                                                            \n`
            results[url] += `${c.blue('SEO:')}            ${getColor(intFixed(seos[0]))}                                                                                                                                            \n`
        }
	}
  __________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________();
}

async function fileExists(file: string) { 
    try {
        await Deno.lstat("example.txt");
        return true
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
        return false
      }
}

for (const url of urls) {
  await main(url);
}

if (isCI) {
  let t = "";

  if (await fileExists('psi.txt')) {
    t = await Deno.readTextFile("psi.txt");
    t += '\n\n' 
  }

  t += `Commit hash: ${hash}\n`;

  for (const [url, result] of Object.entries(results)) {
    t += `${result}\n`;
  }
  t += `Total duration: ${formatTime(totalDuration)}\n`;

  await Deno.writeFile("psi.txt", new TextEncoder().encode(t));
} else {
  console.log();

  for (const [url, result] of Object.entries(results)) {
    console.log(`URL: ${url}\n${result}`);
  }
  console.log(`Total duration: ${formatTime(totalDuration)}`);

  console.log();
}
