import { MAINTAINER_USER } from "../../constant/values"
import { Column, Entity, Foreign, Id, Length, Nullable, Readonly, Restriction } from "../entity"

@Entity("BikeSeries")
export class BikeSeries {
  @Id
  @Column(Number)
  public id: number

  @Length()
  @Column(String)
  public name: string

  @Restriction('positive')
  @Column(Number)
  public mileage_limit: number

  @Restriction('price')
  @Column(String)
  public rent: string

  @Readonly
  @Column(Number)
  public amount: number
}

@Entity("Bike")
export class RawBike {
  @Id
  @Column(Number)
  public id: number

  @Length(12, 12)
  @Column(String)
  public series_no: string
  
  @Foreign(BikeSeries, "id")
  @Column(Number)
  public series_id: number
  
  @Restriction('geographical')
  @Column(String)
  public p_longitude: string
  
  @Restriction('geographical')
  @Column(String)
  public p_latitude: string
  
  @Column(Number)
  public status: number
  
  @Column(Number)
  public mileage: number
  
  @Column(Number)
  public health: number
  
  @Nullable
  @Column(Number)
  public parking_section_id: number
  
  @Nullable
  @Column(Number)
  public parking_point_id: number

  @Column(String, 10)
  public token: string

  @Readonly
  @Column(Number)
  public fail_count: number
}

