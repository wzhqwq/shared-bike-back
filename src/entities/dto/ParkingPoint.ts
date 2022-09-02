import { Column, Entity, Id, Nullable } from "../entity"

@Entity('ParkingPoint')
export class ParkingPoint {
  @Id
  @Nullable
  @Column(Number)
  public id: number
  
  @Column(String)
  public p_longitude: string
  
  @Column(String)
  public p_latitude: string
  
  @Nullable
  @Column(Number)
  public bikes_count: number
  
  @Nullable
  @Column(Number)
  public minimum_count: number
}