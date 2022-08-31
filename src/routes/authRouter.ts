import * as Router from "@koa/router"
import * as body from "koa-body"
import RawUser from "../entities/dto/RawUser"
import Result from "../entities/vo/Result"
import { createSpecificUser, requestToBe, signIn, signUp } from "../services/UserService"
import { checkBody, checkBodyAsEntity, lengthRestriction } from "../utils/body"

let authRouter = new Router()

authRouter.use(body())

authRouter.post('/sign_up', checkBodyAsEntity(RawUser), async ctx => {
  ctx.body = Result.success(await signUp(ctx.request.body))
})

authRouter.post('/sign_in', checkBodyAsEntity(RawUser), async ctx => {
  ctx.body = Result.success(await signIn(ctx.request.body))
})

authRouter.post('/register_as_customer', async ctx => {
  let user = ctx.state.user
  ctx.body = Result.success(await createSpecificUser(user.id, true))
})

authRouter.post('/request_to_be', checkBody([
  { key: 'type', restrictions: [o => (o !== 0 && o !== 1) ? '应为0或1' : ''] },
  { key: 'name', restrictions: ['string', lengthRestriction(1, 10)] },
  { key: 'phone', restrictions: ['string', lengthRestriction()] },
]), async ctx => {
  let user = ctx.state.user
  let data: { type: number, phone: string, name: string } = ctx.request.body

  ctx.body = Result.success(await requestToBe({ user_id: user.id, ...data }))
})

authRouter.post('/check_role', async ctx => {
  let user = ctx.state.user
  ctx.body = Result.success(await createSpecificUser(user.id, false))
})

export default authRouter