import Router = require("@koa/router")
import { CUSTOMER_USER } from "../constant/values"
import { Paginator, paginatorParams } from "../entities/dto/Paginator"
import { ExchangeRecord, MalfunctionRecord, RechargeRecord } from "../entities/dto/RawRecords"
import Result from "../entities/vo/Result"
import { listBikesAround, reportMalfunction, tryUnlockBike, updateWhileRiding } from "../services/BikeService"
import { listSouvenirs } from "../services/constantService"
import { exchange, listDepositChanges, listExchangeRecords, listPointChanges, recharge } from "../services/customerPropertyService"
import { roleOnly } from "../utils/auth"
import { checkBody, checkBodyAsEntity, checkBodyAsEntityList } from "../utils/body"

const customerRouter = new Router()
customerRouter.use(roleOnly(CUSTOMER_USER))

const bikeRouter = new Router()

bikeRouter.get("/list", checkBody([
  { key: 'longitude', restrictions: ['number'] },
  { key: 'latitude', restrictions: ['number'] },
]), async ctx => {
  let { longitude, latitude } = ctx.request.body as { longitude: number, latitude: number }
  ctx.body = Result.success(await listBikesAround(longitude, latitude, CUSTOMER_USER))
})

bikeRouter.post("/unlock", checkBody([
  { key: 'bike_id', restrictions: ['integer'] },
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let { bike_id, encrypted } = ctx.request.body as { bike_id: number, encrypted: string }
  ctx.body = Result.success(await tryUnlockBike(ctx.state.user.id, bike_id, encrypted))
})

bikeRouter.post("/update", checkBody([
  { key: 'bike_id', restrictions: ['integer'] },
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let { bike_id, encrypted } = ctx.request.body as { bike_id: number, encrypted: string }
  ctx.body = Result.success(await updateWhileRiding(bike_id, ctx.state.user.id, encrypted))
})

bikeRouter.post("/report", checkBodyAsEntityList(MalfunctionRecord), async ctx => {
  ctx.body = Result.success(await reportMalfunction(ctx.request.body, ctx.state.user.id))
})

let propertyRouter = new Router()

propertyRouter.get("/list/:type", checkBody(paginatorParams), async ctx => {
  let { lastId, size } = ctx.request.body as Paginator
  let type = ctx.params.type as "points" | "deposit"
  switch(type) {
    case 'points':
      ctx.body = await listPointChanges(ctx.state.user.id, lastId, size)
      break
    case 'deposit':
      ctx.body = await listDepositChanges(ctx.state.user.id, lastId, size)
      break
  }
})

propertyRouter.post("/recharge", checkBodyAsEntity(RechargeRecord), async ctx => {
  ctx.body = await recharge(ctx.request.body, ctx.state.user.id)
})

let souvenirRouter = new Router()

souvenirRouter.get("/list_items", async ctx => {
  ctx.body = await listSouvenirs()
})

souvenirRouter.get("/list_exchanged", checkBody(paginatorParams), async ctx => {
  let { lastId, size } = ctx.request.body as Paginator
  ctx.body = await listExchangeRecords(ctx.state.user.id, lastId, size)
})

souvenirRouter.post("/exchange", checkBodyAsEntity(ExchangeRecord), async ctx => {
  ctx.body = await exchange(ctx.request.body, ctx.state.user.id)
})

customerRouter.use('/bike', bikeRouter.routes())
customerRouter.use('/property', propertyRouter.routes())
customerRouter.use('/souvenir', souvenirRouter.routes())

export default customerRouter