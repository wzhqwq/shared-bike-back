import { BIKE_AVAILABLE, BIKE_DESTROYED, BIKE_UNAVAILABLE, CONFIG_REWARD_BASE, CONFIG_REWARD_DESCRIPTION, CONFIG_REWARD_PICTURE, REPAIR_UNHANDLED, SEARCH_RANGE } from "../constant/values"
import { Bike, posDecimal } from "../entities/bo/Bike"
import { BikeSeries, RawBike } from "../entities/dto/RawBike"
import { Malfunction } from "../entities/dto/Malfunction"
import { MalfunctionRecord, RepairRecord, RideRecord } from "../entities/dto/RawRecords"
import { ConditionType, DbEntity, DbJoined } from "../entities/entity"
import { listHide } from "../entities/vo/Result"
import { transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"
import { getConfigValue, malfunctions, series } from "../utils/cache"
import { bikeComm } from "../utils/auth"
import { MaintainerSection, Section } from "../entities/dto/Section"
import { ParkingPoint } from "../entities/dto/ParkingPoint"

export function listBikes(lastId: number, size: number = 20, filter?: "danger" | "NA" | "all") {
  return transactionWrapper("listBikes", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let seriesDb = new DbEntity(BikeSeries, connection)
    let conditions: ConditionType<RawBike>[] = [[['id'], '>', lastId]]
    switch (filter) {
      case "danger":
        conditions.push([['health'], '<', 50], [['status'], '=', BIKE_AVAILABLE])
        break
      case "NA":
        conditions.push([['status'], '=', BIKE_UNAVAILABLE])
        break
      case "all":
        break
      default:
        conditions.push([['status'], '<>', BIKE_DESTROYED])
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
      [['status'], '=', BIKE_AVAILABLE],
      [['p_longitude'], 'BETWEEN',
        [(posLongitude - SEARCH_RANGE).toFixed(6), (posLongitude + SEARCH_RANGE).toFixed(6)]
      ],
      [['p_latitude'], 'BETWEEN',
        [(posLatitude - SEARCH_RANGE).toFixed(6), (posLatitude + SEARCH_RANGE).toFixed(6)]
      ],
    ])
    listHide(result, role)
    return result
  })
}

export function tryUnlockBike(bikeId: number, encrypted: string) {
  return transactionWrapper("tryUnlockBike", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.unlock(encrypted)
  })
}
export function updateWhileRiding(bikeId: number, userId: number, encrypted: string) {
  return transactionWrapper("updateWhileRiding", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.updateWhileRiding(encrypted, userId)
  })
}

export function startFixing(bikeId: number) {
  return transactionWrapper("startFixing", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let bike = new RawBike()
    bike.id = bikeId
    bike.status = BIKE_UNAVAILABLE
    bikeDb.save(bike)
    return bike
  })
}

export function finishFixing(bikeId: number, posLongitude: string, posLatitude: string) {
  return transactionWrapper("finishFixing", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    await bike.finishFixing(posLongitude, posLatitude)
    return bike.raw
  })
}

export function handleMalfunction(repairRecord: RepairRecord) {
  return transactionWrapper("handleMalfunction", async (connection) => {
    let repairDb = new DbEntity(RepairRecord, connection)
    let bikeDb = new DbEntity(RawBike, connection)
    let malfunctionDb = new DbEntity(Malfunction, connection)
    let mRecordDb = new DbEntity(MalfunctionRecord, connection)
    
    if (!await bikeDb.pullBySearching([[['id'], '=', repairRecord.bike_id]]))
      throw new LogicalError("单车不存在")
    if (!await malfunctionDb.pullBySearching([[['id'], '=', repairRecord.malfunction_id]]))
      throw new LogicalError("故障不存在")
    
    let malfunctionRecords = await mRecordDb.list([
      [['status'], '=', REPAIR_UNHANDLED],
      [['bike_id'], '=', repairRecord.bike_id],
      [['malfunction_id'], '=', repairRecord.malfunction_id],
    ], ['id'])
    if (!malfunctionRecords.length) throw new LogicalError("该单车没有待处理的故障")

    let mRecordChange = new MalfunctionRecord()
    mRecordChange.status = repairRecord.conclusion + 1
    await mRecordDb.update(mRecordChange, [
      [['status'], '=', REPAIR_UNHANDLED],
      [['bike_id'], '=', repairRecord.bike_id],
      [['malfunction_id'], '=', repairRecord.malfunction_id],
    ])

    repairRecord.id = undefined
    await repairDb.save(repairRecord)

    return malfunctionRecords.map(r => r.id)
  })
}

export function reportMalfunction(mRecords: MalfunctionRecord[], userId: number, rideId: number) {
  return transactionWrapper("reportMalfunction", async (connection) => {
    let malfunctionIds = (await malfunctions).map(m => m.id)
    if (mRecords.some(r => !malfunctionIds.includes(r.malfunction_id))) throw new LogicalError("故障ID不存在")

    let rideDb = new DbEntity(RideRecord)
    let rideRecord = await rideDb.pullBySearching([[['id'], '=', rideId]])
    if (!rideRecord) throw new LogicalError("骑行日志不存在")
    let bikeId = rideRecord.bike_id

    let mRecordDb = new DbEntity(MalfunctionRecord, connection)
    await Promise.all(mRecords.map(async r => {
      r.bike_id = bikeId
      r.ride_id = rideId
      return await mRecordDb.save(r)
    }))

    // 计算积分
    let points = await getConfigValue(CONFIG_REWARD_BASE)
    if (mRecords.some(r => r.description.length > 10)) points += await getConfigValue(CONFIG_REWARD_DESCRIPTION)
    if (mRecords.some(r => r.image_key)) points += await getConfigValue(CONFIG_REWARD_PICTURE)
    rideRecord.points_acquired = points

    await rideDb.save(rideRecord)

    return points
  })
}

export function registerBike(encrypted: string, seriesId: number) {
  return transactionWrapper("registerBike", async (connection) => {
    if (!(await series).some(s => s.id === seriesId)) throw new LogicalError("单车型号不存在")

    let messages = bikeComm.decrypt(encrypted)
    if (messages.length !== 3) throw new LogicalError("单车识别失败")
    let [token, posLongitude, posLatitude] = messages
    if (token.length !== 20 || !posDecimal.test(posLongitude) || !posDecimal.test(posLatitude))
      throw new LogicalError("单车识别失败")

    let bikeId = await new Bike(connection).newBike(seriesId, posLongitude, posLatitude)
    return bikeComm.encrypt([token, bikeId.toString()])
  })
}

export function activateBike(encrypted: string) {
  return transactionWrapper("registerBike", async (connection) => {
    let bikeId = parseInt(bikeComm.decrypt(encrypted)[0])
    if (isNaN(bikeId)) throw new LogicalError("单车激活失败")

    let bike = await (new Bike(connection).fetchBike(bikeId))
    if (!bike) throw new LogicalError("激活了不存在的单车")

    await bike.update(BIKE_AVAILABLE)

    return bike.raw
  })
}

export function createSection(section: Section) {
  return transactionWrapper("createSection", async (connection) => {
    let sectionDb = new DbEntity(Section, connection)
    section.id = undefined
    await sectionDb.save(section)
    
    // 更新管理区内单车
    let bikeDb = new DbEntity(RawBike, connection)
    let bikeChange = new RawBike()
    bikeChange.parking_section_id = section.id
    await bikeDb.update(bikeChange, [
      [['parking_section_id'], 'IS', 'NULL'],
      [['p_longitude'], 'BETWEEN', [section.bl_longitude, section.tr_longitude]],
      [['p_latitude'], 'BETWEEN', [section.bl_latitude, section.tr_latitude]],
    ])

    return null
  })
}

export function deleteSection(sectionId: number) {
  return transactionWrapper("deleteSection", async (connection) => {
    await new DbEntity(Section, connection).delete([[['id'], '=', sectionId]])
    return null
  })
}

export function grantSectionTo(pair: MaintainerSection) {
  return transactionWrapper("revokeSectionFrom", async (connection) => {
    let db = new DbEntity(MaintainerSection, connection)
    let pair = new MaintainerSection()
    pair.id = undefined
    await db.save(pair)

    return null
  })
}

export function revokeSectionFrom(sectionId: number, maintainerId: number) {
  return transactionWrapper("revokeSectionFrom", async (connection) => {
    await new DbEntity(MaintainerSection, connection).delete([
      [['section_id'], '=', sectionId], [['maintainer_id'], '=', maintainerId]
    ])
    return null
  })
}

export function createParkingPoint(pp: ParkingPoint) {
  return transactionWrapper("createParkingPoint", async (connection) => {
    let ppDb = new DbEntity(ParkingPoint, connection)
    pp.id = pp.bikes_count = undefined
    await ppDb.save(pp)
    return null
  })
}

export function deleteParkingPoint(ppId: number) {
  return transactionWrapper("deleteParkingPoint", async (connection) => {
    await new DbEntity(ParkingPoint, connection).delete([[['id'], '=', ppId]])
    return null
  })
}

