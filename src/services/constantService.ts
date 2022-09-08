import { Lock } from "lock";
import { PoolConnection } from "mysql";
import { BIKE_DESTROYED } from "../constant/values";
import { Configuration } from "../entities/dto/Configuration";
import { Malfunction } from "../entities/dto/Malfunction";
import { BikeSeries, RawBike } from "../entities/dto/RawBike";
import { Souvenir } from "../entities/dto/Souvenir";
import { DbEntity } from "../entities/entity";
import { transactionWrapper } from "../utils/db";
import { LogicalError } from "../utils/errors";

const lock = Lock()

let cachedConfigs: Configuration[]
let cachedMalfunctions: Malfunction[]
let cachedSeriesList: BikeSeries[]

export const initializeCache = async () => {
  cachedConfigs = await new DbEntity(Configuration).list()
  cachedMalfunctions = await new DbEntity(Malfunction).list()
  cachedSeriesList = await new DbEntity(BikeSeries).list()
}

export const getConfigs = () => cachedConfigs
export const getMalfunctions = () => cachedMalfunctions
export const getSeriesList = () => cachedSeriesList

export function getConfigValue(id: number) {
  return cachedConfigs[id].value
}

export function setConfig(pairs: Configuration[]) {
  return transactionWrapper("setConfig", async connection => {
    let configDb = new DbEntity(Configuration, connection)
    await Promise.all(
      pairs
        .filter(p => Boolean(p.id))
        .map(async pair => await configDb.save(pair))
    )
    let list = await configDb.list()
    // 写锁，避免业务代码冲突
    lock('config', release => {
      cachedConfigs = list
      release()
    })
  })
}

export function getSeries(id: number) {
  return cachedSeriesList.find(s => s.id === id)
}

export async function decreaseSeriesCount(id: number, connection: PoolConnection) {
  let seriesDb = new DbEntity(BikeSeries, connection)
  await seriesDb.update([
    ['amount', [['amount'], '-', 1]]
  ], [
    [['id'], '=', id]
  ])
  lock('series', release => {
    cachedSeriesList.find(s => s.id === id).amount--
    release()
  })
}

export async function increaseSeriesCount(id: number, connection: PoolConnection) {
  let seriesDb = new DbEntity(BikeSeries, connection)
  await seriesDb.update([
    ['amount', [['amount'], '+', 1]]
  ], [
    [['id'], '=', id]
  ])
  lock('series', release => {
    cachedSeriesList.find(s => s.id === id).amount++
    release()
  })
}

export function addSeries(series: BikeSeries) {
  return transactionWrapper("addSeries", async connection => {
    let db = new DbEntity(BikeSeries, connection)
    await db.append(series)
    series = await db.pullBySearching([[['id'], '=', series.id]])
    lock('series', release => {
      cachedSeriesList = [...cachedSeriesList, series]
      release()
    })
  })
}

export function modifySeries(series: BikeSeries) {
  return transactionWrapper("modifySeries", async connection => {
    let db = new DbEntity(BikeSeries, connection)
    await db.save(series)
    series = await db.pullBySearching([[['id'], '=', series.id]])
    lock('series', release => {
      cachedSeriesList = cachedSeriesList.map(s => s.id == series.id ? series : s)
      release()
    })
  })
}

export function removeSeries(seriesId: number) {
  return transactionWrapper("removeSeries", async connection => {
    let db = new DbEntity(BikeSeries, connection)
    if ((await new DbEntity(RawBike, connection).list([
      [['series_id'], '=', seriesId],
      [['status'], '<', BIKE_DESTROYED]
    ])).length)
      throw new LogicalError("存在仍在运营的、与该单车型号关联的单车")
    // 到这里与型号关联的单车都是报废或未注册的，在删除型号后，它们会被级联删除
    await db.delete([[['id'], '=', seriesId]])
    lock('series', release => {
      cachedSeriesList = cachedSeriesList.filter(s => s.id !== seriesId)
      release()
    })
  })
}

export function getMalfunction(id: number) {
  return cachedMalfunctions.find(m => m.id === id)
}

export function addMalfunction(malfunction: Malfunction) {
  return transactionWrapper("addMalfunction", async connection => {
    await new DbEntity(Malfunction, connection).append(malfunction)
    lock('malfunction', release => {
      cachedMalfunctions = [...cachedMalfunctions, malfunction]
      release()
    })
  })
}

export function modifyMalfunctionName(malfunctionId: number, name: string) {
  return transactionWrapper("modifyMalfunctionName", async connection => {
    await new DbEntity(Malfunction, connection).update([['part_name', name]], [[['id'], '=', malfunctionId]])
    lock('malfunction', release => {
      getMalfunction(malfunctionId).part_name = name
      release()
    })
  })
}

export function listSouvenirs() {
  return transactionWrapper("listSouvenirs", async connection =>
    await new DbEntity(Souvenir, connection).list()
  )
}

export function addSouvenir(souvenir: Souvenir) {
  return transactionWrapper("addSouvenir", async connection =>
    await new DbEntity(Souvenir, connection).append(souvenir)
  )
}

export function modifySouvenir(souvenir: Souvenir) {
  return transactionWrapper("modifySouvenir", async connection =>
    await new DbEntity(Souvenir, connection).save(souvenir)
  )
}

// export function removeSouvenir(souvenirId: number) {
//   return transactionWrapper("removeSouvenir", async connection =>
//     await new DbEntity(Souvenir, connection).delete([[['id'], '=', souvenirId]])
//   )
// }