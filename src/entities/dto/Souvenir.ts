import { Column, Entity, Id, Nullable, Readonly } from "../entity"

@Entity("Souvenir")
export class Souvenir {
  @Id
  @Column(Number)
  public id: number
  
  @Column(String)
  public name: string

  @Column(String)
  @Nullable
  public image_key: string
  
  @Column(Number)
  public price: number
  
  @Column(Number)
  @Readonly
  public total_amount: number
}