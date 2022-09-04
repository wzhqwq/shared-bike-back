import { Column, Entity, Id, Length, Nullable, Restriction } from "../entity"

@Entity('Malfunction')
export class Malfunction {
  @Id
  @Column(Number)
  public id: number
  
  @Length()
  @Column(String)
  public part_name: string
  
  @Restriction('integer', 'positive')
  @Column(Number)
  public damage_degree: number
}