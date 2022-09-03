import { Column, Entity, Id, Nullable } from "../entity"

@Entity("Souvenir")
export class RawSouvenir {
  @Id
  @Column(Number)
  public id: number
  
  @Column(String)
  public name: string
  
  @Column(Number)
  public price: number
  
  @Column(Number)
  public total_amount: number
  
  @Column(Number)
  public exchange_limit: number
}