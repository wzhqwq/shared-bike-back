import { Column, Entity, Id, Nullable } from "../entity"

class BaseRecord {
  @Id()
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
}

@Entity("RideRecord")
export class RideRecord {
  @Id()
  @Column(Number)
  public id: number
  
  @Column(Number)
  public bike_id: number
  
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public mileage: number
  
  @Column(Date)
  public start_time: Date
  
  @Column(Date)
  public end_time: Date
  
  @Column(Number)
  public charge: number
  
  @Column(Number)
  public points_acquired: number
}

@Entity("MalfunctionRecord")
export class MalfunctionRecord extends BaseRecord {
  
  @Column(Number)
  public ride_id: number
  
  @Column(Number)
  public malfunction_id: number
  
  @Column(Number)
  public degree: number
  
  @Column(String)
  description: string
  
  @Column(String)
  image_url: string
  
  @Column(Number)
  public status: number
}

@Entity("RepairRecord")
export class RepairRecord extends BaseRecord {
  
  @Column(Number)
  public malfunction_r_id: number
  
  @Column(Number)
  public maintainer_id: number
  
  @Column(Number)
  public conclusion: number
}

@Entity("RechargeRecord")
export class RechargeRecord extends BaseRecord {
  
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public amount: number
}

@Entity("PunishRecord")
export class PunishRecord extends BaseRecord {
  
  @Column(Number)
  public customer_id: number
  
  @Column(Number)
  public points_deducted: number
  
  @Column(String)
  reason: string
}

@Entity("ExchangeRecord")
export class ExchangeRecord extends BaseRecord {
  
  @Column(Number)
  public souvenir_id: number
  
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
  
  @Column(Number)
  public bike_id: number
  
  @Column(Number)
  public manager_id: number
  
  @Column(String)
  reason: string
}

// bills
class BaseBill {
  @Id()
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
  
  @Column(Number)
  public expense: number
  
  @Column(Number)
  public manager_id: number
}

@Entity("BikeBill")
export class BikeBill extends BaseBill {
  
  @Column(Number)
  public bike_id: number
  
  @Column(Number)
  public amount: number
}

@Entity("SouvenirBill")
export class SouvenirBill extends BaseBill {
  
  @Column(Number)
  public souvenir_id: number
  
  @Column(Number)
  public amount: number
}

@Entity("OtherBill")
export class OtherBill extends BaseBill {
  
  @Column(String)
  reason: string
}

// main records
class BaseMainRecord {
  @Id()
  @Column(Number)
  public id: number
  
  @Column(Date)
  public time: Date
  
  @Column(Number)
  public change: number
  
  @Column(Number)
  public type: number
  
  @Column(Number)
  public record_id: number
}

@Entity("DepositRecord")
export class DepositRecord extends BaseMainRecord {
  
  @Column(Number)
  public customer_id: number
}

@Entity("PointRecord")
export class PointRecord extends BaseMainRecord {
  
  @Column(Number)
  public customer_id: number
}

@Entity("ManagerBill")
export class ManagerBill extends BaseMainRecord {
  
  @Column(Number)
  public user_id: number
}

@Entity("SignUpRequest")
export class SignUpRequest extends BaseRecord {
  @Nullable()
  @Column(Number)
  public user_id: number
  
  @Column(Number)
  public type: number
  
  @Column(String)
  phone: string
  
  @Column(String)
  name: string
  
  @Nullable()
  @Column(Number)
  public status: number
}