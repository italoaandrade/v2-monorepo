import { v4 as uuid } from 'uuid'

export class FeesSentToHub {
  db: any

  constructor(db: any) {
    this.db = db
  }

  async createTable() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS fees_sent_to_hub_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        tx_hash VARCHAR NOT NULL,
        amount NUMERIC NOT NULL
    )`)
  }

  async createIndexes() {

  }

  async getItems (opts: any = {}) {
    const { startTimestamp, endTimestamp, limit, offset } = opts
    return this.db.any(
      `SELECT
        timestamp,
        tx_hash AS "txHash",
        amount
      FROM
        fees_sent_to_hub_events
      WHERE
        timestamp >= $1
        AND
        timestamp <= $2
      ORDER BY
        timestamp
      DESC OFFSET $4`,
      [startTimestamp, endTimestamp, limit, offset])
  }

  async upsertItem (item: any) {
    const { timestamp, txHash, amount } = item
    const args = [uuid(), timestamp, txHash, amount]
    await this.db.query(
      `INSERT INTO
        bundle_set_events
      (id, timestamp, tx_hash, amount)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tx_hash)
      DO UPDATE SET timestamp = $2, tx_hash = $3`, args
    )
  }
}
