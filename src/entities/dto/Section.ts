import { Column, Entity, Foreign, Id, Length, Nullable, Restriction } from "../entity"
import { RawMaintainer } from "./RawUser"

@Entity("Section")
export class Section {
  @Id
  @Column(Number)
  public id: number
  
  @Restriction('geographical')
  @Column(String)
  public tr_longitude: string
  
  @Restriction('geographical')
  @Column(String)
  public tr_latitude: string
  
  @Restriction('geographical')
  @Column(String)
  public bl_longitude: string
  
  @Restriction('geographical')
  @Column(String)
  public bl_latitude: string

  @Length()
  @Column(String)
  public name: string
}

@Entity("MaintainerSection")
export class MaintainerSection {
  @Id
  @Column(Number)
  public id: number

  @Foreign(RawMaintainer, 'user_id')
  @Column(Number)
  public maintainer_id: number

  @Foreign(Section, 'id')
  @Column(Number)
  public section_id: number
}