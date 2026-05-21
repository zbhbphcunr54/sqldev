import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'

const root = process.cwd()
const [inputArg, outputArg] = process.argv.slice(2)
const defaultInput = path.join('docs', 'previews', 'ziwei-ai-cards-preview-v4.html')
const inputPath = path.resolve(root, inputArg ?? defaultInput)
const outputPath = path.resolve(
  root,
  outputArg ?? inputPath.replace(/\.html?$/i, '.png')
)

const executableCandidates = [
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
]

const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate))

if (!fs.existsSync(inputPath)) {
  throw new Error(`Preview input not found: ${inputPath}`)
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath
})

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
    deviceScaleFactor: 1
  })
  await page.goto(pathToFileURL(inputPath).href, { waitUntil: 'load' })
  await page.screenshot({
    path: outputPath,
    fullPage: true
  })
} finally {
  await browser.close()
}

console.log(outputPath)
