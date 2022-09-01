import Router = require("@koa/router")
import { CUSTOMER_USER } from "../constant/values"
import { MalfunctionRecord } from "../entities/dto/RawRecords"
import Result from "../entities/vo/Result"
import { listBikesAround, tryUnlockBike, updateWhileRiding } from "../services/BikeService"
import { roleOnly } from "../utils/auth"
import { checkBody, checkBodyAsEntity } from "../utils/body"

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
  ctx.body = Result.success(await tryUnlockBike(bike_id, encrypted))
})

bikeRouter.post("/update", checkBody([
  { key: 'bike_id', restrictions: ['integer'] },
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let { bike_id, encrypted } = ctx.request.body as { bike_id: number, encrypted: string }
  ctx.body = Result.success(await updateWhileRiding(bike_id, ctx.state.user.id, encrypted))
})

bikeRouter.post("/report", checkBodyAsEntity(MalfunctionRecord), async ctx => {

})

let propertyRouter = new Router()

propertyRouter.get("/list/:type", ctx => {
  let type = ctx.params.type as "points" | "deposit"
})

propertyRouter.post("/recharge", checkBody([
  { key: 'amount', restrictions: ['number'] },
]), ctx => {

})

let souvenirRouter = new Router()

souvenirRouter.get("/list_items", ctx => {

})

souvenirRouter.get("/list_exchanged", ctx => {

})

souvenirRouter.post("/exchange", checkBody([
  { key: 'id', restrictions: ['integer'] },
]), ctx => {

})

customerRouter.use('/bike', bikeRouter.routes())
customerRouter.use('/property', propertyRouter.routes())
customerRouter.use('/souvenir', souvenirRouter.routes())

export default customerRouter