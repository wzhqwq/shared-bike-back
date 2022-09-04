import Router = require("@koa/router");
import { MANAGER_USER } from "../constant/values";
import { Configuration } from "../entities/dto/Configuration";
import { Malfunction } from "../entities/dto/Malfunction";
import { Paginator, paginatorParams } from "../entities/dto/Paginator";
import { ParkingPoint } from "../entities/dto/ParkingPoint";
import { BikeSeries } from "../entities/dto/RawBike";
import { BikeBill, DestroyRecord, OtherBill, SignUpRequest, SouvenirBill } from "../entities/dto/RawRecords";
import { MaintainerSection, Section } from "../entities/dto/Section";
import { getRestrictions } from "../entities/entity";
import { createParkingPoint, createSection, destroyBike, grantSectionTo, listBikes, listParkingPoint, listSection, removeParkingPoint, removeSection, revokeSectionFrom } from "../services/BikeService";
import { addMalfunction, addSeries, cachedConfigs, cachedMalfunctions, cachedSeriesList, listSouvenirs, modifyMalfunctionName, modifySeries, removeSeries, setConfig } from "../services/constantService";
import { getBikeStatistics, getBillDetails, giveSouvenir, listExchanges, listMasterBill, listSeparatedBill, purchaseBikes, purchaseSouvenir, recordOtherBill } from "../services/departmentPropertyService";
import { listUsers, listSignUpRequests, handleSignUpRequest, liftTheBanOfCustomer } from "../services/userService";
import { roleOnly } from "../utils/auth";
import { checkBody, checkBodyAsEntity, checkBodyAsEntityList } from "../utils/body";

const managerRouter = new Router()
managerRouter.use(roleOnly(MANAGER_USER))

const propertyRouter = new Router()

propertyRouter.get('/separated/list/:category', checkBody(paginatorParams), async ctx => {
  let category = ctx.params.category as 'bike' | 'souvenir' | 'other'
  let body = ctx.request.body as Paginator
  ctx.body = await listSeparatedBill(category, body.lastId, body.size)
})

propertyRouter.get('/master/list', checkBody(paginatorParams), async ctx => {
  let body = ctx.request.body as Paginator
  ctx.body = await listMasterBill(body.lastId, body.size)
})

propertyRouter.get('/detail', checkBody([
  { key: 'record_id', restrictions: ['number', 'integer', 'positive']},
  { key: 'type', restrictions: [c => [0, 1, 2].includes(c) ? '' : '应为0、1或2'] }
]), async ctx => {
  let body = ctx.request.body as { record_id: number, type: number }
  ctx.body = await getBillDetails(body.type, body.record_id)
})

propertyRouter.post('/separated/add/bike', checkBodyAsEntity(BikeBill), async ctx => {
  ctx.body = await purchaseBikes(ctx.request.body, ctx.state.user.id)
})

propertyRouter.post('/separated/add/souvenir', checkBodyAsEntity(SouvenirBill), async ctx => {
  ctx.body = await purchaseSouvenir(ctx.request.body, ctx.state.user.id)
})

propertyRouter.post('/separated/add/other', checkBodyAsEntity(OtherBill), async ctx => {
  ctx.body = await recordOtherBill(ctx.request.body, ctx.state.user.id)
})

const userRouter = new Router()

userRouter.get('/list/:category', checkBody(paginatorParams), async ctx => {
  let category = ctx.params.category as 'customer' | 'manager' | 'maintainer'
  let body = ctx.request.body as Paginator
  ctx.body = await listUsers(category, body.lastId, body.size)
})

userRouter.get('/request/list', checkBody(paginatorParams), async ctx => {
  let body = ctx.request.body as Paginator
  ctx.body = await listSignUpRequests(body.lastId, body.size)
})

userRouter.post('/request/handle', checkBody([
  { key: 'record_id', restrictions: ['number', 'integer', 'positive']},
  { key: 'status', restrictions: getRestrictions(SignUpRequest, 'status')},
]), async ctx => {
  let body = ctx.request.body as { record_id: number, status: number }
  ctx.body = await handleSignUpRequest(body.record_id, body.status)
})

userRouter.post('/lift_the_ban', checkBody([
  { key: 'customer_id', restrictions: ['number', 'integer', 'positive']},
]), async ctx => {
  ctx.body = await liftTheBanOfCustomer(ctx.request.body.customer_id)
})

const bikeRouter = new Router()

bikeRouter.get('/statistics', async ctx => {
  ctx.body = await getBikeStatistics()
})

bikeRouter.get('/list/:category', checkBody(paginatorParams), async ctx => {
  let category = ctx.params.category as "danger" | "all" | "destroyed"
  let body = ctx.request.body as Paginator
  ctx.body = await listBikes(body.lastId, body.size, category)
})

bikeRouter.post('/destroy', checkBodyAsEntity(DestroyRecord), async ctx => {
  ctx.body = await destroyBike(ctx.request.body, ctx.state.user.id)
})

const bikeSeriesRouter = new Router()

bikeSeriesRouter.get('/list', async ctx => {
  ctx.body = cachedSeriesList
})

bikeSeriesRouter.post('/add', checkBodyAsEntity(BikeSeries), async ctx => {
  ctx.body = await addSeries(ctx.request.body)
})

bikeSeriesRouter.post('/modify', checkBodyAsEntity(BikeSeries), async ctx => {
  ctx.body = await modifySeries(ctx.request.body)
})

bikeSeriesRouter.post('/remove', checkBody([
  { key: 'series_id', restrictions: ['number', 'integer', 'positive']},
]), async ctx => {
  ctx.body = await removeSeries(ctx.request.body.series_id)
})

const malfunctionRouter = new Router()

malfunctionRouter.get('/list', async ctx => {
  ctx.body = cachedMalfunctions
})

malfunctionRouter.post('/add', checkBodyAsEntity(Malfunction), async ctx => {
  ctx.body = await addMalfunction(ctx.request.body)
})

malfunctionRouter.post('/modify', checkBody([
  { key: 'malfunction_id', restrictions: ['number', 'integer', 'positive']},
  { key: 'part_name', restrictions: getRestrictions(Malfunction, 'part_name')},
]), async ctx => {
  let body = ctx.request.body as { malfunction_id: number, part_name: string }
  ctx.body = await modifyMalfunctionName(body.malfunction_id, body.part_name)
})

bikeRouter.use('/series', bikeSeriesRouter.routes())
bikeRouter.use('/malfunction', malfunctionRouter.routes())

const souvenirRouter = new Router()

souvenirRouter.get('/list', async ctx => {
  ctx.body = await listSouvenirs()
})

souvenirRouter.get('/exchanges/list', checkBody([
  { key: 'customer_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  ctx.body = await listExchanges(ctx.request.body.customer_id)
})

souvenirRouter.post('/exchanges/give', checkBody([
  { key: 'record_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  ctx.body = await giveSouvenir(ctx.request.body.record_id, ctx.state.user.id)
})

const sectionRouter = new Router()

sectionRouter.get('/list', async ctx => {
  ctx.body = await listSection()
})

sectionRouter.post('/add', checkBodyAsEntity(Section), async ctx => {
  ctx.body = await createSection(ctx.request.body)
})

sectionRouter.post('/remove', checkBody([
  { key: 'section_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  ctx.body = await removeSection(ctx.request.body.section_id)
})

sectionRouter.post('/maintainer/:type', checkBodyAsEntity(MaintainerSection), async ctx => {
  let type = ctx.params.type as 'grant' | 'revoke'
  switch (type) {
    case 'grant':
      ctx.body = await grantSectionTo(ctx.request.body)
      break
      case 'revoke':
      ctx.body = await revokeSectionFrom(ctx.request.body)
      break
  }
})

const parkingPointRouter = new Router()

parkingPointRouter.get('/list', async ctx => {
  ctx.body = await listParkingPoint()
})

parkingPointRouter.post('/add', checkBodyAsEntity(ParkingPoint), async ctx => {
  ctx.body = await createParkingPoint(ctx.request.body)
})

parkingPointRouter.post('/remove', checkBody([
  { key: 'pp_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  ctx.body = await removeParkingPoint(ctx.request.body.pp_id)
})

const configRouter = new Router()

configRouter.get('/list', async ctx => {
  ctx.body = cachedConfigs
})

configRouter.post('/modify', checkBodyAsEntityList(Configuration), async ctx => {
  ctx.body = await setConfig(ctx.request.body)
})

managerRouter.use('property', propertyRouter.routes())
managerRouter.use('user', userRouter.routes())
managerRouter.use('bike', bikeRouter.routes())
managerRouter.use('souvenir', souvenirRouter.routes())
managerRouter.use('section', sectionRouter.routes())
managerRouter.use('parking_point', parkingPointRouter.routes())
managerRouter.use('config', configRouter.routes())

export default managerRouter

