import { Column, Entity, Id, Nullable, Readonly } from "../entity";

@Entity("Configuration")
export class Configuration {
  @Id
  @Column(Number)
  public id: number

  @Nullable
  @Readonly
  @Column(String)
  public key: string

  @Column(Number)
  public value: number

  @Column(Number)
  public is_money: number
}