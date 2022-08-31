type BaseRecord = {
  id: number
  time: number
}

type BaseBill = BaseRecord & {
  expense: number
  manager_id: number
}

type BaseMainRecord = BaseRecord & {
  change: number
  type: number
  record_id: number
}

export type RideRecord = {
  id: number
  bike_id: number
  customer_id: number
  mileage: number
  start_time: number
  end_time: number
  charge: number
  points_acquired: number
}

export type MalfunctionRecord = BaseRecord & {
  ride_id: number
  malfunction_id: number
  degree: number
  description: string
  image_url: string
  status: number
}

export type RepairRecord = BaseRecord & {
  malfunction_r_id: number
  maintainer_id: number
  conclusion: number
}

export type RechargeRecord = BaseRecord & {
  customer_id: number
  amount: number
}

export type PunishRecord = BaseRecord & {
  customer_id: number
  points_deducted: number
  reason: string
}

export type ExchangeRecord = BaseRecord & {
  souvenir_id: number
  customer_id: number
  amount: number
  given: number
  given_by?: number
}

export type DestroyRecord = BaseRecord & {
  bike_id: number
  manager_id: number
  reason: string
}

export type BikeBill = BaseBill & {
  bike_id: number
  amount: number
}

export type SouvenirBill = BaseBill & {
  souvenir_id: number
  amount: number
}

export type OtherBill = BaseBill & {
  reason: string
}

export type DepositRecord = BaseMainRecord & {
  customer_id: number
}

export type PointRecord = DepositRecord

export type ManagerBill = BaseMainRecord & {
  user_id: number
}

export type SignUpRequest = BaseRecord & {
  user_id: number
  type: number
  phone: string
  name: string
  status: number
}