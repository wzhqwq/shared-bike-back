import body = require("koa-body")
import Router = require("@koa/router")
import Result from "../entities/vo/Result"
import { listSection } from "../services/bikeService"
import { cachedMalfunctions, cachedSeriesList, listSouvenirs } from "../services/constantService"

const sharedRouter = new Router()
sharedRouter.use(body())

const sectionRouter = new Router()

sectionRouter.get('/list', async ctx => {
  ctx.body = Result.success(await listSection())
})

const souvenirRouter = new Router()

souvenirRouter.get('/list', async ctx => {
  ctx.body = Result.success(await listSouvenirs())
})

const malfunctionRouter = new Router()

malfunctionRouter.get('/list', async ctx => {
  ctx.body = Result.success(cachedMalfunctions)
})

const bikeSeriesRouter = new Router()

bikeSeriesRouter.get('/list', async ctx => {
  ctx.body = Result.success(cachedSeriesList)
})

sharedRouter.use('/section', sectionRouter.routes())
sharedRouter.use('/souvenir', souvenirRouter.routes())
sharedRouter.use('/malfunction', malfunctionRouter.routes())
sharedRouter.use('/series', bikeSeriesRouter.routes())

export default sharedRouter