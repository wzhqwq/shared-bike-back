import { Column, Entity, Id, Nullable } from "../entity"

@Entity('Malfunction')
export class Malfunction {
  @Id
  @Column(Number)
  public id: number
  
  @Column(String)
  public part_name: string
  
  @Column(Number)
  public damage_degree: number
}