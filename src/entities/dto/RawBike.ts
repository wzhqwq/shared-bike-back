import { MAINTAINER_USER } from "../../constant/values"
import { Column, Entity, Foreign, Id, Nullable } from "../entity"

@Entity("BikeSeries")
export class BikeSeries {
  @Id
  @Column(Number)
  public id: number

  @Column(String)
  public name: string

  @Column(Number)
  public mileage_limit: number

  @Column(Number)
  public amount: number
}

@Entity("Bike")
export class RawBike {
  @Id
  @Column(Number)
  public id: number
  
  @Foreign(BikeSeries, "id")
  @Column(Number, MAINTAINER_USER)
  public series_id: number
  
  @Column(String)
  public p_longitude: string
  
  @Column(String)
  public p_latitude: string
  
  @Column(Number, MAINTAINER_USER)
  public status: number
  
  @Column(Number, MAINTAINER_USER)
  public mileage: number
  
  @Column(Number)
  public health: number
  
  @Nullable
  @Column(Number, MAINTAINER_USER)
  public parking_section_id: number
  
  @Nullable
  @Column(Number, MAINTAINER_USER)
  public parking_point_id: number

  @Column(String, 10)
  public token: string
}

