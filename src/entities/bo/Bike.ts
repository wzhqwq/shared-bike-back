import { PoolConnection } from "mysql";
import { BIKE_AVAILABLE, BIKE_OCCUPIED } from "../../constant/values";
import { bikeComm } from "../../utils/auth";
import { LogicalError } from "../../utils/errors";
import { RawBike } from "../dto/RawBike";
import { RawMalfunction } from "../dto/RawMalfunction";
import { MalfunctionRecord, RideRecord } from "../dto/RawRecords";
import { DbEntity, DbJoined, RedisDbEntity } from "../entity";

export class Bike {
  private raw: RawBike
  private bikeDb: RedisDbEntity<RawBike>
  constructor(private connection: PoolConnection) {
    this.bikeDb = new RedisDbEntity(RawBike, 'id', connection)
  }

  public async fetchBike(id: number) {
    this.raw = await this.bikeDb.get(id)
    if (!this.raw) throw new LogicalError("单车不存在")
    return this
  }

  public async unlock(s: string) {
    let result = bikeComm.decrypt(s)
    if (result.length !== 2) throw new LogicalError("单车认证失败")
    let [token, id] = result
    if (token.length !== 20) throw new LogicalError("单车认证失败")
    if (parseInt(id) !== this.raw.id) throw new LogicalError("单车信息不匹配")

    if (this.raw.status !== BIKE_AVAILABLE) throw new LogicalError("单车不可用")
    this.raw.token = token
    await this.bikeDb.save(this.raw)

    return bikeComm.encrypt([token])
  }

  public async updateWhileRiding(s: string, userId: number) {
    let result = bikeComm.decrypt(s)
    if (result.length !== 5) throw new LogicalError("数据同步失败")
    let token = result[0], status = parseInt(result[1]), mileage = parseFloat(result[2]),
      posLongitude = parseFloat(result[3]), posLatitude = parseFloat(result[4])
    if (isNaN(status) || isNaN(mileage) || isNaN(posLongitude) || isNaN(posLatitude))
      throw new LogicalError("同步数据格式错误")
    if (this.raw.token !== token) throw new LogicalError("数据同步失败")

    let recordDb = new RedisDbEntity(RideRecord, 'bike_id', this.connection)
    if (this.raw.status === BIKE_AVAILABLE && status === BIKE_OCCUPIED) {
      // 开锁，开始记录
      let record = new RideRecord()
      record.bike_id = this.raw.id
      record.start_time = new Date()
      record.customer_id = userId
      record.mileage = mileage
      await recordDb.save(record)
      return bikeComm.encrypt([record.id.toString()])
    }
    if (this.raw.status === BIKE_OCCUPIED) {
      let record = await recordDb.get(this.raw.id)
      if (!record) throw new LogicalError("查询记录失败")
      record.mileage = mileage
      this.raw.p_latitude = posLatitude
      this.raw.p_longitude = posLongitude
      if (status === BIKE_AVAILABLE) {
        // 关锁成功
        record.end_time = new Date()
        let duration = (record.end_time.valueOf() - record.start_time.valueOf()) / 1000
        // 计价
        this.update(status)
      }
      await recordDb.save(record)
      await this.bikeDb.save(this.raw)
      return ""
    }
  }

  public async update(status: number) {
    this.raw.status = status
    if (status === BIKE_AVAILABLE) {
      let recordDb = new DbEntity(MalfunctionRecord)
      let malfunctionDb = new DbEntity(RawMalfunction)

      let records = await new DbJoined(
        recordDb.asTable([['bike_id', '=', this.raw.id]]),
        malfunctionDb.asTable(),
        this.connection
      ).list([], ['degree', 'damage_degree', 'malfunction_id'])
      
      let map = new Map<number, { degree: number[], multiplier: number }>()
      records.forEach(([r, m]) => {
        let list = map.get(r.malfunction_id)?.degree
        if (!list) {
          list = []
          map.set(r.malfunction_id, { degree: list, multiplier: m.damage_degree })
        }
        list.push(r.degree)
      })

      let health = 100
      map.forEach(({ degree, multiplier }) => {
        if (degree.length < 3) return
        let avgDegree = degree.sort().slice(1, -2).reduce((a, b) => a + b) / (degree.length - 2)
        health -= avgDegree * multiplier
      })
      
      this.raw.health = Math.floor(health)
    }
    await this.bikeDb.save(this.raw)
  }

  public async finishFixing() {
    await this.update(BIKE_AVAILABLE)
  }
}