import { Column, Entity, Foreign, Id, Nullable } from "../entity"

@Entity("BikeSeries")
class BikeSeries {
  @Id
  @Nullable
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
  @Nullable
  @Column(Number)
  public id: number
  
  @Foreign(BikeSeries, "id")
  @Column(Number)
  public series_id: number
  
  @Column(Number)
  public p_longitude: number
  
  @Column(Number)
  public p_latitude: number
  
  @Column(Number)
  public status: number
  
  @Column(Number)
  public mileage: number
  
  @Column(Number)
  public health: number
  
  @Column(Number)
  public parking_section_id: number
  
  @Column(Number)
  public parking_point_id: number
}

