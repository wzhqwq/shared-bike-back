import Router = require("@koa/router");
import { MANAGER_USER } from "../constant/values";
import { roleOnly } from "../utils/auth";

const managerRouter = new Router()
managerRouter.use(roleOnly(MANAGER_USER))

const propertyRouter = new Router()

const staffRouter = new Router()

const bikeRouter = new Router()

const souvenirRouter = new Router()

const sectionRouter = new Router()

const parkingPointRouter = new Router()

const configRouter = new Router()


managerRouter.use('property', propertyRouter.routes())
managerRouter.use('staff', staffRouter.routes())
managerRouter.use('bike', bikeRouter.routes())
managerRouter.use('souvenir', souvenirRouter.routes())
managerRouter.use('section', sectionRouter.routes())
managerRouter.use('parking_point', parkingPointRouter.routes())
managerRouter.use('config', configRouter.routes())

export default managerRouter