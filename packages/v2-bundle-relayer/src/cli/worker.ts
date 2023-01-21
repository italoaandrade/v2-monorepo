import fs from 'fs'
import { Worker } from '../worker'
import { actionHandler, parseBool, parseNumber, root } from './shared'
import {
  defaultKeystoreFilePath
} from 'src/config'
import { getKeystore, recoverKeystore } from 'src/keystore'
import { promptPassphrase } from 'src/prompt'
import { setSignerUsingPrivateKey } from 'src/signer'

root
  .command('worker')
  .description('Start the worker')
  .option(
    '--dry [boolean]',
    'Start in dry mode. If enabled, no transactions will be sent.',
    parseBool
  )
  .option(
    '--server [boolean]',
    'Start the api server',
    parseBool
  )
  .option(
    '--indexer-poll-seconds <number>',
    'The number of seconds to wait between indexer polls',
    parseNumber
  )
  .option(
    '--exit-bundle-poll-seconds <number>',
    'The number of seconds to wait between exit bundle polls',
    parseNumber
  )
  .option(
    '--exit-bundle-retry-delay-seconds <number>',
    'The number of seconds to wait between exit bundle retries',
    parseNumber
  )
  .action(actionHandler(main))

async function main (source: any) {
  const { dry: dryMode, server, indexerPollSeconds, exitBundlePollSeconds, exitBundleRetryDelaySeconds } = source
  const keystoreFilePath = defaultKeystoreFilePath

  console.log('starting worker')
  console.log('dryMode:', !!dryMode)
  console.log('server:', !!server)
  console.log('indexerPollSeconds:', indexerPollSeconds || 'default')
  console.log('exitBundlePollSeconds:', exitBundlePollSeconds || 'default')
  console.log('exitBundleRetryDelaySeconds:', exitBundleRetryDelaySeconds || 'default')

  const exists = fs.existsSync(keystoreFilePath)
  if (exists) {
    const passphrase = await promptPassphrase()
    const keystore = getKeystore(keystoreFilePath)
    const recoveredPrivateKey = await recoverKeystore(keystore, passphrase)
    setSignerUsingPrivateKey(recoveredPrivateKey)
  }

  if (server) {
    require('../server')
  }

  const worker = new Worker({
    indexerPollSeconds,
    exitBundlePollSeconds,
    exitBundleRetryDelaySeconds
  })
  await worker.start()
}
