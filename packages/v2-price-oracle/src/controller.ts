import wait from 'wait'
import { BigNumber } from 'ethers'
import { ChainController } from './ChainController'
import { DateTime } from 'luxon'
import { DbController } from './DbController'
import { formatUnits } from 'ethers/lib/utils'
import { getBlockNumberFromDate } from './utils/getBlockNumberFromDate'
import { pollIntervalSeconds } from './config'

let dbController: DbController

export class Controller {
  chainControllers: Record<string, ChainController>
  dbController: DbController

  constructor () {
    this.chainControllers = {
      ethereum: new ChainController('ethereum'),
      arbitrum: new ChainController('arbitrum'),
      optimism: new ChainController('optimism'),
      basezk: new ChainController('basezk')
    }

    if (!dbController) {
      dbController = new DbController()
    }

    this.dbController = dbController
  }

  async getFeeData (input: any) {
    const { chainSlug, timestamp } = input
    let item = await this.dbController.getNearestGasFeeData({ chainSlug, timestamp })
    if (!item) {
      const startTime = DateTime.fromSeconds(timestamp).toUTC().minus({ minutes: 10 }).toSeconds()
      const endTime = DateTime.fromSeconds(timestamp).toUTC().plus({ minutes: 10 }).toSeconds()
      const chainController = this.chainControllers[chainSlug]
      const startBlockNumber = await getBlockNumberFromDate(chainController.provider, startTime)
      const endBlockNumber = await getBlockNumberFromDate(chainController.provider, endTime)
      await this.syncBlockNumberRange(chainSlug, startBlockNumber, endBlockNumber)
    }

    item = await this.dbController.getNearestGasFeeData({ chainSlug, timestamp })
    if (!item) {
      throw new Error('result not found')
    }

    const dt = DateTime.fromSeconds(item.timestamp)
    const expiration = dt.plus({ minutes: 10 }).toSeconds()
    return {
      expiration,
      ...item
    }
  }

  async startPoller (options: any = {}) {
    const { syncStartTimestamp } = options
    while (true) {
      let isFirstPoll = true
      try {
        console.log('poll')
        for (const chainSlug in this.chainControllers) {
          try {
            const chainController = this.chainControllers[chainSlug]
            console.log('fetching chain', chainSlug)

            let customStartSyncBlock: any = null
            if (syncStartTimestamp && isFirstPoll) {
              customStartSyncBlock = await getBlockNumberFromDate(chainController.provider, syncStartTimestamp)
            }

            const syncKey = `${chainSlug}`
            let lastSyncedBlocked: any = null
            try {
              if (customStartSyncBlock) {
                lastSyncedBlocked = customStartSyncBlock
              } else {
                lastSyncedBlocked = await this.dbController.getSyncState(syncKey)
              }
            } catch (err: any) {
            }
            const endBlockNumber = (await chainController.getBlockNumber() - 1)
            const startBlockNumber = lastSyncedBlocked ? Number(lastSyncedBlocked) : endBlockNumber - 1
            if (startBlockNumber === endBlockNumber || startBlockNumber > endBlockNumber) {
              continue
            }

            await this.syncBlockNumberRange(chainSlug, startBlockNumber, endBlockNumber, async (res: any) => {
              await this.dbController.putSyncState(syncKey, endBlockNumber)
            })
          } catch (err: any) {
            console.error(`error fetching chain ${chainSlug}`, err)
          }
        }
      } catch (err: any) {
        console.error('poll error', err)
      }
      isFirstPoll = false

      await wait(pollIntervalSeconds * 1000)
    }
  }

  async syncBlockNumberRange (chainSlug: string, startBlockNumber: number, endBlockNumber: number, cb?: any) {
    console.log('chain', chainSlug, 'startBlockNumber', startBlockNumber, 'endBlockNumber', endBlockNumber, 'diff', endBlockNumber - startBlockNumber)
    let lastItem: any
    for (let blockNumber = startBlockNumber; blockNumber <= endBlockNumber; blockNumber++) {
      if (lastItem && blockNumber === lastItem.blockNumber + 1) {
        const exists = await this.dbController.getGasFeeData({ chainSlug, timestamp: lastItem.timestamp })
        if (exists) {
          console.log('chain', chainSlug, 'blockNumber', blockNumber, 'lastTimestamp', lastItem.timestamp, 'exists')
          continue
        }
      }

      const res = await this.syncBlockNumber(chainSlug, blockNumber)
      if (!res) {
        lastItem = null
        continue
      }

      // lastItem = res
      if (cb) {
        await cb(res)
      }
    }
  }

  async syncBlockNumber (chainSlug: string, blockNumber: number) {
    console.log('syncBlockNumber', chainSlug, blockNumber)
    const exists = await this.dbController.getGasFeeData({ chainSlug, blockNumber })
    if (exists) {
      console.log('syncBlockNumber', chainSlug, blockNumber, 'exists')
      return exists
    }

    const chainController = this.chainControllers[chainSlug]
    const feeData = await chainController.getFeeData(blockNumber)
    const timestamp = feeData.timestamp
    const dt = DateTime.fromSeconds(timestamp)
    const relativeTime = dt.toRelative()
    const gwei = formatUnits(feeData.feeData.baseFeePerGas, 9)
    console.log('storing', chainSlug, 'blockNumber', blockNumber, 'gwei', gwei, 'timestamp', timestamp, 'relativeTime', relativeTime)
    const data = {
      chainSlug,
      blockNumber,
      timestamp,
      feeData
    }

    await this.dbController.putGasFeeData(data)
    return data
  }

  async getGasPriceValid (input: any) {
    const { baseFeePerGas, chainSlug, timestamp } = input
    const items = await this.dbController.getGasFeeDataRange({ chainSlug, timestamp })

    // const startTime = DateTime.fromSeconds(timestamp).toUTC().minus({ minutes: 10 }).toSeconds()
    // const endTime = DateTime.fromSeconds(timestamp).toUTC(). plus({ minutes: 10 }).toSeconds()
    // const chainController = this.chainControllers[chainSlug]
    // const startBlockNumber = await getBlockNumberFromDate(chainController.provider, startTime)
    // const endBlockNumber = await getBlockNumberFromDate(chainController.provider, endTime)
    // await this.syncBlockNumberRange(chainSlug, startBlockNumber, endBlockNumber)

    const targetBaseFeePerGasBN = BigNumber.from(baseFeePerGas)
    let valid = false
    let minFee = BigNumber.from(0)
    let minFeeBlockNumber = 0
    let minFeeTimestamp = 0
    for (const item of items) {
      const baseFeePerGasBN = BigNumber.from(item.feeData.baseFeePerGas)
      if (minFee.eq(0) || baseFeePerGasBN.lte(minFee)) {
        minFee = baseFeePerGasBN
        minFeeBlockNumber = item.blockNumber
        minFeeTimestamp = item.timestamp
      }
      // console.log('item', item.feeData.baseFeePerGas, item.blockNumber)
      if (targetBaseFeePerGasBN.gte(item.feeData.baseFeePerGas)) {
        valid = true
        // break
      }
    }

    return {
      valid,
      timestamp,
      baseFeePerGas,
      minFee: minFee.toString(),
      minFeeBlockNumber,
      minFeeTimestamp
    }
  }

  close () {
    this.dbController.close()
  }
}
