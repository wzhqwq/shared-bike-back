import { Column, Entity, Id, Nullable } from "../entity"

@Entity("RawSection")
export class RawSection {
  @Id
  @Nullable
  @Column(Number)
  public id: number
  
  @Column(Number)
  public tl_longitude: number
  
  @Column(Number)
  public tl_latitude: number
  
  @Column(Number)
  public br_longitude: number
  
  @Column(Number)
  public br_latitude: number
}