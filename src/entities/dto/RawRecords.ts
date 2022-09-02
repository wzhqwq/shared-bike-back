import { Column, Entity, Foreign, Id, Nullable, Restriction } from "../entity"
import { RawBike } from "./RawBike"
import { Malfunction } from "./Malfunction"
import { RawSouvenir } from "./RawSouvenir"
import { RawCustomer, RawMaintainer, RawManager, RawUser } from "./RawUser"

class BaseRecord {
  @Id
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
}

@Entity("RideRecord")
export class RideRecord {
  @Id
  @Nullable
  @Column(Number)
  public id: number
  
  @Foreign(RawBike, 'id')
  @Column(Number)
  public bike_id: number
  
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public mileage: number
  
  @Column(Date)
  public start_time: Date
  
  @Nullable
  @Column(Date)
  public end_time: Date
  
  @Column(String)
  public charge: string
  
  @Column(Number)
  public points_acquired: number
}

@Entity("MalfunctionRecord")
export class MalfunctionRecord extends BaseRecord {
  @Foreign(RawBike, 'id')
  @Nullable
  @Column(Number)
  public bike_id: number
  
  @Foreign(RideRecord, 'id')
  @Nullable
  @Column(Number)
  public ride_id: number
  
  @Foreign(Malfunction, 'id')
  @Column(Number)
  public malfunction_id: number
  
  @Restriction(c => [1, 2, 3, 10].includes(c) ? '' : '应为1、2、3或10')
  @Column(Number)
  public degree: number
  
  @Column(String)
  public description: string
  
  @Nullable
  @Column(String)
  public image_key: string
  
  @Restriction(c => [0, 1, 2, 3].includes(c) ? '' : '应为0、1、2或3')
  @Column(Number)
  public status: number
}

@Entity("RepairRecord")
export class RepairRecord extends BaseRecord {
  @Foreign(RawBike, 'id')
  @Column(Number)
  public bike_id: number

  @Foreign(Malfunction, 'id')
  @Column(Number)
  public malfunction_id: number
  
  @Foreign(RawMaintainer, 'user_id')
  @Nullable
  @Column(Number)
  public maintainer_id: number
  
  @Restriction(c => [0, 1, 2].includes(c) ? '' : '应为0、1或2')
  @Column(Number)
  public conclusion: number
}

@Entity("RechargeRecord")
export class RechargeRecord extends BaseRecord {
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
  
  @Column(String)
  public amount: string
}

@Entity("PunishRecord")
export class PunishRecord extends BaseRecord {
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public points_deducted: number
  
  @Column(String)
  public reason: string
}

@Entity("ExchangeRecord")
export class ExchangeRecord extends BaseRecord {
  @Foreign(RawSouvenir, 'id')
  @Column(Number)
  public souvenir_id: number
  
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public amount: number
  
  @Column(Number)
  public given: number
  
  @Column(Number)
  public given_by?: number
}

@Entity("DestroyRecord")
export class DestroyRecord extends BaseRecord {
  @Foreign(RawBike, 'id')
  @Column(Number)
  public bike_id: number
  
  @Foreign(RawManager, 'user_id')
  @Column(Number)
  public manager_id: number
  
  @Column(String)
  public reason: string
}

// bills
class BaseBill {
  @Id
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
  
  @Column(String)
  public expense: string
  
  @Foreign(RawManager, 'user_id')
  @Column(Number)
  public manager_id: number
}

@Entity("BikeBill")
export class BikeBill extends BaseBill {
  @Foreign(RawBike, 'id')
  @Column(Number)
  public bike_id: number
  
  @Column(Number)
  public amount: number
}

@Entity("SouvenirBill")
export class SouvenirBill extends BaseBill {
  @Foreign(RawSouvenir, 'id')
  @Column(Number)
  public souvenir_id: number
  
  @Column(Number)
  public amount: number
}

@Entity("OtherBill")
export class OtherBill extends BaseBill {
  @Column(String)
  public reason: string
}

// main records
class BaseMainRecord {
  @Id
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
  
  @Column(String)
  public change: string
  
  @Column(Number)
  public type: number
  
  @Column(Number)
  public record_id: number
}

@Entity("DepositRecord")
export class DepositRecord extends BaseMainRecord {
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
}

@Entity("PointRecord")
export class PointRecord extends BaseMainRecord {
  @Foreign(RawCustomer, 'user_id')
  @Column(Number)
  public customer_id: number
}

@Entity("ManagerBill")
export class ManagerBill extends BaseMainRecord {
  @Foreign(RawUser, 'id')
  @Column(Number)
  public user_id: number
}

@Entity("SignUpRequest")
export class SignUpRequest extends BaseRecord {
  @Nullable
  @Foreign(RawUser, 'id')
  @Column(Number)
  public user_id: number
  
  @Column(Number)
  public type: number
  
  @Column(String)
  public phone: string
  
  @Column(String)
  public name: string
  
  @Nullable
  @Column(Number)
  public status: number
}