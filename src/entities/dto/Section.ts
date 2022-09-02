import { Column, Entity, Foreign, Id, Nullable } from "../entity"
import { RawMaintainer } from "./RawUser"

@Entity("Section")
export class Section {
  @Id
  @Nullable
  @Column(Number)
  public id: number
  
  @Column(String)
  public tr_longitude: string
  
  @Column(String)
  public tr_latitude: string
  
  @Column(String)
  public bl_longitude: string
  
  @Column(String)
  public bl_latitude: string
}

@Entity("MaintainerSection")
export class MaintainerSection {
  @Id
  @Nullable
  @Column(Number)
  public id: number

  @Foreign(RawMaintainer, 'user_id')
  @Column(Number)
  public maintainer_id: number

  @Foreign(Section, 'id')
  @Column(Number)
  public section_id: number
}