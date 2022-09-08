import * as path from 'path'

export const PASSWORD_SALT = 'shared-bike-system'
export const PASSWORD_SECRET = 'u56305obvriw'
export const JWT_SECRET = 'u631eqsw91i6'
export const IMAGE_BASE = path.resolve(__dirname,  '../../images')

export const SEARCH_RANGE = 0.002
export const EXPAND_RATE = 0.0001

export const REQUEST_UNHANDLED = 0
export const REQUEST_ACCEPTED = 1
export const REQUEST_REJECTED = 2

export const UNLINKED_USER = 0
export const CUSTOMER_USER = 1
export const MAINTAINER_USER = 2
export const MANAGER_USER = 3

export const BIKE_AVAILABLE = 0
export const BIKE_OCCUPIED = 1
export const BIKE_UNAVAILABLE = 2
export const BIKE_DESTROYED = 3
export const BIKE_NOT_ACTIVATED = 4

export const REPAIR_UNHANDLED = 0
export const REPAIR_FAILED = 1
export const REPAIR_IGNORED = 2
export const REPAIR_FIXED = 3

export const CONCLUSION_FAILED = 0
export const CONCLUSION_IGNORED = 1
export const CONCLUSION_FIXED = 2

export const CONFIG_REWARD_BASE = 1
export const CONFIG_REWARD_PICTURE = 2
export const CONFIG_REWARD_DESCRIPTION = 3
export const CONFIG_CHARGE_MIN_SECONDS = 4
export const CONFIG_CHARGE_MIN_MILAGE = 5
export const CONFIG_CHARGE_PER_MINUTE = 6
export const CONFIG_SAFE_HEALTH = 7
export const CONFIG_TERMINATE_MINUTE = 8
export const CONFIG_OUT_OF_PP_PUNISH_POINTS = 9
export const CONFIG_TIME_EXCEEDED_PUNISH_POINTS = 10
export const CONFIG_BAN_MAX_POINTS = 11
export const CONFIG_BAN_DAYS = 12

export const MASTER_BILL_FROM_RIDING = 0
export const MASTER_BILL_FROM_BIKE = 1
export const MASTER_BILL_FROM_SOUVENIR = 2
export const MASTER_BILL_FROM_OTHER = 3

export const POINT_FROM_REPORTING = 0
export const POINT_FROM_EXCHANGE = 1
export const POINT_FROM_PUNISHMENT = 2

export const DEPOSIT_FROM_RECHARGE = 0
export const DEPOSIT_FROM_RIDING = 1