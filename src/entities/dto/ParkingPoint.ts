import { Column, Entity, Foreign, Id, Nullable, Readonly, Restriction } from "../entity"
import { Section } from "./Section"

@Entity('ParkingPoint')
export class ParkingPoint {
  @Id
  @Column(Number)
  public id: number
  
  @Restriction('geographical')
  @Column(String)
  public p_longitude: string
  
  @Restriction('geographical')
  @Column(String)
  public p_latitude: string
  
  @Readonly
  @Column(Number)
  public bikes_count: number
  
  @Column(Number)
  public minimum_count: number

  @Nullable
  @Foreign(Section, 'id')
  @Column(Number)
  public section_id: number
}