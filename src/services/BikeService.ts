import { BIKE_AVAILABLE, BIKE_UNAVAILABLE, SEARCH_RANGE } from "../constant/values"
import { Bike } from "../entities/bo/Bike"
import { BikeSeries, RawBike } from "../entities/dto/RawBike"
import { ConditionType, DbEntity, DbJoined } from "../entities/entity"
import { listHide } from "../entities/vo/Result"
import { transactionWrapper } from "../utils/db"

export function listBikes(lastId: number, size: number = 20, filter?: "danger" | "NA") {
  return transactionWrapper("listBikes", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let seriesDb = new DbEntity(BikeSeries, connection)
    let conditions: ConditionType<RawBike>[] = [['id', '>', lastId]]
    switch (filter) {
      case "danger":
        conditions.push(['health', '<', 50], ['status', '=', BIKE_AVAILABLE])
        break
      case "NA":
        conditions.push(['status', '=', BIKE_UNAVAILABLE])
        break
    }
    let joinedDb = new DbJoined(bikeDb.asTable(conditions, size), seriesDb.asTable(), connection)
    return (await joinedDb.list())
      .map(([b, s]) => ({ ...b, series_name: s.name }))
  })
}

export function listBikesAround(posLongitude: number, posLatitude: number, role: number) {
  return transactionWrapper("listBikesAround", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let result = await bikeDb.list([
      ['p_longitude', 'BETWEEN', [posLongitude - SEARCH_RANGE, posLongitude + SEARCH_RANGE]],
      ['p_latitude', 'BETWEEN', [posLatitude - SEARCH_RANGE, posLatitude + SEARCH_RANGE]],
    ])
    listHide(result, role)
  })
}

export async function tryUnlockBike(bikeId: number, encrypted: string) {
  return transactionWrapper("tryUnlockBike", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.unlock(encrypted)
  })
}
export async function updateWhileRiding(bikeId: number, userId: number, encrypted: string) {
  return transactionWrapper("updateWhileRiding", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.updateWhileRiding(encrypted, userId)
  })
}

export async function startFixing(bikeId: number) {
  return transactionWrapper("startFixing", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    await bike.update(BIKE_UNAVAILABLE)
  })
}

export async function finishFixing(bikeId: number) {
  return transactionWrapper("startFixing", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    await bike.finishFixing()
  })
}