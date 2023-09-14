import { parse } from 'https://deno.land/std@0.201.0/flags/mod.ts'
import * as c from 'https://deno.land/std@0.201.0/fmt/colors.ts'
import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'
import Kia from 'https://deno.land/x/kia@0.4.1/mod.ts'
import { google } from 'npm:googleapis'
import { Semaphore } from 'https://deno.land/x/async@v2.0.2/semaphore.ts'

/*

Access site pages, run this:


[...document.querySelectorAll('tbody > a > div:nth-child(2)')].map(
    (i) => i.innerText
).join(', ')

*/

const debug = Deno.env.get('DEBUG') === '1'

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatTime(seconds: number) {
	return [
		Math.floor(seconds / 60 / 60),
		Math.floor((seconds / 60) % 60),
		Math.floor(seconds % 60),
	]
		.join(':')
		.replace(/\b(\d)\b/g, '0$1')
}

function sum(arr: number[]) {
	return arr.reduce((a, b) => a + b, 0)
}

const parsedArgs = parse<{
	_: string[]
	c?: number
	d?: string
}>(Deno.args)

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
`)
	Deno.exit(0)
}

const urls = parsedArgs._
const count = parsedArgs.c || 5
const device = parsedArgs.d || 'mobile'

if (urls[0] === 'index') {
	const seedUrl = urls[1]

	const urlParsed = new URL(seedUrl)
	const hostname = urlParsed.hostname
	const protocol = urlParsed.protocol
	const port = urlParsed.port

	const urlsToIndex = [seedUrl] as string[]
	const indexedUrls = new Set() as Set<string>

	const parser = new DOMParser()

	while (true) {
		if (urlsToIndex.length === 0) {
			break
		}

		const url = urlsToIndex.shift()!

		if (indexedUrls.has(url)) {
			continue
		}

		const text = await fetch(url).then((res) => res.text())
		const dom = parser.parseFromString(text, 'text/html')

		for (const a of dom?.querySelectorAll('a')!) {
			let href = (a as Element).getAttribute('href')

			if (!href || href.startsWith('#') || /^https?/.test(href) || href === '/') {
				continue
			}

			if (/^\/./.test(href)) {
				href = `${protocol}//${hostname}:${port}${href}`
			} else if (/^\w/.test(href)) {
				href = `${url.replace(/\/$/, '')}/${href}`
			}

			urlsToIndex.push(href)
			indexedUrls.add(href)
		}

		break
	}

	const sem = new Semaphore(10)

	await Promise.all(
		[...new Set(indexedUrls).values()].map((url) =>
			sem.lock(async () => {
				const isDown = await fetch(url, { method: 'HEAD' }).then((res) => !res.ok)

				if (isDown) {
					indexedUrls.delete(url)
				}
			})
		),
	)

	console.log(indexedUrls)
	Deno.exit(0)
}

const results = {} as Record<string, string>

const { pagespeedapi } = google.pagespeedonline('v5')

let totalDuration = 0

async function main(url: string) {
	const performances = [] as number[]
	const accessibilities = [] as number[]
	const bestPractices = [] as number[]
	const pwas = [] as number[]
	const seos = [] as number[]

	let duration = 0
	let i = 0

	const spinner = new Kia()
	spinner.start()

	const interval = setInterval(() => {
		duration += 1
		totalDuration += 1

		spinner.set({
			text: `[${i + 1}/${count}] Test duration: ${c.blue(formatTime(duration))}`,
		})
	}, 1000)

	for (; i < count; i++) {
		while (true) {
			const start = performance.now()

			let a: unknown

			while (true) {
				try {
					a = await pagespeedapi.runpagespeed({
						category: i === 0
							? ['accessibility', 'best-practices', 'performance', 'pwa', 'seo']
							: ['performance'],
						strategy: device,
						url,
					})
					break
				} catch {
					await sleep(10 * 1000)
				}
			}

			const end = performance.now() - start
			const asSec = end / 1000

			if (asSec < 5) {
				await sleep(1000 * 10)
				continue
			}

			// @ts-ignore no type psi
			performances.push(a.data.lighthouseResult?.categories?.performance?.score)
			if (i === 0) {
				// @ts-ignore no type psi
				accessibilities.push(a.data.lighthouseResult?.categories?.accessibility?.score)
				// @ts-ignore no type psi
				bestPractices.push(a.data.lighthouseResult?.categories?.['best-practices']?.score)
				// @ts-ignore no type psi
				pwas.push(a.data.lighthouseResult?.categories?.pwa?.score)
				// @ts-ignore no type psi
				seos.push(a.data.lighthouseResult?.categories?.seo?.score)
			}

			break
		}
	}

	clearInterval(interval)
	spinner.succeed(`Test finished for ${c.blue(url)}`)

	function getColor(n: string | number) {
		n = Number(n)

		const ns = n.toString()

		if (n >= 90) {
			return c.green(ns)
		} else if (n >= 60) {
			return c.yellow(ns)
		}

		return c.red(ns)
	}

	function intFixed(n: number) {
		return (n * 100).toFixed(0)
	}

	// prettier-ignore
	function __________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________() {
		const performanceAvg = sum(performances) / performances.length * 100

		results[url] = ''

		if (debug) {
			results[url] += `${
				c.green('    DEBUG:')
			}                                                          \n`
			results[url] += `${c.blue('Performance:')}    ${
				performances.map((n) => intFixed(n)).join(', ')
			}\n`
			results[url] += `${c.blue('Accessibility:')}  ${intFixed(accessibilities[0])}\n`
			results[url] += `${c.blue('Best Practices:')} ${intFixed(bestPractices[0])}\n`
			results[url] += `${c.blue('PWA:')}            ${intFixed(pwas[0])}\n`
			results[url] += `${c.blue('SEO:')}            ${intFixed(seos[0])}\n`
			results[url] += `${
				c.green('-'.repeat(100))
			}                                                     \n\n`
		}

		results[url] += `${c.blue('Performance:')}    ${
			getColor(intFixed(Math.min(...performances)))
		} ${getColor(performanceAvg.toFixed(0).padStart(3, ' '))} ${
			getColor(intFixed(Math.max(...performances)).padStart(3, ' '))
		}\n`
		results[url] += `${c.blue('Accessibility:')}  ${
			getColor(intFixed(accessibilities[0]))
		}                                                                                                                                 \n`
		results[url] += `${c.blue('Best Practices:')} ${
			getColor(intFixed(bestPractices[0]))
		}                                                                                                                                   \n`
		results[url] += `${c.blue('PWA:')}            ${
			getColor(intFixed(pwas[0]))
		}                                                                                                                                            \n`
		results[url] += `${c.blue('SEO:')}            ${
			getColor(intFixed(seos[0]))
		}                                                                                                                                            \n`
	}
	__________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________()
}

for (const url of urls) {
	await main(url)
}

console.log()

for (const [url, result] of Object.entries(results)) {
	console.log(`URL: ${url}\n${result}`)
}
console.log(`Total duration: ${formatTime(totalDuration)}`)

console.log()
