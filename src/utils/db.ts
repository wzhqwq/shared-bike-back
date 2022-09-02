import { Connection, createPool, PoolConnection, QueryOptions } from "mysql"
import * as process from "process"
import * as log4js from "log4js"
import { createClient } from "redis"
import { DatabaseError } from "./errors"

const logger = log4js.getLogger('default.all')

const databaseHost = process.env.DB_HOST ?? "localhost"
const databasePassword = process.env.DB_PASS ?? "bike"
const databaseName = "shared_bike"

let pool = createPool({
  host: databaseHost,
  database: databaseName,
  user: "bike",
  password: databasePassword,
})

type QueryResult<RowT> = RowT[] & {
  affectedRows?: number   // Insert, Update, Delete
  changedRows?: number    // Update
  insertId?: number       // Insert
}

export function query<RowT>(sql: string | QueryOptions, values?: any[], connection?: Connection): Promise<QueryResult<RowT>> {
  return new Promise((resolve, reject) => {
    (connection ?? pool).query(sql, values, (error, data, field) => {
      logger.debug("MySQL Executed: ", sql)
      if (error) {
        reject(new DatabaseError(error))
        logger.error("MySQL Execution Failed: ", error.sqlMessage, error.sql)
        return
      }
      resolve(data)
    })
  })
}

export type TransactionResult = {
  connection: PoolConnection
  commit: () => Promise<void>
  rollback: () => Promise<void>
}

export function startTransaction(name: string = "untitled"): Promise<TransactionResult> {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(new DatabaseError(error))
        logger.error("MySQL Connection Failed: ", error.sqlMessage)
        return
      }
      connection.beginTransaction(error => {
        if (error) {
          reject(new DatabaseError(error))
          logger.error("Starting Transaction Failed: ", error.sqlMessage)
          return
        }
        logger.trace("Transaction Started: ", name)
        resolve({
          connection: connection,
          commit: () => new Promise<void>((res, rej) => connection.commit(error => {
            if (error) {
              rej(new DatabaseError(error))
              logger.error("Commit Failed: ", name)
            }
            else {
              res()
            }
          })),
          rollback: () => new Promise<void>((res, rej) => connection.rollback(error => {
            if (error) {
              rej(new DatabaseError(error))
              logger.error("Rollback Failed: ", name)
            }
            else {
              res()
            }
          })),
        })
      })
    })
  })
}

export async function transactionWrapper<T>(name: string, fn: (connection: PoolConnection) => Promise<T>) {
  let { connection, commit, rollback } = await startTransaction(name)
  try {
    let result = await fn(connection)
    await commit()
    connection.release()
    logger.trace("Transaction Ended: ", name)
    return result
  }
  catch (e) {
    await rollback()
    connection.release()
    logger.trace("Transaction Ended: ", name)
    throw e
  }
}

// redis

export const redisClient = createClient()

redisClient.connect()