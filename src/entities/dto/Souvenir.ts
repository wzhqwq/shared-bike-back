import { Column, Entity, Id, Nullable, Readonly, Restriction } from "../entity"

@Entity("Souvenir")
export class Souvenir {
  @Id
  @Column(Number)
  public id: number
  
  @Column(String)
  public name: string

  @Nullable
  @Restriction('imageKey')
  @Column(String)
  public image_key: string
  
  @Column(Number)
  public price: number
  
  @Readonly
  @Column(Number)
  public total_amount: number
}