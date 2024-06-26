import body = require("koa-body")
import Router = require("@koa/router")
import { SignUpRequest } from "../entities/dto/RawRecords"
import { RawMaintainer, RawManager, RawUser } from "../entities/dto/RawUser"
import { getRestrictions } from "../entities/entity"
import Result from "../entities/vo/Result"
import { createSpecificUser, editAvatar, editNickname, editPassword, editProfile, getUser, mixUser, requestToBe, signIn, signUp } from "../services/userService"
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

authRouter.post('/request_to_be', checkBodyAsEntity(SignUpRequest), async ctx => {
  let data = ctx.request.body as SignUpRequest

  ctx.body = Result.success(await requestToBe(data, ctx.state.user.id))
})

authRouter.post('/check_role', async ctx => {
  let user = ctx.state.user
  ctx.body = Result.success(await createSpecificUser(user.id, false))
})

authRouter.post('/edit_profile', checkBody([
  { key: 'nickname', restrictions: getRestrictions(RawUser, 'nickname'), nullable: true },
  { key: 'avatar_key', restrictions: getRestrictions(RawUser, 'avatar_key'), nullable: true },
  { key: 'name', restrictions: getRestrictions(RawMaintainer, 'name'), nullable: true },
  { key: 'phone', restrictions: getRestrictions(RawMaintainer, 'phone'), nullable: true },
]), async ctx => {
  let user = ctx.state.user
  let data: { nickname: string, phone: string, name: string, avatar_key: string } = ctx.request.body

  if (data.nickname) await editNickname(data.nickname, user.id)
  if (data.avatar_key) await editAvatar(data.avatar_key, user.id)
  if (data.phone && data.name) await editProfile(data.name, data.phone, user.id, user.role)
  ctx.body = Result.success(null)
})

authRouter.post('/edit_password', checkBody([
  { key: 'password', restrictions: [lengthRestriction(1, 50)] },
  { key: 'old_password', restrictions: [lengthRestriction(1, 50)] },
]), async ctx => {
  let user = ctx.state.user
  let data: { password: string, old_password: string } = ctx.request.body
  ctx.body = Result.success(await editPassword(data.password, data.old_password, user.id))
})

authRouter.get('/me', async ctx => {
  ctx.body = Result.success(await getUser(ctx.state.user.id))
})

export default authRouter